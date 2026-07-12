const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const englishPath = path.join(projectRoot, "skills", "skill-manager", "SKILL.md");
const chinesePath = path.join(projectRoot, "skills", "skill-manager-zh", "SKILL.md");

function readSkill(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function frontmatterName(content) {
  return content.match(/^---\n[\s\S]*?^name:\s*([^\n]+)$/m)?.[1]?.trim();
}

function cliCommands(content) {
  return content.split(/\r?\n/).filter((line) => line.startsWith("skill-manager "));
}

test("English and Chinese Skill Manager skills have unique names", () => {
  assert.equal(frontmatterName(readSkill(englishPath)), "skill-manager");
  assert.equal(frontmatterName(readSkill(chinesePath)), "skill-manager-zh");
});

test("language variants use corresponding headings", () => {
  const english = readSkill(englishPath);
  const chinese = readSkill(chinesePath);

  assert.match(english, /^## Core Rule$/m);
  assert.match(english, /^## Workflow$/m);
  assert.match(chinese, /^## 核心规则$/m);
  assert.match(chinese, /^## 工作流$/m);
});

test("language variants expose identical CLI commands", () => {
  const englishCommands = cliCommands(readSkill(englishPath));
  const chineseCommands = cliCommands(readSkill(chinesePath));

  assert.ok(englishCommands.length >= 6);
  assert.deepEqual(chineseCommands, englishCommands);
});

test("both skills hide connection implementation details", () => {
  const forbidden = /19010|curl|\/api\/|SKILL_MANAGER_API_URL|https?:\/\//;

  assert.doesNotMatch(readSkill(englishPath), forbidden);
  assert.doesNotMatch(readSkill(chinesePath), forbidden);
});
