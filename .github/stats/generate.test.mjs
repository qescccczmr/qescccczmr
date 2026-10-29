import assert from "node:assert/strict";
import test from "node:test";
import { includeProjectStars, renderCard } from "./generate.mjs";

const base = {
  name: "qescccczmr", totalStars: 3, totalCommits: 35, totalPRs: 27,
  totalReviews: 0, totalIssues: 4, contributedTo: 10,
};
const project = {
  full_name: "DeepLink-org/Triton_Grouped_GEMM", owner: { login: "DeepLink-org" },
  stargazers_count: 10, private: false,
};

test("adds project stars and updates both the visible and accessible card totals", () => {
  const original = includeProjectStars(base, [], "qescccczmr", 17);
  const updated = includeProjectStars(base, [project], "qescccczmr", 17);
  assert.equal(updated.totalStars, 13);
  assert.equal(base.totalStars, 3);
  assert.equal(updated.totalPRs, base.totalPRs);
  assert.ok(updated.rank.percentile < original.rank.percentile);
  const svg = renderCard(updated, "qescccczmr");
  assert.match(svg, /Total Stars Earned: 13/);
  assert.match(svg, /data-testid="stars"\s*>13<\/text>/);
});

test("does not double count duplicate projects or personally owned repositories", () => {
  const own = { ...project, full_name: "qescccczmr/DeepGEMM", owner: { login: "QESCCCCZMR" } };
  const duplicate = { ...project, full_name: project.full_name.toLowerCase() };
  assert.equal(includeProjectStars(base, [project, duplicate, own], "qescccczmr", 17).totalStars, 13);
});

test("reads fresh counts each run and rejects private projects", () => {
  assert.equal(includeProjectStars(base, [{ ...project, stargazers_count: 11 }], "qescccczmr", 17).totalStars, 14);
  assert.throws(() => includeProjectStars(base, [{ ...project, private: true }], "qescccczmr", 17));
});
