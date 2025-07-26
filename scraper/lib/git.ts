import git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import fs from "fs";
import { rm } from "fs/promises";
import { Octokit } from "@octokit/rest";
import { format } from "date-fns";
import { execa } from "execa";
import { nanoid } from "nanoid";
import { logger } from "../trigger/lib/logger";
import { telegramNotifier } from "./telegram.js";
import {
  loadPreviousDiscounts,
  calculateEnhancedDiscountDiff,
  formatDiscountForDisplay,
} from "./discount-diff.js";
import type { GenericDiscount } from "promos-db/schema.ts";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;

const hasGitHubCreds = GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO;

if (!hasGitHubCreds) {
  console.log(
    "⚠️  GitHub credentials not found - git operations will be disabled",
  );
}

const octokit = hasGitHubCreds
  ? new Octokit({
      auth: GITHUB_TOKEN,
    })
  : null;

export async function initGitRepo() {
  if (!hasGitHubCreds) {
    throw new Error("GitHub credentials required for git operations");
  }

  const REPO_DIR = `./.git-data-${new Date().toISOString()}`;
  if (!fs.existsSync(REPO_DIR)) {
    fs.mkdirSync(REPO_DIR, { recursive: true });
  }

  if (!fs.existsSync(`${REPO_DIR}/.git`)) {
    await git.init({ fs, dir: REPO_DIR });
    await git.addRemote({
      fs,
      dir: REPO_DIR,
      remote: "origin",
      url: `https://catdevnull-bot:${GITHUB_TOKEN}@github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git`,
    });
  }

  await git.fetch({
    fs,
    http,
    dir: REPO_DIR,
    remote: "origin",
    ref: "main",
  });

  return {
    dir: REPO_DIR,
    [Symbol.asyncDispose]: async () => {
      await rm(REPO_DIR, { recursive: true, force: true });
    },
  };
}

