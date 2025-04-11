import git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import fs from "fs";
import { rm } from "fs/promises";
import { Octokit } from "@octokit/rest";
import { format } from "date-fns";
import { execa } from "execa";
import { Context, logger } from "@trigger.dev/sdk/v3";
import { nanoid } from "nanoid";
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

export async function savePromotions(
  ctx: Context,
  source: string,
  promotions: any[]
) {
  await using repo = await initGitRepo();
  const { dir } = repo;

  const date = format(new Date(), "yyyy-MM-dd");
  const branchName = `promotions/${date}/${nanoid()}/${source}`;

  try {
    await git.checkout({
      fs,
      dir: dir,
      ref: "main",
      force: true,
    });
  } catch (error) {
    console.warn("Could not checkout main, creating from current HEAD");
  }

  await git.branch({
    fs,
    dir: dir,
    ref: branchName,
    checkout: true,
  });

  const filepath = `${source}.json`;
  fs.writeFileSync(`${dir}/${filepath}`, JSON.stringify(promotions, null, 2));

  const status = await git.statusMatrix({ fs, dir, filepaths: [filepath] });
  const hasChanges = status.some(
    ([_file, _head, workdir, _stage]) => workdir !== 1
  );
  if (!hasChanges) {
    logger.warn("No changes detected, skipping commit");
    return;
  }

  await git.add({ fs, dir, filepath });

  await git.commit({
    fs,
    dir,
    message: `Update ${source} promotions for ${date}`,
    author: {
      name: "Promotions Bot",
      email: "bot@nulo.lol",
    },
  });

  const remote = `https://catdevnull-bot:${GITHUB_TOKEN}@github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git`;
  await execa("git", ["push", remote, branchName], {
    cwd: dir,
  });

  const prResponse = await octokit.pulls.create({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    title: `Update ${source} promotions for ${date}`,
    head: branchName,
    base: "main",
    body: `Automated PR to update ${source} promotions for ${date}

Run: https://cloud.trigger.dev/orgs/${ctx.organization.slug}/projects/${ctx.project.slug}/env/${ctx.environment.slug}/runs/${ctx.run.id}`,
  });

  // Automatically merge the pull request
  await octokit.pulls.merge({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    pull_number: prResponse.data.number,
    merge_method: "squash",
  });
}
