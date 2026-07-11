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

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  });
  await Promise.all(runners);
  return results;
}

async function walkForSkillFiles(root, ignore, limit = 900) {
  const found = [];
  const rootSkillFile = path.join(root, "SKILL.md");
  if (await exists(rootSkillFile)) found.push(rootSkillFile);

  let entries = [];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return found;
  }

  for (const entry of entries) {
    if (found.length >= limit) break;
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(root, entry.name);
    const relPath = entry.name;
    if (ignore(entry.name, relPath, true)) continue;
    const skillFile = path.join(fullPath, "SKILL.md");
    if (await exists(skillFile)) found.push(skillFile);
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

async function collectDirectoryStats(root, ignore, options = {}) {
  const readLines = options.readLines !== false;
  const summary = {
    bytes: 0,
    lines: 0,
    mtimeMs: 0,
    birthtimeMs: Number.POSITIVE_INFINITY,
    mtime: new Date(0),
    birthtime: new Date()
  };

  async function walk(dir) {
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(root, fullPath) || entry.name;
      if (ignore(entry.name, relPath, entry.isDirectory())) continue;
      let stats = null;
      try {
        stats = await fs.stat(fullPath);
      } catch {
        continue;
      }
      if (stats.birthtimeMs < summary.birthtimeMs) {
        summary.birthtimeMs = stats.birthtimeMs;
        summary.birthtime = stats.birthtime;
      }
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        if (stats.mtimeMs > summary.mtimeMs) {
          summary.mtimeMs = stats.mtimeMs;
          summary.mtime = stats.mtime;
        }
        summary.bytes += stats.size;
        if (readLines && stats.size <= 1024 * 1024) {
          try {
            const buffer = await fs.readFile(fullPath);
            if (!buffer.includes(0)) summary.lines += buffer.toString("utf8").split(/\r?\n/).length;
          } catch {
            summary.lines += 0;
          }
        }
      }
    }
  }

  await walk(root);
  if (!Number.isFinite(summary.birthtimeMs)) {
    try {
      const stats = await fs.stat(root);
      summary.birthtime = stats.birthtime;
      summary.birthtimeMs = stats.birthtimeMs;
    } catch {
      summary.birthtime = new Date();
    }
  }
  if (!summary.mtimeMs) {
    try {
      const stats = await fs.stat(root);
      summary.mtime = stats.mtime;
      summary.mtimeMs = stats.mtimeMs;
    } catch {
      summary.mtime = new Date();
    }
  }
  return summary;
}

function firstParagraph(content) {
  return content
    .replace(/^---[\s\S]*?---/, "")
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .find(Boolean) || "";
}

function extractTags(text, data) {
  const explicitTags = [data.tags, data.keywords, data.categories, data.category]
    .flatMap((value) => {
      if (Array.isArray(value)) return value;
      if (typeof value === "string") return value.split(/[,，;；\n]/);
      return [];
    })
    .map((tag) => String(tag || "").trim())
    .filter(Boolean);
  if (explicitTags.length) {
    return [...new Set(explicitTags)].slice(0, 12);
  }

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

async function readSkill(filePath, source, ignore, options = {}) {
  const includeTree = options.includeTree !== false;
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = matter(raw);
  const stats = await fs.stat(filePath);
  const dir = path.dirname(filePath);
  const slug = path.basename(dir);
  const data = parsed.data || {};
  const name = data.name || slug;
  const description = data.description || firstParagraph(parsed.content);
  const tags = extractTags(parsed.content, data);

  const [directory, directoryStats, uninstallMeta] = await Promise.all([
    includeTree ? collectDirectoryTree(dir, ignore) : Promise.resolve({ tree: [], count: 0, truncated: false }),
    collectDirectoryStats(dir, ignore, { readLines: options.fastStats !== true }),
    source.id === "uninstalled"
      ? readJsonIfExists(path.join(dir, ".skill-manager-uninstall.json")).then((meta) => meta || readJsonIfExists(path.join(dir, ".skill-studio-uninstall.json")))
      : Promise.resolve(null)
  ]);

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
    detailLoaded: includeTree,
    tags,
    bytes: directoryStats.bytes || Buffer.byteLength(raw),
    lines: directoryStats.lines || raw.split(/\r?\n/).length,
    createdAt: directoryStats.birthtime.toISOString(),
    updatedAt: directoryStats.mtime.toISOString(),
    trendScore: computeTrendScore({ ...stats, mtimeMs: directoryStats.mtimeMs || stats.mtimeMs, birthtimeMs: directoryStats.birthtimeMs || stats.birthtimeMs }, raw, data),
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
  const sourceResults = await mapLimit(activeSources, 4, async (source) => {
    const sourceDiagnostics = [];
    const sourceSkills = [];
    const ok = await exists(source.root);
    if (!ok) {
      sourceDiagnostics.push({ sourceId: source.id, label: source.label, status: "missing", root: source.root });
      return { diagnostics: sourceDiagnostics, skills: sourceSkills };
    }
    const files = await walkForSkillFiles(source.root, ignore);
    sourceDiagnostics.push({ sourceId: source.id, label: source.label, status: "ok", root: source.root, count: files.length });
    await mapLimit(files, 8, async (file) => {
      try {
        sourceSkills.push(await readSkill(file, source, ignore, {
          includeTree: options.includeTree === true,
          fastStats: options.fastStats !== false
        }));
      } catch (error) {
        sourceDiagnostics.push({ sourceId: source.id, label: source.label, status: "error", root: file, message: error.message });
      }
    });
    return { diagnostics: sourceDiagnostics, skills: sourceSkills };
  });

  const diagnostics = sourceResults.flatMap((result) => result.diagnostics);
  const all = sourceResults.flatMap((result) => result.skills);
  const skills = all.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return {
    scannedAt: new Date().toISOString(),
    sources,
    diagnostics,
    skills,
    trends: buildTrends(skills)
  };
}

async function scanSkillDirectory(skillDir, source = {}, options = {}) {
  const ignore = createIgnoreMatcher(options.ignorePatterns || defaultIgnorePatterns());
  const expandedDir = expandHome(skillDir);
  const skillFile = path.join(expandedDir, "SKILL.md");
  const normalizedSource = {
    id: source.id || "local",
    client: source.client || source.sourceClient || "Local",
    label: source.label || source.sourceLabel || source.client || "Local",
    root: source.root ? expandHome(source.root) : path.dirname(expandedDir)
  };
  return readSkill(skillFile, normalizedSource, ignore, { includeTree: true, fastStats: false });
}

module.exports = { scanSkills, scanSkillDirectory, defaultSources, defaultIgnorePatterns, expandHome };
