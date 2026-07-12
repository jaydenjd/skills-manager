import test from "node:test";
import assert from "node:assert/strict";

import { moveItem, orderedAgentCounts } from "../src/settings-utils.js";

test("orderedAgentCounts follows enabled source configuration", () => {
  const sources = [
    { id: "codex", client: "Codex", enabled: true },
    { id: "claude", client: "Claude", enabled: false },
    { id: "agents", client: "Agents", enabled: true }
  ];
  const skills = [
    { client: "Agents" },
    { client: "Unknown" },
    { client: "Agents" }
  ];

  assert.deepEqual(orderedAgentCounts(sources, skills), [
    { id: "codex", name: "Codex", count: 0 },
    { id: "agents", name: "Agents", count: 2 },
    { id: "client:Unknown", name: "Unknown", count: 1 }
  ]);
});

test("orderedAgentCounts keeps duplicate client names out of fallback entries", () => {
  const sources = [
    { id: "first", client: "Shared", enabled: true },
    { id: "second", client: "Shared", enabled: true }
  ];

  assert.deepEqual(orderedAgentCounts(sources, [{ client: "Shared" }]), [
    { id: "first", name: "Shared", count: 1 },
    { id: "second", name: "Shared", count: 1 }
  ]);
});

test("moveItem returns a reordered copy and preserves the input", () => {
  const input = ["a", "b", "c"];

  assert.deepEqual(moveItem(input, 0, 2), ["b", "c", "a"]);
  assert.deepEqual(input, ["a", "b", "c"]);
});

test("moveItem clamps the target and ignores an invalid source index", () => {
  assert.deepEqual(moveItem(["a", "b", "c"], 1, 99), ["a", "c", "b"]);
  assert.deepEqual(moveItem(["a", "b", "c"], -1, 1), ["a", "b", "c"]);
});
