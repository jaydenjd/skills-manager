# Bilingual Skill Manager Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship independently installable English and Chinese Skill Manager Agent Skills with equivalent CLI behavior and separate version histories.

**Architecture:** Keep two explicit SKILL.md files with different names and translated prose. Add a Node test that parses frontmatter, fenced CLI blocks, headings, and forbidden connection details so language variants cannot drift behaviorally. Install both under Codex and publish each independently through the Skill Manager CLI.

**Tech Stack:** Markdown Agent Skills, Node `node:test`, Skill Manager CLI.

## Global Constraints

- English name is `skill-manager`; Chinese name is `skill-manager-zh`.
- Commands, paths, options, workflow semantics, and conflict rules are equivalent.
- Both Skills are CLI-only and contain no fixed port, curl, HTTP endpoint, or local API environment variable.
- English and Chinese Skills have independent version histories.
- Preserve unrelated workspace changes.

---

### Task 1: Bilingual Contract Test

**Files:**
- Create: `test/bilingual-skill-manager.test.cjs`
- Test: `skills/skill-manager/SKILL.md`
- Test: `skills/skill-manager-zh/SKILL.md`

**Interfaces:**
- Produces: regression checks for unique names, required sections, identical CLI command lines, and forbidden connection details.

- [ ] **Step 1: Write the failing test**

Read both SKILL.md files. Assert `name` is `skill-manager` and `skill-manager-zh`, English text contains `Core Rule` and `Workflow`, Chinese text contains `核心规则` and `工作流`, extracted lines beginning with `skill-manager ` are deeply equal, and neither document matches connection-detail patterns.

- [ ] **Step 2: Run the focused test to verify RED**

Run: `node --test test/bilingual-skill-manager.test.cjs`

Expected: FAIL because `skills/skill-manager-zh/SKILL.md` does not exist.

### Task 2: Create Equivalent English and Chinese Skills

**Files:**
- Modify: `skills/skill-manager/SKILL.md`
- Create: `skills/skill-manager-zh/SKILL.md`

**Interfaces:**
- Consumes: existing CLI-only English Skill.
- Produces: two built-in Skills with equivalent commands and translated prose.

- [ ] **Step 1: Refine the English Skill**

Keep `name: skill-manager`, preserve CLI-only rules, and use clear English headings and release-ready prose. Do not manually increment the version before publishing.

- [ ] **Step 2: Create the Chinese Skill**

Create `name: skill-manager-zh` with simplified-Chinese description, headings, explanations, workflow, and conflict guidance. Copy command and path blocks exactly from the English version.

- [ ] **Step 3: Run the focused and full tests to verify GREEN**

Run: `node --test test/bilingual-skill-manager.test.cjs && npm test`

Expected: bilingual checks and all existing tests pass.

### Task 3: Install Both Codex Copies

**Files:**
- Modify: `/Users/wu/.codex/skills/skill-manager/SKILL.md`
- Create: `/Users/wu/.codex/skills/skill-manager-zh/SKILL.md`

**Interfaces:**
- Consumes: project built-in bilingual Skills.
- Produces: corresponding Codex-installed Skills ready for independent publication.

- [ ] **Step 1: Synchronize the English copy**

Update the installed English content to match the built-in English content before publication.

- [ ] **Step 2: Install the Chinese copy through CLI**

Run:

```bash
bin/skill-manager install-local --dir /Users/wu/skill-studio/skills/skill-manager-zh --agent Codex --conflict replace
```

Expected: Codex receives `~/.codex/skills/skill-manager-zh` through Skill Manager lifecycle handling.

- [ ] **Step 3: Verify installed names and semantic checks**

Run the bilingual test against built-in files, compare each installed copy with its built-in source, and use `bin/skill-manager scan --scope installed` to confirm both names appear under Codex.

### Task 4: Publish Independent Versions

**Files:**
- Modify through publishing: `/Users/wu/.codex/skills/skill-manager/SKILL.md`
- Modify through publishing: `/Users/wu/.codex/skills/skill-manager-zh/SKILL.md`
- Synchronize versions: `skills/skill-manager/SKILL.md`
- Synchronize versions: `skills/skill-manager-zh/SKILL.md`

**Interfaces:**
- Consumes: installed bilingual Skills.
- Produces: independent active Skill Manager versions and release notes.

- [ ] **Step 1: Publish English**

Run:

```bash
bin/skill-manager publish --agent Codex --skill skill-manager --message "Add a matching Chinese Skill while keeping the English edition CLI-only."
```

- [ ] **Step 2: Publish Chinese**

Run:

```bash
bin/skill-manager publish --agent Codex --skill skill-manager-zh --message "新增与英文版能力一致的 Skill Manager 中文版。"
```

- [ ] **Step 3: Synchronize published version fields**

Copy only the resulting version value from each installed frontmatter into its corresponding built-in Skill so packaged and installed content remain aligned.

- [ ] **Step 4: Run final verification**

Run: `npm test && npm run build && git diff --check`, then scan installed Skills through CLI and confirm both versions, paths, and names.
