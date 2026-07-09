const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const matter = require("gray-matter");

function expandHome(input) {
  if (!input) return input;
  return input.replace(/^~(?=$|\/|\\)/, os.homedir());
}

function defaultSources() {
  const home = os.homedir();
  return [
    { id: "codex-user", client: "Codex", label: "Codex 用户 Skills", root: path.join(home, ".codex/skills"), enabled: true },
    { id: "agents", client: "Agents", label: "Agents Skills", root: path.join(home, ".agents/skills"), enabled: true },
    { id: "claude", client: "Claude", label: "Claude Skills", root: path.join(home, ".claude/skills"), enabled: true },
    { id: "qoder", client: "Qoder", label: "Qoder Skills", root: path.join(home, ".qoder/skills"), enabled: true },
    { id: "qoderwork", client: "QoderWork", label: "QoderWork Skills", root: path.join(home, ".qoderwork/skills"), enabled: true },
    { id: "openclaw", client: "OpenClaw", label: "OpenClaw Skills", root: path.join(home, ".openclaw/skills"), enabled: true }
  ];
}

function defaultIgnorePatterns() {
  return [
    ".git/",
    "node_modules/",
    ".DS_Store",
    ".skill-manager-uninstall.json",
    ".skill-studio-uninstall.json",
    "__pycache__/",
    "*.pyc",
    "*.pyo",
    "*.log"
  ];
}

function normalizePatterns(patterns = []) {
  return [".skill-manager-uninstall.json", ".skill-studio-uninstall.json", ...patterns]
    .flatMap((pattern) => String(pattern || "").split(/\r?\n/))
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern && !pattern.startsWith("#"));
}

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
}

function createIgnoreMatcher(patterns = defaultIgnorePatterns()) {
  const rules = normalizePatterns(patterns);
  return (entryName, relPath, isDirectory) => {
    const normalized = relPath.split(path.sep).join("/");
    return rules.some((rule) => {
      const directoryRule = rule.endsWith("/");
      const cleanRule = directoryRule ? rule.slice(0, -1) : rule;
      if (directoryRule && !isDirectory) return false;
      if (cleanRule.includes("/")) return globToRegExp(cleanRule).test(normalized);
      return globToRegExp(cleanRule).test(entryName) || normalized.split("/").includes(cleanRule);
    });
  };
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function walkForSkillFiles(root, ignore, limit = 900) {
  const found = [];
  const queue = [root];
  while (queue.length && found.length < limit) {
    const current = queue.shift();
    let entries = [];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const relPath = path.relative(root, fullPath) || entry.name;
      if (ignore(entry.name, relPath, entry.isDirectory())) continue;
      if (entry.isDirectory()) queue.push(fullPath);
      if (entry.isFile() && entry.name === "SKILL.md") found.push(fullPath);
      if (found.length >= limit) break;
    }
  }
  return found;
}

async function collectDirectoryTree(root, ignore, limit = 1200) {
  let count = 0;

  async function readDir(dir, depth) {
    if (count >= limit) return [];
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }

    const nodes = [];
    for (const entry of entries
      .filter((entry) => {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(root, fullPath) || entry.name;
        return !ignore(entry.name, relPath, entry.isDirectory());
      })
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))) {
      if (count >= limit) break;
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(root, fullPath) || entry.name;
      count += 1;
      const node = {
        name: entry.name,
        path: fullPath,
        relPath,
        depth,
        type: entry.isDirectory() ? "directory" : "file",
        children: []
      };
      if (entry.isDirectory() && depth < 10) node.children = await readDir(fullPath, depth + 1);
      nodes.push(node);
    }
    return nodes;
  }

  const tree = await readDir(root, 0);
  return { tree, count, truncated: count >= limit };
}

function firstParagraph(content) {
  return content
    .replace(/^---[\s\S]*?---/, "")
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .find(Boolean) || "";
}