export async function useCommit(
  source: string,
  initialMetadata?: { executionStartTime?: number; prOnly?: boolean },
) {
  if (!hasGitHubCreds) {
    throw new Error("GitHub credentials are required for git operations");
  }

  const repo = await initGitRepo();
  const { dir } = repo;

  const date = format(new Date(), "yyyy-MM-dd");
  // Determine production mode and unattended mode
  const isProd = process.env.NODE_ENV === "production";
  const isUnattendedMode = process.env.UNATTENDED_MODE === "true";
  let branchName = "main";

  // Store metadata that can be updated later
  let metadata = {
    ...initialMetadata,
    discountsFound: 0,
    prOnly: initialMetadata?.prOnly || false,
  };
  let currentDiscounts: GenericDiscount[] = [];
  let previousDiscounts: GenericDiscount[] = [];

  try {
    await git.checkout({
      fs,
      dir: dir,
      ref: "main",
      force: true,
    });

    // Load previous discounts immediately after checkout, before any new data is written
    try {
      previousDiscounts = await loadPreviousDiscounts(source, dir);
      logger.info(
        `Loaded ${previousDiscounts.length} previous discounts for ${source}`,
      );
    } catch (error) {
      logger.warn(`Could not load previous discounts for ${source}:`, error);
      previousDiscounts = [];
    }
  } catch (error) {
    logger.warn("Could not checkout main, creating from current HEAD");
    if (isProd) {
      throw new Error(`Failed to checkout main branch in prod: ${error}`);
    }
    logger.warn(
      "Proceeding to create branch from current HEAD for non-prod env.",
    );
  }

  // Only create a new branch if not in production (will be determined later for unattended mode)
  if (!isProd && !isUnattendedMode) {
    branchName = `promotions/${date}/${nanoid()}/${source}`;
    await git.branch({
      fs,
      dir: dir,
      ref: branchName,
      checkout: true,
    });
  }

  return {
    dir,
    updateDiscountsCount: (count: number) => {
      metadata.discountsFound = count;
    },
    setCurrentDiscounts: (discounts: GenericDiscount[]) => {
      currentDiscounts = discounts;
      metadata.discountsFound = discounts.length;
    },
    [Symbol.asyncDispose]: async () => {
      // Calculate discount diff first, regardless of file changes
      let diffResult: any = null;

      if (currentDiscounts.length > 0) {
        try {
          diffResult = calculateEnhancedDiscountDiff(
            previousDiscounts,
            currentDiscounts,
          );
          logger.info(
            `Discount diff calculated: +${diffResult.new.length} new, -${diffResult.removed.length} removed, ${diffResult.validityChanges.length} period changed (${previousDiscounts.length} → ${currentDiscounts.length})`,
          );
        } catch (error) {
          logger.error("Failed to calculate discount diff:", error);
        }
      }

      const status = await git.statusMatrix({ fs, dir, filepaths: ["."] });
      const hasChanges = status.some(
        ([_file, _head, workdir, _stage]) => workdir !== 1,
      );
      if (!hasChanges) {
        logger.warn("No changes detected, skipping commit");

        // Even if no file changes, send diff notification if there are discount changes
        if (
          diffResult &&
          (diffResult.new.length > 0 ||
            diffResult.removed.length > 0 ||
            diffResult.validityChanges.length > 0)
        ) {
          try {
            await telegramNotifier.sendDiscountDiff({
              scraper: source,
              added: diffResult.new.map(formatDiscountForDisplay),
              removed: diffResult.removed.map(
                formatDiscountForDisplay,
              ),
              validityChanged: diffResult.validityChanges.map(
                (change: any) => ({
                  baseKey: formatDiscountForDisplay(change.newDiscount),
                  oldPeriod: `${change.oldDiscount.validFrom} to ${change.oldDiscount.validUntil}`,
                  newPeriod: `${change.newDiscount.validFrom} to ${change.newDiscount.validUntil}`,
                  fullOldKey: "",
                  fullNewKey: "",
                }),
              ),
              totalNew: diffResult.totalNew,
              totalOld: diffResult.totalOld,
            });
            logger.info("Discount diff notification sent successfully");
          } catch (error) {
            logger.error("Failed to send discount diff notification:", error);
          }
        }

        return;
      }

      await git.add({ fs, dir, filepath: "." });

      const commitResult = await git.commit({
        fs,
        dir,
        message: `Update ${source} promotions for ${date}`,
        author: {
          name: "Promotions Bot",
          email: "bot@nulo.lol",
        },
      });

      const remote = `https://catdevnull-bot:${GITHUB_TOKEN}@github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git`;
      let commitUrl = "";
      let commitHash = commitResult;

      // Determine commit strategy based on mode and change percentage
      let shouldCommitToMain = isProd;
      let shouldCreatePR = !isProd;
      let shouldAutoMergePR = !metadata.prOnly;

      if (isUnattendedMode && diffResult) {
        // Calculate change percentage for unattended mode
        const changePercentage = Math.abs(diffResult.totalNew - diffResult.totalOld) / Math.max(diffResult.totalOld, 1) * 100;
        logger.info(`Change percentage calculated: ${changePercentage.toFixed(1)}% (${diffResult.totalOld} → ${diffResult.totalNew})`);
        
        if (changePercentage > 35) {
          // High-impact changes: create PR for review
          shouldCommitToMain = false;
          shouldCreatePR = true;
          shouldAutoMergePR = false; // Never auto-merge in unattended mode when creating PR
          
          // Create branch now if we haven't already
          if (branchName === "main") {
            branchName = `promotions/${date}/${nanoid()}/${source}`;
            await git.branch({
              fs,
              dir: dir,
              ref: branchName,
              checkout: true,
            });
          }
          
          logger.info(`High-impact changes detected (${changePercentage.toFixed(1)}% > 35%). Creating PR for review.`);
        } else {
          // Low-impact changes: commit directly
          shouldCommitToMain = true;
          shouldCreatePR = false;
          logger.info(`Low-impact changes detected (${changePercentage.toFixed(1)}% ≤ 35%). Committing directly to main.`);
        }
      }

      // Push directly to main if determined above, otherwise push branch and create PR
      if (shouldCommitToMain) {
        logger.info(
          isUnattendedMode 
            ? `Low-impact changes. Pushing directly to main branch.`
            : `Prod env detected. Pushing changes directly to main branch.`,
        );
        await execa("git", ["push", remote, "main"], {
          cwd: dir,
        });
        logger.info(`Successfully pushed changes to main for ${source}.`);
        commitUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/commit/${commitHash}`;

        // Send Telegram notification for production
        await telegramNotifier.sendScrapingComplete({
          scraper: source,
          success: true,
          discountsFound: metadata.discountsFound,
          executionTime: metadata.executionStartTime
            ? Date.now() - metadata.executionStartTime
            : undefined,
          commitUrl,
          commitHash,
        });

        // Send discount diff notification if available
        if (
          diffResult &&
          (diffResult.new.length > 0 ||
            diffResult.removed.length > 0 ||
            diffResult.validityChanges.length > 0)
        ) {
          try {
            await telegramNotifier.sendDiscountDiff({
              scraper: source,
              added: diffResult.new.map(formatDiscountForDisplay),
              removed: diffResult.removed.map(
                formatDiscountForDisplay,
              ),
              validityChanged: diffResult.validityChanges.map(
                (change: any) => ({
                  baseKey: formatDiscountForDisplay(change.newDiscount),
                  oldPeriod: `${change.oldDiscount.validFrom} to ${change.oldDiscount.validUntil}`,
                  newPeriod: `${change.newDiscount.validFrom} to ${change.newDiscount.validUntil}`,
                  fullOldKey: "",
                  fullNewKey: "",
                }),
              ),
              totalNew: diffResult.totalNew,
              totalOld: diffResult.totalOld,
              commitUrl,
              commitHash,
            });
            logger.info("Discount diff notification sent successfully");
          } catch (error) {
            logger.error("Failed to send discount diff notification:", error);
          }
        }
      } else {
        logger.info(
          isUnattendedMode 
            ? `High-impact changes. Pushing to branch ${branchName} and creating PR.`
            : `Non-prod env detected. Pushing to branch ${branchName} and creating PR.`,
        );
        await execa("git", ["push", remote, branchName], {
          cwd: dir,
        });

        const prResponse = await octokit!.pulls.create({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          title: `Update ${source} promotions for ${date}`,
          head: branchName,
          base: "main",
          body: `Automated PR to update ${source} promotions for ${date}`,
        });
        logger.info(`Created PR #${prResponse.data.number} for ${source}`);

        // Only auto-merge if determined above
        if (shouldAutoMergePR) {
          await octokit!.pulls.merge({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            pull_number: prResponse.data.number,
            commit_title: `${`Update ${source} promotions for ${date}`} (#${prResponse.data.number})`,
            merge_method: "squash",
          });
          logger.info(`Merged PR #${prResponse.data.number} for ${source}`);
        } else {
          logger.info(
            `PR #${prResponse.data.number} created but not auto-merged due to ${isUnattendedMode ? "high-impact changes requiring review" : "--pr-only flag"}`,
          );
        }
        commitUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/pull/${prResponse.data.number}`;

        // Send Telegram notification for non-production
        await telegramNotifier.sendScrapingComplete({
          scraper: source,
          success: true,
          discountsFound: metadata.discountsFound,
          executionTime: metadata.executionStartTime
            ? Date.now() - metadata.executionStartTime
            : undefined,
          commitUrl,
          commitHash,
        });

        // Send discount diff notification if available
        if (
          diffResult &&
          (diffResult.new.length > 0 ||
            diffResult.removed.length > 0 ||
            diffResult.validityChanges.length > 0)
        ) {
          try {
            await telegramNotifier.sendDiscountDiff({
              scraper: source,
              added: diffResult.new.map(formatDiscountForDisplay),
              removed: diffResult.removed.map(
                formatDiscountForDisplay,
              ),
              validityChanged: diffResult.validityChanges.map(
                (change: any) => ({
                  baseKey: formatDiscountForDisplay(change.newDiscount),
                  oldPeriod: `${change.oldDiscount.validFrom} to ${change.oldDiscount.validUntil}`,
                  newPeriod: `${change.newDiscount.validFrom} to ${change.newDiscount.validUntil}`,
                  fullOldKey: "",
                  fullNewKey: "",
                }),
              ),
              totalNew: diffResult.totalNew,
              totalOld: diffResult.totalOld,
              commitUrl,
              commitHash,
            });
            logger.info("Discount diff notification sent successfully");
          } catch (error) {
            logger.error("Failed to send discount diff notification:", error);
          }
        }
      }

      await repo[Symbol.asyncDispose]();
    },
  };
}

export async function savePromotions(
  ctx: undefined,
  source: string,
  promotions: any[],
) {
  await using commit = await useCommit(source);

  const filepath = `${source}.json`;
  fs.writeFileSync(
    `${commit.dir}/${filepath}`,
    JSON.stringify(promotions, null, 2),
  );
}
