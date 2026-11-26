import {describe, expect, it} from "vite-plus/test";

import {workspaceSlugProblem} from "./workspace-slug";

describe("workspaceSlugProblem", () => {
  it("accepts IDs like the ones teams use", () => {
    for (const slug of ["myteam2027", "the-night-owls", "ChatotDHHunt", "PHI27test", "a_b"]) {
      expect(workspaceSlugProblem(slug)).toBeNull();
    }
  });
  it("refuses the app's own addresses, in any case", () => {
    for (const slug of ["docs", "API", "Login", "stats", "exchange", "cdn-cgi", "workspaces"]) {
      expect(workspaceSlugProblem(slug)).toMatch(/reserved/);
    }
  });
  it("refuses IDs that wouldn't work as an address", () => {
    for (const slug of ["", "has space", "a/b", "favicon.ico", "-lead", "émile", "x".repeat(41)]) {
      expect(workspaceSlugProblem(slug)).not.toBeNull();
    }
  });
});
