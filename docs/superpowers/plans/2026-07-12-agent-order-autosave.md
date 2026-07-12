# Agent Order and Settings Autosave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every settings-page change persist automatically and make the left Agent navigation follow the user-configured source order, with “All Agents” fixed first.

**Architecture:** Extract deterministic source ordering and list movement into a small ES module tested with Node's built-in test runner. Keep `SettingsPage` as the draft owner, add a serialized latest-value autosave queue, and reuse the existing App/Electron settings IPC for persistence and side effects. Render navigation counts by joining configured sources with scan counts instead of sorting counts.

**Tech Stack:** React 19, Electron 33 IPC, Vite 6, native HTML drag-and-drop, Node `node:test`.

## Global Constraints

- “All Agents” is always rendered separately in the first position and is never draggable.
- Every settings field autosaves; there is no manual Save Settings button.
- Selects, toggles, add/remove, and reorder save immediately; text and numeric inputs debounce for 500 ms.
- Valid JSON objects autosave after 500 ms; invalid JSON never replaces persisted settings.
- Preserve existing uncommitted workspace changes and add no drag-and-drop or test dependency.

---

### Task 1: Deterministic Agent Ordering Utilities

**Files:**
- Create: `src/settings-utils.js`
- Create: `test/settings-utils.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `moveItem(items, fromIndex, toIndex): Array`
- Produces: `orderedAgentCounts(sources, skills): Array<{ id, name, count }>`

- [ ] **Step 1: Write failing utility tests**

Create tests that assert configured enabled sources retain array order, zero-count sources remain visible, unknown scanned clients append after configured sources, disabled sources are omitted, and moving an item is immutable with clamped indices.

```js
import test from "node:test";
import assert from "node:assert/strict";
import { moveItem, orderedAgentCounts } from "../src/settings-utils.js";

test("orderedAgentCounts follows enabled source configuration", () => {
  const sources = [
    { id: "codex", client: "Codex", enabled: true },
    { id: "claude", client: "Claude", enabled: false },
    { id: "agents", client: "Agents", enabled: true }
  ];
  const skills = [{ client: "Agents" }, { client: "Unknown" }, { client: "Agents" }];
  assert.deepEqual(orderedAgentCounts(sources, skills), [
    { id: "codex", name: "Codex", count: 0 },
    { id: "agents", name: "Agents", count: 2 },
    { id: "client:Unknown", name: "Unknown", count: 1 }
  ]);
});

test("moveItem returns a reordered copy", () => {
  const input = ["a", "b", "c"];
  assert.deepEqual(moveItem(input, 0, 2), ["b", "c", "a"]);
  assert.deepEqual(input, ["a", "b", "c"]);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `node --test test/settings-utils.test.js`

Expected: FAIL because `src/settings-utils.js` does not exist.

- [ ] **Step 3: Implement utilities and test script**

Implement immutable movement with invalid-index no-op behavior. Count skills by `client`, emit configured enabled sources first, then append unmatched scanned clients in locale order. Add `"test": "node --test"` to package scripts.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test`

Expected: all utility tests pass.

### Task 2: All-Settings Autosave Pipeline

**Files:**
- Modify: `src/App.jsx` in `SettingsPage` and top-level `saveSettings`

**Interfaces:**
- Consumes: existing `onSave(nextSettings)` callback and `window.skillStudio.saveSettings(settings)` IPC.
- Produces: `SettingsPage` draft changes automatically enqueue normalized settings saves.

- [ ] **Step 1: Add save-return behavior at the App boundary**

Make top-level `saveSettings` return the saved settings on success and rethrow after displaying the existing failure notice. Suppress repetitive success notices so typing does not create notification noise. Keep refresh, language application, API restart, and settings state update in the existing IPC flow.

- [ ] **Step 2: Add serialized latest-value autosave in SettingsPage**

Use refs for mounted state, latest draft revision, active save promise, and pending settings. The queue must serialize calls and, after a save completes, immediately persist any newer pending value. Do not reset draft from an older save result while a newer local revision exists.

- [ ] **Step 3: Route visual controls through immediate or debounced setters**

Add helpers equivalent to:

```js
const applyImmediate = (updater) => updateDraft(updater, { debounce: 0 });
const applyDebounced = (updater) => updateDraft(updater, { debounce: 500 });
```

Use immediate saving for switches, selects, add/remove, retention mode, and Agent enabled state. Use 500 ms saving for Agent text fields, ignore patterns, API port, and retention-day number fields. Remove the Save button and its `Save` icon import.

- [ ] **Step 4: Make JSON mode validate and autosave**

Debounce parsing by 500 ms. Enqueue only JSON objects; show the existing inline error for invalid JSON. Block switching to visual mode while JSON is invalid. When valid, update draft and save through the same queue.

- [ ] **Step 5: Build to catch hook and JSX errors**

Run: `npm run build`

Expected: Vite build completes successfully.

### Task 3: Agent Reordering and Ordered Navigation

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `moveItem` and `orderedAgentCounts` from `src/settings-utils.js`.
- Produces: ordered left navigation and accessible reorder controls in settings.

- [ ] **Step 1: Replace count-based navigation sort**

Import `orderedAgentCounts` and calculate `agentCounts` from `settings.sources` plus `data.skills`. Use stable source IDs as React keys and keep “All Agents” rendered before the mapped rows.

- [ ] **Step 2: Add drag and keyboard/button reorder handlers**

Track the dragged source ID and target row. On drop, call `moveItem`, update `draft.sources`, and immediately autosave. Add a drag handle plus Up/Down icon buttons, disabling them at list boundaries.

- [ ] **Step 3: Add drag-state and compact control styling**

Extend the Agent row grid for a reorder-control column, add visible drag-over state, use `cursor: grab`, and preserve editable field behavior. Include `-webkit-app-region: no-drag` for controls in the Electron window.

- [ ] **Step 4: Run focused tests and production build**

Run: `npm test && npm run build`

Expected: tests pass and Vite build succeeds.

### Task 4: Manual Acceptance and Final Review

**Files:**
- Verify: `src/App.jsx`
- Verify: `src/styles.css`
- Verify: `electron/main.cjs`

**Interfaces:**
- Consumes: completed UI and existing settings IPC.
- Produces: evidence that autosave persists and runtime side effects apply.

- [ ] **Step 1: Run the development app**

Run: `npm start`

Expected: Electron opens without renderer errors.

- [ ] **Step 2: Exercise settings acceptance cases**

Verify language changes immediately, API port changes after a 500 ms pause, toggles/selects save immediately, Agent drag and Up/Down controls update the left navigation, invalid JSON does not save, valid JSON does, and no Save Settings button remains.

- [ ] **Step 3: Restart and verify persistence**

Restart the app and confirm language, port, and Agent order remain unchanged.

- [ ] **Step 4: Review the scoped diff**

Run: `git diff --check && git diff -- src/App.jsx src/styles.css src/settings-utils.js test/settings-utils.test.js package.json`

Expected: no whitespace errors and only scoped implementation changes appear alongside pre-existing user edits.
