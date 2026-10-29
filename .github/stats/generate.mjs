import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { loadConfigFromEnv } from "@stats-organization/github-readme-stats-core";

// These internal interfaces are tied to the exact core version in package.json.
const core = new URL(".", import.meta.resolve("@stats-organization/github-readme-stats-core"));
const { fetchStats } = await import(new URL("fetchers/stats.js", core));
const { renderStatsCard } = await import(new URL("cards/stats.js", core));
const { calculateRank } = await import(new URL("calculateRank.js", core));

const extraRepositories = ["DeepLink-org/Triton_Grouped_GEMM"];

export function includeProjectStars(stats, repositories, username, followers) {
  const projects = new Map();
  for (const repository of repositories) {
    if (repository.private) throw new Error("Only public project stars are supported.");
    // Owned repositories are already included by fetchStats; count each project once.
    if (repository.owner.login.toLowerCase() !== username.toLowerCase()) {
      projects.set(repository.full_name.toLowerCase(), repository.stargazers_count);
    }
  }
  const totalStars = stats.totalStars + [...projects.values()].reduce((sum, stars) => sum + stars, 0);
  return {
    ...stats,
    totalStars,
    rank: calculateRank({
      all_commits: false,
      commits: stats.totalCommits,
      prs: stats.totalPRs,
      reviews: stats.totalReviews,
      issues: stats.totalIssues,
      repos: 0, // Accepted by the library but unused in its ranking formula.
      stars: totalStars,
      followers,
    }),
  };
}

export function renderCard(stats, username) {
  return renderStatsCard(stats, { show_icons: true, number_format: "long" }, username);
}

async function github(path, token) {
  const response = await fetch(`https://api.github.com/${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`GitHub ${path}: HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const username = process.env.GITHUB_REPOSITORY_OWNER;
  const token = process.env.PAT_1;
  if (!username || !token) throw new Error("GITHUB_REPOSITORY_OWNER and PAT_1 are required.");
  loadConfigFromEnv({ ...process.env, FETCH_MULTI_PAGE_STARS: "true" });
  const [base, user, ...projects] = await Promise.all([
    fetchStats(username),
    github(`users/${encodeURIComponent(username)}`, token),
    ...extraRepositories.map((name) => github(`repos/${name}`, token)),
  ]);
  const stats = includeProjectStars(base, projects, username, user.followers);
  const output = new URL("../../profile/stats.svg", import.meta.url);
  await mkdir(new URL(".", output), { recursive: true });
  await writeFile(output, renderCard(stats, username));
  console.log(`Total stars: ${base.totalStars} personal + ${stats.totalStars - base.totalStars} project = ${stats.totalStars}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