function extractTags(text, data) {
  const pool = `${data.name || ""} ${data.description || ""} ${text}`.toLowerCase();
  const dictionary = [
    "frontend", "design", "browser", "chrome", "pdf", "docx", "pptx", "spreadsheet",
    "search", "wechat", "image", "diagram", "mcp", "api", "agent", "code", "review",
    "testing", "debug", "paper", "translate", "cli", "database", "logs", "deploy"
  ];
  return dictionary.filter((tag) => pool.includes(tag)).slice(0, 6);
}

function computeTrendScore(stats, content, data) {
  const now = Date.now();
  const daysSinceChange = Math.max(1, (now - stats.mtimeMs) / 86400000);
  const daysSinceCreate = Math.max(1, (now - stats.birthtimeMs) / 86400000);
  const recency = 100 / Math.sqrt(daysSinceChange);
  const newness = 42 / Math.sqrt(daysSinceCreate);
  const completeness = Math.min(28, content.length / 600);
  const described = data.description ? 16 : 0;
  return Math.round(recency + newness + completeness + described);
}

async function readSkill(filePath, source, ignore) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = matter(raw);
  const stats = await fs.stat(filePath);
  const dir = path.dirname(filePath);
  const slug = path.basename(dir);
  const data = parsed.data || {};
  const name = data.name || slug;
  const description = data.description || firstParagraph(parsed.content);
  const tags = extractTags(parsed.content, data);

  const directory = await collectDirectoryTree(dir, ignore);
  const uninstallMeta = source.id === "uninstalled"
    ? (await readJsonIfExists(path.join(dir, ".skill-manager-uninstall.json")) || await readJsonIfExists(path.join(dir, ".skill-studio-uninstall.json")))
    : null;

  return {
    id: `${source.id}:${filePath}`,
    name,
    slug,
    description,
    client: source.client,
    sourceId: source.id,
    sourceLabel: source.label,
    root: source.root,
    dir,
    filePath,
    license: data.license || "",
    version: data.version || data.Version || data.metadata?.version || "",
    frontmatter: data,
    uninstallMeta,
    content: parsed.content.trim(),
    raw,
    directoryTree: directory.tree,
    directoryCount: directory.count,
    directoryTruncated: directory.truncated,
    tags,
    bytes: Buffer.byteLength(raw),
    lines: raw.split(/\r?\n/).length,
    createdAt: stats.birthtime.toISOString(),
    updatedAt: stats.mtime.toISOString(),
    trendScore: computeTrendScore(stats, raw, data),
    excerpt: parsed.content.split(/\r?\n/).slice(0, 18).join("\n")
  };
}

function buildTrends(skills) {
  const tagCounts = new Map();
  const sourceCounts = new Map();
  for (const skill of skills) {
    sourceCounts.set(skill.client, (sourceCounts.get(skill.client) || 0) + 1);
    for (const tag of skill.tags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }
  return {
    hotSkills: [...skills].sort((a, b) => b.trendScore - a.trendScore).slice(0, 12),
    hotTags: [...tagCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 14),
    sources: [...sourceCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  };
}

async function scanSkills(inputSources, options = {}) {
  const ignore = createIgnoreMatcher(options.ignorePatterns || defaultIgnorePatterns());
  const sources = inputSources.map((source) => ({ ...source, root: expandHome(source.root) }));
  const activeSources = sources.filter((source) => source.enabled);
  const all = [];
  const diagnostics = [];

  for (const source of activeSources) {
    const ok = await exists(source.root);
    if (!ok) {
      diagnostics.push({ sourceId: source.id, label: source.label, status: "missing", root: source.root });
      continue;
    }
    const files = await walkForSkillFiles(source.root, ignore);
    diagnostics.push({ sourceId: source.id, label: source.label, status: "ok", root: source.root, count: files.length });
    for (const file of files) {
      try {
        all.push(await readSkill(file, source, ignore));
      } catch (error) {
        diagnostics.push({ sourceId: source.id, label: source.label, status: "error", root: file, message: error.message });
      }
    }
  }

  const skills = all.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return {
    scannedAt: new Date().toISOString(),
    sources,
    diagnostics,
    skills,
    trends: buildTrends(skills)
  };
}

module.exports = { scanSkills, defaultSources, defaultIgnorePatterns, expandHome };
