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
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_OWNER = process.env.GITHUB_OWNER!;
const GITHUB_REPO = process.env.GITHUB_REPO!;

if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
  throw new Error("Missing required GitHub environment variables");
}

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

export async function initGitRepo() {
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

export async function useCommit(source: string, initialMetadata?: { executionStartTime?: number }) {
  const repo = await initGitRepo();
  const { dir } = repo;

  const date = format(new Date(), "yyyy-MM-dd");
  // Determine production mode
  const isProd = process.env.NODE_ENV === "production";
  let branchName = "main";
  
  // Store metadata that can be updated later
  let metadata = { ...initialMetadata, discountsFound: 0 };

  try {
    await git.checkout({
      fs,
      dir: dir,
      ref: "main",
      force: true,
    });
  } catch (error) {
    logger.warn("Could not checkout main, creating from current HEAD");
    if (isProd) {
      throw new Error(`Failed to checkout main branch in prod: ${error}`);
    }
    logger.warn(
      "Proceeding to create branch from current HEAD for non-prod env."
    );
  }

  // Only create a new branch if not in production
  if (!isProd) {
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
    [Symbol.asyncDispose]: async () => {
      const status = await git.statusMatrix({ fs, dir, filepaths: ["."] });
      const hasChanges = status.some(
        ([_file, _head, workdir, _stage]) => workdir !== 1
      );
      if (!hasChanges) {
        logger.warn("No changes detected, skipping commit");
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

      // Push directly to main if in prod, otherwise push branch and create PR
      if (isProd) {
        logger.info(
          `Prod env detected. Pushing changes directly to main branch.`
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
          executionTime: metadata.executionStartTime ? Date.now() - metadata.executionStartTime : undefined,
          commitUrl,
          commitHash,
        });
      } else {
        logger.info(
          `Non-prod env detected. Pushing to branch ${branchName} and creating PR.`
        );
        await execa("git", ["push", remote, branchName], {
          cwd: dir,
        });

        const prResponse = await octokit.pulls.create({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          title: `Update ${source} promotions for ${date}`,
          head: branchName,
          base: "main",
          body: `Automated PR to update ${source} promotions for ${date}`,
        });
        logger.info(`Created PR #${prResponse.data.number} for ${source}`);

        // Automatically merge the pull request
        await octokit.pulls.merge({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          pull_number: prResponse.data.number,
          commit_title: `${`Update ${source} promotions for ${date}`} (#${prResponse.data.number})`,
          merge_method: "squash",
        });
        logger.info(`Merged PR #${prResponse.data.number} for ${source}`);
        commitUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/pull/${prResponse.data.number}`;
        
        // Send Telegram notification for non-production
        await telegramNotifier.sendScrapingComplete({
          scraper: source,
          success: true,
          discountsFound: metadata.discountsFound,
          executionTime: metadata.executionStartTime ? Date.now() - metadata.executionStartTime : undefined,
          commitUrl,
          commitHash,
        });
      }

      await repo[Symbol.asyncDispose]();
    },
  };
}

export async function savePromotions(
  ctx: undefined,
  source: string,
  promotions: any[]
) {
  await using commit = await useCommit(source);

  const filepath = `${source}.json`;
  fs.writeFileSync(
    `${commit.dir}/${filepath}`,
    JSON.stringify(promotions, null, 2)
  );
}
