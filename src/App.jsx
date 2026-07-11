import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Command,
  Edit3,
  ExternalLink,
  Eye,
  FileCode2,
  FileText,
  FolderOpen,
  Github,
  History,
  ListTree,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tags
} from "lucide-react";
import "./styles.css";

const fmt = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});
const starStorageKey = "skill-manager-stars";
const legacyStarStorageKey = "skill-studio-stars";
const installTargetsStorageKey = "skill-manager-last-install-targets";
const legacyInstallTargetsStorageKey = "skill-studio-last-install-targets";
const baselineOverridesStorageKey = "skill-manager-baseline-overrides";
const scanCacheStorageKey = "skill-manager-last-scan";

function readStoredJson(primaryKey, legacyKey, fallback) {
  const primary = localStorage.getItem(primaryKey);
  const legacy = primary === null && legacyKey ? localStorage.getItem(legacyKey) : null;
  const raw = primary ?? legacy;
  if (raw === null) return fallback;
  try {
    const value = JSON.parse(raw);
    if (legacy !== null) localStorage.setItem(primaryKey, raw);
    return value;
  } catch {
    return fallback;
  }
}

function formatDate(value) {
  return value ? fmt.format(new Date(value)) : "-";
}

function shortPath(path) {
  return path?.replace(/^\/Users\/[^/]+/, "~") || "";
}

function parentPath(filePath = "") {
  const normalized = String(filePath || "").replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  return index > 0 ? normalized.slice(0, index) : normalized;
}

function copyRelativePath(copy, filePath) {
  if (!copy?.dir || !filePath) return "SKILL.md";
  const root = copy.dir.replace(/\/+$/, "");
  if (!filePath.startsWith(root)) return "SKILL.md";
  return filePath.slice(root.length).replace(/^\/+/, "") || "SKILL.md";
}

function copyFilePath(copy, relativePath) {
  const root = copy?.dir?.replace(/\/+$/, "") || "";
  return `${root}/${relativePath || "SKILL.md"}`;
}

function starKey(type, item) {
  return `${type}:${item?.id || item?.filePath || item?.dir || item?.url || item?.name}`;
}

function starSnapshot(type, item) {
  return {
    type,
    key: starKey(type, item),
    item
  };
}

function normalizeSkillName(value = "") {
  return String(value).trim().toLowerCase();
}

function isDiscoverUpdateAvailable(item, installedSkills = []) {
  if (!installedSkills.length) return false;
  const remoteVersion = skillVersion(item);
  if (!remoteVersion) return false;
  return installedSkills.some((skill) => {
    const localVersion = skillVersion(skill);
    return localVersion && localVersion !== remoteVersion;
  });
}

function skillVersion(item = {}) {
  const value = item.version
    || item.latestVersion
    || item.metadata?.version
    || item.frontmatter?.version
    || item.frontmatter?.Version
    || item.frontmatter?.metadata?.version
    || "";
  return value === undefined || value === null ? "" : String(value).trim();
}

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString() : "0";
}

function matchesSearchFields(values, query) {
  if (!query) return true;
  return values.filter(Boolean).join(" ").toLowerCase().includes(query);
}

function localSkillSearchValues(skill, options) {
  const values = [];
  if (options.name) values.push(skill.name, skill.slug);
  if (options.description) values.push(skill.description);
  if (options.tags) values.push(skill.client, skill.sourceLabel, skill.tags?.join(" "));
  if (options.path) values.push(skill.filePath, skill.dir);
  if (options.content) values.push(skill.content, skill.raw, skill.excerpt);
  return values;
}

function discoverSearchValues(item, options) {
  const values = [];
  if (options.name) values.push(item.name, item.fullName, item.sourceName);
  if (options.description) values.push(item.description);
  if (options.tags) values.push(item.language, item.sourceLabel, item.installsLabel, item.weeklyLabel);
  if (options.path) values.push(item.url, item.repositoryUrl);
  return values;
}

function skillGroupKey(skill) {
  return normalizeSkillName(skill?.frontmatter?.name || skill?.name || skill?.slug || skill?.dir);
}

function mergeSkillCopies(skills = []) {
  const groups = new Map();
  for (const skill of skills) {
    const key = skillGroupKey(skill);
    const list = groups.get(key) || [];
    list.push(skill);
    groups.set(key, list);
  }
  return [...groups.values()].map((copies) => {
    const sorted = [...copies].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const primary = sorted[0];
    return {
      ...primary,
      id: `merged:${skillGroupKey(primary)}:${sorted.map((skill) => skill.id).join("|")}`,
      installations: sorted,
      installationCount: sorted.length,
      merged: sorted.length > 1
    };
  });
}

function frontmatterEntries(frontmatter = {}) {
  return Object.entries(frontmatter).filter(([, value]) => value !== "" && value !== null && value !== undefined);
}

function parseFrontmatterText(raw = "") {
  if (!raw.startsWith("---")) return { frontmatter: {}, body: raw };
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: {}, body: raw };
  const frontmatter = {};
  match[1].split(/\r?\n/).forEach((line) => {
    const pair = line.match(/^([^:#]+):\s*(.*)$/);
    if (pair) frontmatter[pair[1].trim()] = pair[2].trim().replace(/^["']|["']$/g, "");
  });
  return { frontmatter, body: raw.slice(match[0].length) };
}

function isMarkdownPath(filePath = "") {
  return /\.(md|markdown|mdx)$/i.test(filePath);
}

function codeLanguageFromPath(filePath = "") {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const map = {
    py: "python",
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    json: "json",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    css: "css",
    html: "html",
    yml: "yaml",
    yaml: "yaml",
    toml: "toml"
  };
  return map[ext] || "text";
}

function highlightCode(text = "", language = "text") {
  const source = String(text || "");
  const patterns = language === "python" ? [
    ["comment", /#.*/y],
    ["string", /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/y],
    ["keyword", /\b(?:and|as|assert|async|await|break|class|continue|def|del|elif|else|except|False|finally|for|from|global|if|import|in|is|lambda|None|nonlocal|not|or|pass|raise|return|True|try|while|with|yield)\b/y],
    ["number", /\b\d+(?:\.\d+)?\b/y],
    ["function", /\b[A-Za-z_][\w]*(?=\s*\()/y]
  ] : language === "json" ? [
    ["string", /"(?:\\.|[^"\\])*"(?=\s*:)?/y],
    ["number", /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/iy],
    ["keyword", /\b(?:true|false|null)\b/y]
  ] : language === "bash" ? [
    ["comment", /#.*/y],
    ["string", /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y],
    ["keyword", /\b(?:if|then|else|elif|fi|for|while|do|done|case|esac|function|in|export|local)\b/y],
    ["number", /\b\d+\b/y]
  ] : [
    ["comment", /\/\/.*|\/\*[\s\S]*?\*\//y],
    ["string", /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y],
    ["keyword", /\b(?:async|await|break|case|catch|class|const|continue|default|else|export|extends|finally|for|from|function|if|import|let|new|null|return|switch|throw|try|undefined|var|while|yield|true|false)\b/y],
    ["number", /\b\d+(?:\.\d+)?\b/y],
    ["function", /\b[A-Za-z_$][\w$]*(?=\s*\()/y]
  ];
  const parts = [];
  let index = 0;
  while (index < source.length) {
    let matched = null;
    for (const [type, regex] of patterns) {
      regex.lastIndex = index;
      const match = regex.exec(source);
      if (match && match.index === index) {
        matched = { type, text: match[0] };
        break;
      }
    }
    if (matched) {
      parts.push(<span key={index} className={`tok-${matched.type}`}>{matched.text}</span>);
      index += matched.text.length;
    } else {
      parts.push(source[index]);
      index += 1;
    }
  }
  return parts;
}

function flattenTreeNodes(items = []) {
  const result = [];
  function walk(nodes) {
    nodes.forEach((node) => {
      result.push(node);
      if (node.children?.length) walk(node.children);
    });
  }
  walk(items);
  return result;
}

function countTree(nodes = []) {
  return nodes.reduce((total, node) => total + 1 + countTree(node.children || []), 0);
}

function tagTone(tag = "") {
  const tones = [
    { bg: "#e9f7d7", border: "#9fcf4c", fg: "#355315" },
    { bg: "#e2f3ff", border: "#76b7df", fg: "#17465f" },
    { bg: "#fff0cc", border: "#dfb24e", fg: "#684712" },
    { bg: "#ffe4dc", border: "#e58d72", fg: "#7a2b1c" },
    { bg: "#e9e6ff", border: "#9a8de4", fg: "#31266f" },
    { bg: "#ddf7ef", border: "#63b99e", fg: "#14513e" },
    { bg: "#f4e5ff", border: "#bd8adc", fg: "#5a2574" },
    { bg: "#edf0d5", border: "#aab65b", fg: "#454d17" }
  ];
  const hash = String(tag).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return tones[hash % tones.length];
}

function TagPill({ tag, as = "span", className = "", onClick, children }) {
  const Component = as;
  const tone = tagTone(tag);
  return (
    <Component
      className={`tag-pill ${className}`}
      style={{ "--tag-bg": tone.bg, "--tag-border": tone.border, "--tag-fg": tone.fg }}
      onClick={onClick}
    >
      {children || tag}
    </Component>
  );
}

function buildLineDiff(previous = "", current = "") {
  const oldLines = previous.split(/\r?\n/);
  const newLines = current.split(/\r?\n/);
  const dp = Array.from({ length: oldLines.length + 1 }, () => Array(newLines.length + 1).fill(0));
  for (let i = oldLines.length - 1; i >= 0; i -= 1) {
    for (let j = newLines.length - 1; j >= 0; j -= 1) {
      dp[i][j] = oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const rows = [];
  let i = 0;
  let j = 0;
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      rows.push({ type: "same", line: oldLines[i] });
      i += 1;
      j += 1;
    } else if (j < newLines.length && (i === oldLines.length || dp[i][j + 1] >= dp[i + 1][j])) {
      rows.push({ type: "added", line: newLines[j] });
      j += 1;
    } else {
      rows.push({ type: "removed", line: oldLines[i] });
      i += 1;
    }
  }
  return rows;
}

function renderInline(text) {
  const parts = String(text).split(/(`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function parseMarkdownBlocks(text = "") {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: "code", lang, text: code.join("\n") });
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "ordered", items });
      continue;
    }

    if (line.startsWith(">")) {
      const quote = [];
      while (index < lines.length && lines[index].startsWith(">")) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", text: quote.join(" ") });
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,4})\s+/.test(lines[index]) && !lines[index].startsWith("```") && !/^\s*[-*]\s+/.test(lines[index]) && !/^\s*\d+\.\s+/.test(lines[index]) && !lines[index].startsWith(">")) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }
  return blocks;
}

function useSkillData() {
  const [data, setData] = useState(() => readStoredJson(scanCacheStorageKey, null, null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const result = await window.skillStudio.scan();
      setData(result);
      localStorage.setItem(scanCacheStorageKey, JSON.stringify(result));
      return result;
    } catch (err) {
      setError(err.message || String(err));
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return { data, loading, error, refresh };
}

function useGithubTrends(source) {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef(new Map());

  async function refresh() {
    setLoading(true);
    setError("");
    setItems(cacheRef.current.get(source)?.items || []);
    setMeta(cacheRef.current.get(source)?.meta || {});
    try {
      const result = await window.skillStudio.githubTrends(source);
      if (Array.isArray(result)) {
        setItems(result);
        setMeta({});
        cacheRef.current.set(source, { items: result, meta: {} });
      } else {
        setItems((current) => result.items?.length ? result.items : current);
        setMeta(result);
        if (result.items?.length) cacheRef.current.set(source, { items: result.items, meta: result });
        if (result.stale && result.error) setError(result.error);
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [source]);

  return { items, meta, error, loading, refresh };
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="metric">
      <Icon size={17} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SourcePill({ source, diagnostic }) {
  const active = diagnostic?.status === "ok";
  return (
    <div className={`source-pill ${active ? "active" : "muted"}`}>
      <div>
        <strong>{source.client}</strong>
        <span>{source.label}</span>
      </div>
      <em>{active ? diagnostic.count : "未发现"}</em>
    </div>
  );
}

function NavRow({ icon: Icon, label, count, active, onClick }) {
  return (
    <button className={`nav-row ${active ? "active" : ""}`} onClick={onClick}>
      <Icon size={17} />
      <span>{label}</span>
      {count !== "" ? <em>{count}</em> : null}
    </button>
  );
}

function CountRow({ label, count, active, onClick }) {
  return (
    <button className={`count-row ${active ? "active" : ""}`} onClick={onClick}>
      <span>{label}</span>
      <em>{count}</em>
    </button>
  );
}

function StarButton({ active, onClick, className = "", label = false }) {
  return (
    <button className={`star-button ${className} ${active ? "active" : ""}`} onClick={onClick} title={active ? "取消 Star" : "Star"}>
      <Star size={16} />
      {label ? <span>{active ? "Starred" : "Star"}</span> : null}
    </button>
  );
}

function MetaStrip({ items, className = "" }) {
  const visible = items.filter((item) => item?.value !== undefined && item?.value !== null && item?.value !== "");
  if (!visible.length) return null;
  return (
    <div className={`meta-strip ${className}`}>
      {visible.map((item) => (
        <span key={item.label}>
          <b>{item.label}</b>
          <em>{item.value}</em>
        </span>
      ))}
    </div>
  );
}

function SkillManagerLogo() {
  return (
    <div className="skill-manager-logo" aria-hidden="true">
      <span />
      <span />
      <span />
      <i />
    </div>
  );
}

function SkillRow({ skill, selected, onSelect, actionLabel, onAction, busy, starred, onStar }) {
  const actionClass = actionLabel === "Uninstall" ? "action-uninstall" : "action-install";
  const copies = skill.installations || [skill];
  const copyAgents = [...new Set(copies.map((copy) => copy.client))];
  const version = skillVersion(skill);
  return (
    <div className={`skill-row ${selected ? "selected" : ""}`} onClick={() => onSelect(skill)}>
      <StarButton active={starred} className="row-star" onClick={(event) => { event.stopPropagation(); onStar(skill); }} />
      <div className="row-main">
        <div className="skill-glyph">{skill.name.slice(0, 1).toUpperCase()}</div>
        <div>
          <div className="row-title">
            <strong>{skill.name}</strong>
            {version ? <span className="version-badge">v{version}</span> : null}
          </div>
          <div className="row-source">{skill.merged ? `${copyAgents.join(", ")} · ${copies.length} copies` : skill.client}</div>
          <p>{skill.description || "暂无描述"}</p>
        </div>
      </div>
      <div className="row-meta">
        <span>更新 {formatDate(skill.updatedAt)}</span>
        {actionLabel ? (
          <button className={actionClass} disabled={busy} onClick={(event) => { event.stopPropagation(); onAction(skill); }}>
            {busy ? "处理中" : actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DiscoverRow({ item, index, selected, onSelect, onInstall, onUninstall, busy, starred, onStar, installedSkills = [] }) {
  const popularity = item.installsLabel ? `${item.installsLabel} installs` : `★ ${formatNumber(item.stars)}`;
  const sourceName = item.sourceName || item.fullName;
  const version = skillVersion(item);
  const installedAgents = [...new Set(installedSkills.map((skill) => skill.client))];
  const updateAvailable = isDiscoverUpdateAvailable(item, installedSkills);
  const actionLabel = installedSkills.length ? (updateAvailable ? "Update" : "Uninstall") : "Install";
  const actionClass = updateAvailable ? "action-update" : installedSkills.length ? "action-uninstall" : "action-install";
  return (
    <div className={`discover-row ${selected ? "selected" : ""}`} onClick={() => onSelect(item)}>
      <StarButton active={starred} className="row-star" onClick={(event) => { event.stopPropagation(); onStar(item); }} />
      <div className="discover-rank">{index + 1}</div>
      <div>
        <div className="row-title">
          <strong>{item.name}</strong>
          {version ? <span className="version-badge">v{version}</span> : null}
        </div>
        <div className="row-source">{sourceName}</div>
        <p>{item.description || "暂无描述"}</p>
      </div>
      <div className="row-meta">
        <span>{installedAgents.length ? `已安装：${installedAgents.join(", ")}` : `${sourceName} · ${popularity}${item.weeklyLabel ? ` · 8W ${item.weeklyLabel}` : ""}`}</span>
        <button className={actionClass} disabled={busy} onClick={(event) => { event.stopPropagation(); installedSkills.length && !updateAvailable ? onUninstall(item, installedSkills) : onInstall(item, updateAvailable); }}>
          {busy ? "处理中" : actionLabel}
        </button>
      </div>
    </div>
  );
}

const loadingSayings = [
  "好 skill 值得多等半拍。",
  "正在翻目录，顺手把灰尘也吹掉。",
  "把散落在各个 Agent 里的 skill 排好队。",
  "本地知识正在集合，马上到齐。",
  "扫描中：只认一级目录里的 SKILL.md。",
  "给每个 skill 找到它真正住的地方。",
  "慢一点点，是为了少一点点误判。",
  "正在从 skills.sh 捞出新鲜线索。",
  "让目录树先跑一会儿。",
  "把版本、标签和来源捋顺中。"
];

function randomLoadingSaying(seed = "") {
  let hash = 0;
  for (const char of seed) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  const randomPart = Math.floor(Math.random() * loadingSayings.length);
  return loadingSayings[Math.abs(hash + randomPart) % loadingSayings.length];
}

function LoadingMoment({ title, seed = "", compact = false }) {
  const saying = useMemo(() => randomLoadingSaying(seed), [seed]);
  return (
    <div className={`loading-moment ${compact ? "compact" : ""}`}>
      <div className="loading-orbit" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div>
        <strong>{title}</strong>
        <p>{saying}</p>
      </div>
    </div>
  );
}

function EmptyList({ mode, scanning = false }) {
  if (scanning && mode === "installed") {
    return <LoadingMoment title="本地 skills 扫描中" seed="installed-scan" />;
  }
  if (scanning && mode === "discover") {
    return <LoadingMoment title="正在加载 skills.sh" seed="discover-scan" />;
  }
  const text = mode === "uninstalled"
    ? "Uninstalled 里还没有可恢复的 skill。"
    : mode === "starred"
      ? "Starred 里还没有收藏的 skill。"
      : mode === "discover"
        ? "当前 Discover 条件下没有匹配结果。"
        : mode === "tags"
          ? "当前还没有可统计的标签。"
          : "当前条件下没有本地 skill。";
  return <div className="list-empty">{text}</div>;
}

function DiscoverDetail({ item, onInstall, onUninstall, busy, starred, onStar, installedSkills = [] }) {
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!item) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetail(null);
    window.skillStudio.discoverDetail(item)
      .then((result) => {
        if (!cancelled) setDetail(result || {});
      })
      .catch(() => {
        if (!cancelled) setDetail({});
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item?.id]);

  if (!item) {
    return (
      <section className="detail empty">
        <Sparkles size={34} />
        <p>选择一个 Discover skill 查看来源、热度、仓库和安装信息。</p>
      </section>
    );
  }
  const sourceName = item.sourceName || item.fullName;
  const summaryLead = detail?.summaryLead || item.description || "";
  const summaryItems = detail?.summaryItems || [];
  const installCommand = detail?.installCommand || item.installCommand || `git clone --depth 1 ${item.url}`;
  const installedAgents = [...new Set(installedSkills.map((skill) => skill.client))];
  const updateAvailable = isDiscoverUpdateAvailable(item, installedSkills);
  const version = skillVersion(item);

  return (
    <section className="detail discover-detail">
      <div className="detail-header">
        <div className="detail-icon github-icon"><Github size={24} /></div>
        <div>
          <h2>{item.name}</h2>
          <p>{item.description || "暂无描述"}</p>
          <div className="detail-source-line">
            <span>{sourceName}</span>
            <span>skills.sh</span>
          </div>
        </div>
      </div>
      <div className="detail-actions">
        {installedSkills.length ? (
          <button className={updateAvailable ? "action-update" : "action-uninstall"} onClick={() => updateAvailable ? onInstall(item, true) : onUninstall(item, installedSkills)} disabled={busy}>
            <RotateCcw size={16} />
            {busy ? "处理中" : updateAvailable ? "Update" : "Uninstall"}
          </button>
        ) : null}
        <button className="action-install" onClick={() => onInstall(item)} disabled={busy}>
          <FileCode2 size={16} />
          {busy ? "安装中" : "Install"}
        </button>
        <StarButton active={starred} className="detail-star" label onClick={(event) => { event.stopPropagation(); onStar?.(item); }} />
        <button className="soft-button" onClick={() => window.skillStudio.open(item.repositoryUrl || item.url)}>
          <Github size={16} />
          Repository
        </button>
        <button className="soft-button" onClick={() => window.skillStudio.open(item.url)}>
          <ExternalLink size={16} />
          Open on {item.sourceLabel || "GitHub"}
        </button>
      </div>
      <MetaStrip
        className="discover-meta"
        items={[
          { label: "安装状态", value: installedAgents.length ? installedAgents.join(", ") : "未安装" },
          { label: "版本", value: version ? `v${version}` : "" },
          { label: "来源", value: sourceName },
          { label: item.installsLabel ? "Installs" : "Stars", value: item.installsLabel || formatNumber(item.stars) },
          { label: "8W Activity", value: item.weeklyLabel || "-" },
          { label: "Rank", value: item.rank ? `#${item.rank}` : "-" }
        ]}
      />
      <div className="detail-tags">
        {[sourceName, item.sourceLabel || "skills.sh", item.language || "Mixed", "discover"].map((tag) => (
          <TagPill key={tag} tag={tag} />
        ))}
      </div>
      <section className="discover-info-panel">
        <div>
          <h3>基本信息</h3>
          <p>{item.description || `来自 ${item.sourceLabel || "GitHub"} 的 ${item.name}。安装后会出现在 Installed 中，可以继续查看 SKILL.md、目录结构和历史版本。`}</p>
        </div>
        <div>
          <h3>安装方式</h3>
          <div className="code-block">
            <pre>{installCommand}</pre>
          </div>
        </div>
        <div>
          <h3>Summary</h3>
          {detailLoading ? (
            <p>正在从 skills.sh 加载 Summary...</p>
          ) : (
            <div className="summary-box">
              {summaryLead ? <p><strong>{summaryLead}</strong></p> : <p>这个 skill 暂时没有提供 Summary。</p>}
              {summaryItems.length ? (
                <ul>
                  {summaryItems.map((summaryItem, index) => <li key={index}>{summaryItem}</li>)}
                </ul>
              ) : null}
            </div>
          )}
        </div>
        <div>
          <h3>SKILL 内容</h3>
          <div className="skill-md-preview">
            <pre>{detail?.skillMdText || detail?.skillMdLead || "正在加载或暂无 SKILL.md 内容。"}</pre>
          </div>
        </div>
      </section>
    </section>
  );
}

function GithubTrendPanel({ trends }) {
  return (
    <div className="github-trends">
      <div className="section-label">
        <Github size={15} />
        GitHub 趋势
        {trends.loading ? <em>更新中</em> : null}
      </div>
      {trends.error ? <p className="trend-error">趋势暂不可用</p> : null}
      <div className="github-list">
        {trends.items.slice(0, 7).map((repo, index) => (
          <button key={repo.id} className="github-item" onClick={() => window.skillStudio.open(repo.url)}>
            <span>{index + 1}</span>
            <div>
              <strong>{repo.fullName}</strong>
              <em>{repo.language} · ★ {repo.stars.toLocaleString()}</em>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function DiffFileTreeNode({ node, activePath, onSelect }) {
  const [open, setOpen] = useState(true);
  const selected = activePath === node.path;
  return (
    <div className="diff-tree-node">
      <button
        className={`diff-tree-item ${node.type} ${selected ? "selected" : ""}`}
        onClick={() => {
          if (node.type === "directory") {
            setOpen(!open);
          } else {
            onSelect(node.file);
          }
        }}
      >
        {node.type === "directory" ? <FolderOpen size={13} /> : <FileText size={13} />}
        <span>{node.name}</span>
        {node.file?.type ? <em>{node.file.type}</em> : null}
      </button>
      {node.type === "directory" && open ? (
        <div className="diff-tree-children">
          {(node.children || []).map((child) => (
            <DiffFileTreeNode key={child.path} node={child} activePath={activePath} onSelect={onSelect} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildDiffTree(files = []) {
  const rootNode = { name: "skill", path: ".", type: "directory", children: [] };
  const root = rootNode.children;
  const directories = new Map();
  function ensureDir(parts, pathPrefix) {
    const key = pathPrefix.join("/");
    if (directories.has(key)) return directories.get(key);
    const parent = pathPrefix.length > 1 ? ensureDir(parts.slice(0, -1), pathPrefix.slice(0, -1)) : { children: root };
    const node = { name: parts[parts.length - 1], path: key, type: "directory", children: [] };
    parent.children.push(node);
    directories.set(key, node);
    return node;
  }

  files.forEach((file) => {
    const parts = file.path.split("/").filter(Boolean);
    if (!parts.length) return;
    const parent = parts.length > 1 ? ensureDir(parts.slice(0, -1), parts.slice(0, -1)) : { children: root };
    parent.children.push({ name: parts[parts.length - 1], path: file.path, type: "file", file });
  });

  function sort(nodes) {
    nodes.sort((a, b) => Number(b.type === "directory") - Number(a.type === "directory") || a.name.localeCompare(b.name));
    nodes.forEach((node) => node.children && sort(node.children));
    return nodes;
  }
  sort(root);
  return [rootNode];
}

function TreeDraftInput({ draft, onChange, onSubmit, onCancel }) {
  return (
    <form
      className="tree-draft-input"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      {draft.type === "directory" ? <FolderOpen size={13} /> : <FileText size={13} />}
      <input
        autoFocus
        value={draft.name}
        placeholder={draft.type === "directory" ? "目录名" : "文件名.md"}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel?.();
        }}
      />
    </form>
  );
}

function TreeNode({ node, activePath, selectedDirPath, selectedPaths, onNodeClick, onOpenFile, onSelectDirectory, onContextMenu, draft, onDraftChange, onDraftSubmit, onDraftCancel }) {
  const [open, setOpen] = useState(true);
  const isDirectory = node.type === "directory";
  const selected = activePath === node.path;
  const multiSelected = selectedPaths?.includes(node.path);
  const directorySelected = isDirectory && selectedDirPath === node.path;
  const isRenameDraft = draft?.mode === "rename" && draft.path === node.path;
  const isCreateDraft = draft?.mode === "create" && draft.baseDir === node.path;
  return (
    <div className="tree-node">
      {isRenameDraft ? (
        <TreeDraftInput draft={draft} onChange={onDraftChange} onSubmit={onDraftSubmit} onCancel={onDraftCancel} />
      ) : (
        <button
          className={`tree-item ${node.type} ${selected || directorySelected ? "selected" : ""} ${multiSelected ? "multi-selected" : ""}`}
          onContextMenu={(event) => onContextMenu?.(event, node)}
          onClick={(event) => {
            onNodeClick?.(event, node);
            if (isDirectory) {
              onSelectDirectory?.(node.path);
              setOpen(!open);
            } else {
              onOpenFile(node);
            }
          }}
        >
          {isDirectory ? <FolderOpen size={13} /> : <FileText size={13} />}
          <span>{node.name}</span>
        </button>
      )}
      {isDirectory && (open || isCreateDraft) ? (
        <div className="tree-children">
          {isCreateDraft ? (
            <TreeDraftInput draft={draft} onChange={onDraftChange} onSubmit={onDraftSubmit} onCancel={onDraftCancel} />
          ) : null}
          {(node.children || []).map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              activePath={activePath}
              selectedDirPath={selectedDirPath}
              selectedPaths={selectedPaths}
              onNodeClick={onNodeClick}
              onOpenFile={onOpenFile}
              onSelectDirectory={onSelectDirectory}
              onContextMenu={onContextMenu}
              draft={draft}
              onDraftChange={onDraftChange}
              onDraftSubmit={onDraftSubmit}
              onDraftCancel={onDraftCancel}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DirectoryTree({ skill, activePath, selectedDirPath, selectedPaths, onNodeClick, onOpenFile, onSelectDirectory, onContextMenu, draft, onDraftChange, onDraftSubmit, onDraftCancel }) {
  const items = skill.directoryTree || [];
  const total = skill.directoryCount ?? countTree(items);
  const rootCreateDraft = draft?.mode === "create" && draft.baseDir === skill.dir;
  const rootNode = { name: skill.slug, path: skill.dir, relPath: ".", type: "directory" };
  return (
    <aside
      className="directory-pane"
      onContextMenu={(event) => {
        if (event.target.closest(".tree-item, .tree-draft-input")) return;
        onContextMenu?.(event, rootNode);
      }}
    >
      <div className="reader-label">
        <span>
          <ListTree size={15} />
          Skill 目录
        </span>
        <em>{total}</em>
      </div>
      <div className="tree-list">
        <button
          className={`tree-item root ${selectedDirPath === skill.dir ? "selected" : ""}`}
          onClick={() => onSelectDirectory?.(skill.dir)}
          onContextMenu={(event) => onContextMenu?.(event, rootNode)}
        >
          <FolderOpen size={14} />
          <span>{skill.slug}</span>
        </button>
        {rootCreateDraft ? (
          <TreeDraftInput draft={draft} onChange={onDraftChange} onSubmit={onDraftSubmit} onCancel={onDraftCancel} />
        ) : null}
        {items.map((item) => (
          <TreeNode
            key={item.path}
            node={item}
            activePath={activePath}
            selectedDirPath={selectedDirPath}
            selectedPaths={selectedPaths}
            onNodeClick={onNodeClick}
            onOpenFile={onOpenFile}
            onSelectDirectory={onSelectDirectory}
            onContextMenu={onContextMenu}
            draft={draft}
            onDraftChange={onDraftChange}
            onDraftSubmit={onDraftSubmit}
            onDraftCancel={onDraftCancel}
          />
        ))}
      </div>
    </aside>
  );
}

function CodeBlock({ code, language = "text", plain = false }) {
  const normalizedLanguage = language || "text";
  return (
    <div className={`code-block syntax-block ${plain ? "plain-file" : ""}`}>
      {normalizedLanguage !== "text" ? <div className="code-lang">{normalizedLanguage}</div> : null}
      <pre>{highlightCode(code, normalizedLanguage)}</pre>
    </div>
  );
}

function HighlightedEditor({ value, language, onChange }) {
  const highlightRef = useRef(null);
  return (
    <div className="highlight-editor">
      <pre ref={highlightRef} aria-hidden="true">{highlightCode(value || " ", language)}</pre>
      <textarea
        className="file-editor highlight-input"
        value={value}
        onChange={onChange}
        onScroll={(event) => {
          if (!highlightRef.current) return;
          highlightRef.current.scrollTop = event.currentTarget.scrollTop;
          highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
        spellCheck={false}
      />
    </div>
  );
}

function SkillReader({ file }) {
  const parsed = useMemo(() => parseFrontmatterText(file.content), [file.content]);
  const markdownText = file.isSkillFile ? parsed.body : file.content;
  const blocks = useMemo(() => parseMarkdownBlocks(markdownText), [markdownText]);
  const meta = file.isSkillFile ? frontmatterEntries(parsed.frontmatter) : [];
  const language = codeLanguageFromPath(file.path || file.name);

  if (!file.isMarkdown) {
    return (
      <article className="skill-reader">
        <CodeBlock code={file.content} language={language} plain />
      </article>
    );
  }

  return (
    <article className="skill-reader">
      {meta.length ? (
        <div className="frontmatter-panel">
          {meta.map(([key, value]) => (
            <span key={key}>
              <b>{key}</b>
              {Array.isArray(value) ? value.join(", ") : String(value)}
            </span>
          ))}
        </div>
      ) : null}

      <div className="markdown-flow">
        {blocks.map((block, index) => {
          if (block.type === "heading") {
            const Heading = `h${Math.min(block.level + 1, 4)}`;
            return <Heading key={index}>{block.text}</Heading>;
          }
          if (block.type === "code") {
            return <CodeBlock key={index} code={block.text} language={block.lang || "text"} />;
          }
          if (block.type === "list") {
            return <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ul>;
          }
          if (block.type === "ordered") {
            return <ol key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ol>;
          }
          if (block.type === "quote") {
            return <blockquote key={index}>{renderInline(block.text)}</blockquote>;
          }
          return <p key={index}>{renderInline(block.text)}</p>;
        })}
      </div>
    </article>
  );
}

function DiffViewer({ detail }) {
  const rows = useMemo(() => buildLineDiff(detail.content, detail.current), [detail]);
  const added = rows.filter((row) => row.type === "added").length;
  const removed = rows.filter((row) => row.type === "removed").length;
  const changed = added + removed;

  return (
    <>
      <div className="diff-summary">
        <span className="added">+{added} 新增</span>
        <span className="removed">-{removed} 删除</span>
        <span>{changed ? `${changed} 行变化` : "无内容差异"}</span>
      </div>
      <div className="diff-list">
        {rows.map((row, index) => (
          <div key={index} className={`diff-line ${row.type}`}>
            <b>{row.type === "added" ? "+" : row.type === "removed" ? "-" : " "}</b>
            <code>{row.line || " "}</code>
          </div>
        ))}
      </div>
    </>
  );
}

function DirectoryDiffViewer({ detail }) {
  const files = detail?.files || [];
  const [selectedPath, setSelectedPath] = useState("");
  const [treeWidth, setTreeWidth] = useState(210);
  useEffect(() => {
    setSelectedPath(files[0]?.path || "");
  }, [detail?.version?.id, files[0]?.path]);
  const tree = useMemo(() => buildDiffTree(files), [files]);
  const selectedFile = files.find((file) => file.path === selectedPath) || files[0];
  if (!files.length) return <div className="diff-empty">这个版本与当前目录没有内容差异。</div>;
  return (
    <div className="directory-diff-view" style={{ "--diff-tree-width": `${treeWidth}px` }}>
      <aside className="diff-file-tree">
        <div className="diff-file-tree-head">
          <span>变更文件</span>
          <em>{files.length}</em>
        </div>
        <div className="diff-file-tree-list">
          {tree.map((node) => (
            <DiffFileTreeNode key={node.path} node={node} activePath={selectedFile?.path} onSelect={(file) => setSelectedPath(file.path)} />
          ))}
        </div>
      </aside>
      <div
        className="history-resizer vertical"
        onMouseDown={(event) => {
          event.preventDefault();
          const startX = event.clientX;
          const startWidth = treeWidth;
          const move = (moveEvent) => {
            setTreeWidth(Math.max(150, Math.min(360, startWidth + moveEvent.clientX - startX)));
          };
          const up = () => {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
          };
          window.addEventListener("mousemove", move);
          window.addEventListener("mouseup", up);
        }}
      />
      <section className="file-diff-card">
        <div className="file-diff-head">
          <strong>{selectedFile.path}</strong>
          <span>{selectedFile.type}</span>
        </div>
        {selectedFile.binary ? (
          <div className="diff-empty">二进制或大文件，仅记录文件状态变化。</div>
        ) : (
          <DiffViewer detail={{ content: selectedFile.content, current: selectedFile.current }} />
        )}
      </section>
    </div>
  );
}

function SkillVersionPicker({ copy, onActivate, onDelete, busy, showAllVersions = true }) {
  const allVersions = copy?.versionInfo?.versions || [];
  const versions = showAllVersions ? allVersions : allVersions.filter((version) => (
    version.sourceId === copy?.sourceId
    || (version.sourceIds || []).includes(copy?.sourceId)
    || version.id === copy?.versionInfo?.activeArchiveId
    || (version.duplicateIds || []).includes(copy?.versionInfo?.activeArchiveId)
  ));
  const [versionMenuOpen, setVersionMenuOpen] = useState(false);
  const [selectedVersionIds, setSelectedVersionIds] = useState([]);
  const pickerRef = useRef(null);
  const currentVersion = skillVersion(copy);
  const currentLabel = copy?.versionInfo?.currentLabel || (currentVersion ? `v${currentVersion}` : copy?.versionInfo?.activeLabel || "");
  const currentArchive = versions.find((version) => (
    version.hash === copy?.versionInfo?.currentHash && (!currentLabel || version.label === currentLabel)
  ));
  const selectedId = currentArchive?.id || copy?.versionInfo?.activeArchiveId || "";
  const latestVersion = versions[0] || null;
  const isSelectedVersion = (version) => version?.id === selectedId || (version?.duplicateIds || []).includes(selectedId);
  const stale = Boolean(latestVersion?.id && selectedId && !isSelectedVersion(latestVersion));
  const deletableVersions = versions.filter((version) => !isSelectedVersion(version) && !version.active);
  const selectedVersionEntry = versions.find((version) => (
    version.id === selectedId || (version.duplicateIds || []).includes(selectedId)
  ));
  const selectedVersionLabel = selectedVersionEntry?.label || currentLabel || "当前版本";
  useEffect(() => {
    setSelectedVersionIds((current) => current.filter((id) => deletableVersions.some((version) => version.id === id)));
  }, [copy?.id, selectedId, versions.length]);
  useEffect(() => {
    if (!versionMenuOpen) return undefined;
    const closeOnOutside = (event) => {
      if (!pickerRef.current?.contains(event.target)) {
        setVersionMenuOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setVersionMenuOpen(false);
    };
    window.addEventListener("pointerdown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [versionMenuOpen]);
  function toggleVersionDelete(id) {
    setSelectedVersionIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }
  function deleteSelectedVersions() {
    if (!selectedVersionIds.length) return;
    const selectedIds = versions
      .filter((version) => selectedVersionIds.includes(version.id))
      .flatMap((version) => version.duplicateIds?.length ? version.duplicateIds : [version.id]);
    onDelete?.(selectedIds, () => {
      setSelectedVersionIds([]);
      setVersionMenuOpen(false);
    });
  }
  if (!copy) return null;
  if (!versions.length) return null;
  return (
    <div ref={pickerRef} className={`version-picker ${stale ? "stale" : ""}`}>
      <button className="version-dropdown-trigger" onClick={() => setVersionMenuOpen((open) => !open)} disabled={busy} title={stale ? `不是最新版本，最新为 ${latestVersion?.label || latestVersion?.id}` : "选择版本"}>
        <span>版本</span>
        <strong>{selectedVersionLabel}</strong>
      </button>
      {versionMenuOpen ? (
        <div className="version-dropdown-menu">
          <div className="version-dropdown-list">
            {versions.map((version) => {
              const active = isSelectedVersion(version);
              const protectedVersion = active || version.active;
              const checked = selectedVersionIds.includes(version.id);
              return (
                <div key={version.id} className={`version-dropdown-row ${active ? "active" : ""}`}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busy || protectedVersion}
                      onChange={() => toggleVersionDelete(version.id)}
                    />
                    <strong>{version.label || version.id}</strong>
                    <small>{active ? "当前" : version.active ? `使用中: ${(version.activeClients || []).join(", ")}` : formatDate(version.createdAt)}</small>
                  </label>
                  <button
                    disabled={busy || active}
                    onClick={() => {
                      setVersionMenuOpen(false);
                      onActivate(version);
                    }}
                  >
                    {active ? "当前" : "切换"}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="version-dropdown-actions">
            <button onClick={() => setSelectedVersionIds(deletableVersions.map((version) => version.id))} disabled={busy || !deletableVersions.length}>全选</button>
            <button onClick={() => setSelectedVersionIds([])} disabled={busy || !selectedVersionIds.length}>清空</button>
            <button className="danger" onClick={deleteSelectedVersions} disabled={busy || !selectedVersionIds.length}>
              删除选中 {selectedVersionIds.length ? `(${selectedVersionIds.length})` : ""}
            </button>
          </div>
        </div>
      ) : null}
      {stale && !versionMenuOpen ? (
        <button
          className="version-stale-badge"
          onClick={() => onActivate(latestVersion)}
          disabled={busy}
          title={`点击切换到最新版本 ${latestVersion.label || latestVersion.id}`}
        >
          最新
        </button>
      ) : null}
    </div>
  );
}

function Detail({ skill, onSaved, starred, onStar, onInstall, onUninstall, baselineSourceId = "agents", agentScope = "all" }) {
  const [activeFile, setActiveFile] = useState(null);
  const [activeCopyId, setActiveCopyId] = useState("");
  const [syncDraft, setSyncDraft] = useState(null);
  const [syncTargetIds, setSyncTargetIds] = useState([]);
  const [baselineOverrides, setBaselineOverrides] = useState(() => readStoredJson(baselineOverridesStorageKey, null, {}));
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState("view");
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [versionDetail, setVersionDetail] = useState(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeDetail, setUpgradeDetail] = useState(null);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [upgradeTargetOpen, setUpgradeTargetOpen] = useState(false);
  const [upgradeTargetCopyId, setUpgradeTargetCopyId] = useState("");
  const [upgradeCopy, setUpgradeCopy] = useState(null);
  const [versionSwitching, setVersionSwitching] = useState(false);
  const [selectedDirPath, setSelectedDirPath] = useState("");
  const [treeMenu, setTreeMenu] = useState(null);
  const [createEntryDraft, setCreateEntryDraft] = useState(null);
  const [copyOverrides, setCopyOverrides] = useState({});
  const [selectedTreePaths, setSelectedTreePaths] = useState([]);
  const [lastTreePath, setLastTreePath] = useState("");
  const [historyListWidth, setHistoryListWidth] = useState(190);
  const [fileError, setFileError] = useState("");
  const [fileNotice, setFileNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const pendingDeletedPathsRef = useRef(new Set());

  async function loadHistory(filePath) {
    try {
      const entries = await window.skillStudio.fileHistory(filePath);
      setHistory(entries);
      return entries;
    } catch {
      setHistory([]);
      return [];
    }
  }

  async function openHistoryPanel() {
    if (!activeCopy) return;
    setHistoryOpen(true);
    const entries = historicalVersions(activeCopy);
    setHistory(entries);
    if (entries.length) {
      await selectVersion(entries[0]);
    } else {
      setSelectedVersion(null);
      setVersionDetail(null);
    }
  }

  function applyRefreshedCopy(scanResult, copy = activeCopy) {
    const fresh = (scanResult?.skills || []).find((item) => item.id === copy?.id)
      || (scanResult?.skills || []).find((item) => item.sourceId === copy?.sourceId && item.dir === copy?.dir);
    if (fresh?.id) {
      setCopyOverrides((current) => ({
        ...current,
        [copy.id]: (() => {
          const existing = current[copy.id] || copy;
          return {
            ...existing,
            ...fresh,
            directoryTree: fresh.detailLoaded ? fresh.directoryTree : existing.directoryTree,
            directoryCount: fresh.detailLoaded ? fresh.directoryCount : existing.directoryCount,
            directoryTruncated: fresh.detailLoaded ? fresh.directoryTruncated : existing.directoryTruncated,
            detailLoaded: fresh.detailLoaded || existing.detailLoaded,
            id: copy.id
          };
        })()
      }));
    }
    return fresh || null;
  }

  function withoutPendingDeletedNodes(tree = []) {
    const targets = pendingDeletedPathsRef.current;
    if (!targets.size) return tree;
    const isRemoved = (nodePath = "") => [...targets].some((targetPath) => (
      nodePath === targetPath || nodePath.startsWith(`${targetPath.replace(/\/+$/, "")}/`)
    ));
    return tree
      .filter((node) => !isRemoved(node.path))
      .map((node) => ({ ...node, children: withoutPendingDeletedNodes(node.children || []) }));
  }

  function loadFullSkillDetail(copy) {
    if (!copy?.dir || (copy.detailLoaded && copy.versionInfo)) return;
    window.skillStudio.skillDetail?.({
      skillDir: copy.dir,
      source: {
        id: copy.sourceId,
        client: copy.client,
        label: copy.sourceLabel,
        root: copy.root
      }
    }).then((fresh) => {
      if (!fresh?.id) return;
      const safeTree = withoutPendingDeletedNodes(fresh.directoryTree || []);
      setCopyOverrides((current) => ({
        ...current,
        [copy.id]: {
          ...copy,
          ...fresh,
          directoryTree: safeTree,
          directoryCount: countTree(safeTree),
          id: copy.id
        }
      }));
    }).catch(() => {});
  }

  function applyCopySnapshot(snapshot, copy = activeCopy) {
    if (!snapshot?.id || !copy?.id) return null;
    const nextCopy = {
      ...copy,
      ...snapshot,
      id: copy.id
    };
    setCopyOverrides((current) => ({
      ...current,
      [copy.id]: nextCopy
    }));
    const file = {
      path: nextCopy.filePath,
      name: "SKILL.md",
      content: nextCopy.raw || "",
      isMarkdown: true,
      isSkillFile: true,
      size: nextCopy.bytes,
      updatedAt: nextCopy.updatedAt
    };
    setActiveCopyId(copy.id);
    setActiveFile(file);
    setSelectedDirPath(nextCopy.dir);
    setDraft(file.content);
    setMode("view");
    setCreateEntryDraft(null);
    setTreeMenu(null);
    setPendingNavigation(null);
    setHistoryOpen(false);
    setSelectedVersion(null);
    setVersionDetail(null);
    setSelectedTreePaths([]);
    setLastTreePath("");
    loadHistory(file.path);
    return nextCopy;
  }

  function refreshCopyInBackground(copy = activeCopy) {
    Promise.resolve(onSaved?.())
      .then((refreshed) => applyRefreshedCopy(refreshed, copy))
      .catch(() => {});
  }

  function updateActiveCopyOverride(patch) {
    if (!activeCopy?.id) return;
    setCopyOverrides((current) => ({
      ...current,
      [activeCopy.id]: {
        ...activeCopy,
        ...(current[activeCopy.id] || {}),
        ...patch
      }
    }));
  }

  function insertTreeNodeOptimistic(result, baseDir) {
    if (!activeCopy?.dir || !result?.path) return;
    const root = activeCopy.dir.replace(/\/+$/, "");
    const relPath = result.path.startsWith(`${root}/`) ? result.path.slice(root.length + 1) : result.name;
    const parts = relPath.split("/").filter(Boolean);
    if (!parts.length) return;
    const nextTree = structuredClone(activeCopy.directoryTree || []);

    function sortNodes(nodes) {
      nodes.sort((a, b) => Number(b.type === "directory") - Number(a.type === "directory") || a.name.localeCompare(b.name));
      return nodes;
    }

    function ensure(nodes, index, currentDir) {
      const name = parts[index];
      const nodePath = `${currentDir.replace(/\/+$/, "")}/${name}`;
      const isLeaf = index === parts.length - 1;
      let node = nodes.find((item) => item.name === name && item.path === nodePath);
      if (!node) {
        node = {
          name,
          path: nodePath,
          relPath: parts.slice(0, index + 1).join("/"),
          depth: index,
          type: isLeaf ? result.type : "directory",
          children: []
        };
        nodes.push(node);
        sortNodes(nodes);
      }
      if (!isLeaf) {
        node.type = "directory";
        node.children = node.children || [];
        ensure(node.children, index + 1, node.path);
      }
    }

    ensure(nextTree, 0, root);
    updateActiveCopyOverride({
      directoryTree: nextTree,
      directoryCount: Math.max((activeCopy.directoryCount || countTree(activeCopy.directoryTree || [])) + 1, countTree(nextTree)),
      updatedAt: new Date().toISOString()
    });
  }

  function selectableTreeNodes() {
    return flattenTreeNodes(activeCopy?.directoryTree || []).filter((node) => node.path !== activeCopy?.filePath);
  }

  function handleTreeNodeClick(event, node) {
    if (!node || node.path === activeCopy?.filePath) {
      setSelectedTreePaths([]);
      setLastTreePath(node?.path || "");
      return;
    }
    const selectable = selectableTreeNodes();
    if (event.shiftKey && lastTreePath) {
      const start = selectable.findIndex((item) => item.path === lastTreePath);
      const end = selectable.findIndex((item) => item.path === node.path);
      if (start >= 0 && end >= 0) {
        const [from, to] = start < end ? [start, end] : [end, start];
        setSelectedTreePaths(selectable.slice(from, to + 1).map((item) => item.path));
      } else {
        setSelectedTreePaths([node.path]);
      }
    } else if (event.metaKey || event.ctrlKey) {
      setSelectedTreePaths((current) => (
        current.includes(node.path) ? current.filter((item) => item !== node.path) : [...current, node.path]
      ));
      setLastTreePath(node.path);
    } else {
      setSelectedTreePaths([node.path]);
      setLastTreePath(node.path);
    }
  }

  function renameTreeNodeOptimistic(oldPath, result) {
    if (!activeCopy?.dir || !oldPath || !result?.path) return;
    const nextTree = structuredClone(activeCopy.directoryTree || []);
    const oldPrefix = `${oldPath.replace(/\/+$/, "")}/`;
    const newPrefix = `${result.path.replace(/\/+$/, "")}/`;

    function updateDescendantPaths(node) {
      if (node.path === oldPath) {
        node.path = result.path;
      } else if (node.path?.startsWith(oldPrefix)) {
        node.path = `${newPrefix}${node.path.slice(oldPrefix.length)}`;
      }
      const root = activeCopy.dir.replace(/\/+$/, "");
      node.relPath = node.path?.startsWith(`${root}/`) ? node.path.slice(root.length + 1) : node.relPath;
      (node.children || []).forEach(updateDescendantPaths);
    }

    function renameIn(nodes) {
      for (const node of nodes) {
        if (node.path === oldPath) {
          node.name = result.name;
          node.path = result.path;
          node.type = result.type;
          updateDescendantPaths(node);
          return true;
        }
        if (renameIn(node.children || [])) {
          node.children.sort((a, b) => Number(b.type === "directory") - Number(a.type === "directory") || a.name.localeCompare(b.name));
          return true;
        }
      }
      return false;
    }

    if (renameIn(nextTree)) {
      nextTree.sort((a, b) => Number(b.type === "directory") - Number(a.type === "directory") || a.name.localeCompare(b.name));
      updateActiveCopyOverride({
        directoryTree: nextTree,
        updatedAt: new Date().toISOString()
      });
    }
  }

  function removeTreeNodeOptimistic(targetPath) {
    removeTreeNodesOptimistic([targetPath]);
  }

  function removeTreeNodesOptimistic(paths = []) {
    const targets = new Set(paths.filter(Boolean));
    if (!activeCopy?.dir || !targets.size) return;
    const nextTree = structuredClone(activeCopy.directoryTree || []);

    function removeFrom(nodes) {
      return nodes
        .filter((node) => !targets.has(node.path))
        .map((node) => ({ ...node, children: removeFrom(node.children || []) }));
    }

    const filteredTree = removeFrom(nextTree);
    updateActiveCopyOverride({
      directoryTree: filteredTree,
      directoryCount: Math.max(0, countTree(filteredTree)),
      updatedAt: new Date().toISOString()
    });
    const activeDeleted = [...targets].some((targetPath) => (
      activeFile?.path === targetPath || activeFile?.path?.startsWith(`${targetPath.replace(/\/+$/, "")}/`)
    ));
    if (activeDeleted) {
      openSkillCopyNow(activeCopy, "view", { skipDetailLoad: true });
    }
    setSelectedTreePaths((current) => current.filter((item) => !targets.has(item)));
  }

  function historicalVersions(copy) {
    const info = copy?.versionInfo || {};
    return (info.versions || []).filter((version) => (
      version.id !== info.activeArchiveId
      && !(version.hash === info.currentHash && (!info.currentLabel || version.label === info.currentLabel))
    ));
  }

  async function selectVersion(entry) {
    if (!activeCopy) return;
    setSelectedVersion(entry);
    setFileError("");
    try {
      setVersionDetail(await window.skillStudio.skillVersionDiff({
        skillDir: activeCopy.dir,
        archiveId: entry.id
      }));
    } catch (err) {
      setFileError(err.message || String(err));
    }
  }

  function hasUnsavedChanges() {
    return mode === "edit" && activeFile && draft !== activeFile.content;
  }

  async function runPendingNavigation(pending = pendingNavigation) {
    if (!pending) return;
    setPendingNavigation(null);
    if (pending.type === "copy") {
      await openSkillCopyNow(pending.copy, pending.nextMode);
    } else if (pending.type === "file") {
      await openTreeFileNow(pending.item);
    } else if (pending.type === "mode") {
      setDraft(activeFile?.content || "");
      setMode(pending.nextMode);
    }
  }

  function exitEditMode() {
    if (hasUnsavedChanges()) {
      setPendingNavigation({ type: "mode", nextMode: "view" });
      return;
    }
    setMode("view");
    setPendingNavigation(null);
  }

  async function openSkillCopy(copy, nextMode = mode) {
    if (hasUnsavedChanges()) {
      setPendingNavigation({ type: "copy", copy, nextMode });
      return;
    }
    await openSkillCopyNow(copy, nextMode);
  }

  async function openSkillCopyNow(copy, nextMode = "view", options = {}) {
    if (!copy) return;
    setFileError("");
    let content = copy.raw || "";
    let size = copy.bytes;
    let updatedAt = copy.updatedAt;
    try {
      if (!content) {
        const result = await window.skillStudio.readFile(copy.filePath);
        content = result.content;
        size = result.size;
        updatedAt = result.updatedAt;
      }
    } catch (err) {
      setFileError(err.message || String(err));
      return;
    }
    const file = {
      path: copy.filePath,
      name: "SKILL.md",
      content,
      isMarkdown: true,
      isSkillFile: true,
      size,
      updatedAt
    };
    setActiveCopyId(copy.id);
    setActiveFile(file);
    setSelectedDirPath(copy.dir);
    setCreateEntryDraft(null);
    setTreeMenu(null);
    setDraft(file.content);
    setMode(nextMode);
    setPendingNavigation(null);
    setFileError("");
    setHistoryOpen(false);
    setSelectedVersion(null);
    setVersionDetail(null);
    loadHistory(file.path);
    if (!options.skipDetailLoad) loadFullSkillDetail(copy);
  }

  useEffect(() => {
    if (!skill) return;
    const copies = skill.installations || [skill];
    const skillBaselineId = baselineOverrides[skillGroupKey(skill)] || baselineSourceId;
    const preferred = copies.find((copy) => copy.id === activeCopyId)
      || copies.find((copy) => copy.sourceId === skillBaselineId)
      || copies[0]
      || skill;
    if (activeFile?.path?.startsWith(`${preferred.dir}/`)) {
      setActiveCopyId(preferred.id);
      openTreeFileNow({
        path: activeFile.path,
        name: activeFile.name || activeFile.path.split("/").pop(),
        type: "file"
      });
    } else {
      openSkillCopy(preferred);
    }
  }, [skill]);

  useEffect(() => {
    if (!treeMenu) return undefined;
    const close = () => setTreeMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close);
    };
  }, [treeMenu]);

  async function openTreeFile(item) {
    if (hasUnsavedChanges()) {
      setPendingNavigation({ type: "file", item });
      return;
    }
    await openTreeFileNow(item);
  }

  async function openTreeFileNow(item) {
    setFileError("");
    try {
      const result = await window.skillStudio.readFile(item.path);
      const file = {
        path: item.path,
        name: item.name,
        content: result.content,
        isMarkdown: isMarkdownPath(item.path),
        isSkillFile: item.path === activeCopy.filePath,
        size: result.size,
        updatedAt: result.updatedAt
      };
      setActiveFile(file);
      setSelectedDirPath(parentPath(item.path));
      setCreateEntryDraft(null);
      setTreeMenu(null);
      setDraft(file.content);
      setPendingNavigation(null);
      setHistoryOpen(false);
      setSelectedVersion(null);
      setVersionDetail(null);
      loadHistory(file.path);
    } catch (err) {
      setFileError(err.message || String(err));
    }
  }

  function beginCreateEntry(type, baseDir = selectedDirPath || (activeFile?.path ? parentPath(activeFile.path) : activeCopy?.dir)) {
    if (!activeCopy?.dir) return;
    setTreeMenu(null);
    setCreateEntryDraft({
      mode: "create",
      type,
      baseDir: baseDir || activeCopy.dir,
      name: ""
    });
  }

  function beginRenameEntry(node) {
    if (!node?.path || node.path === activeCopy?.dir) return;
    setTreeMenu(null);
    setCreateEntryDraft({
      mode: "rename",
      type: node.type,
      path: node.path,
      baseDir: parentPath(node.path),
      name: node.name
    });
  }

  async function submitTreeDraft() {
    if (!createEntryDraft) return;
    if (createEntryDraft.mode === "rename") {
      await renameDirectoryEntry(createEntryDraft.path, createEntryDraft.name, createEntryDraft.type);
      return;
    }
    await createDirectoryEntry(createEntryDraft.type, createEntryDraft.baseDir, createEntryDraft.name);
  }

  async function createDirectoryEntry(type, baseDir, name) {
    if (!activeCopy?.dir) return;
    const label = type === "directory" ? "目录" : "文件";
    const targetBaseDir = baseDir || selectedDirPath || (activeFile?.path ? parentPath(activeFile.path) : activeCopy.dir);
    const entryName = String(name || "").trim();
    if (!entryName) {
      setFileError(`请输入要新增的${label}名称。`);
      return;
    }
    setSaving(true);
    setFileError("");
    try {
      const result = await window.skillStudio.createFileEntry({
        baseDir: targetBaseDir,
        type,
        name: entryName,
        skillDir: activeCopy.dir,
        sourceInfo: {
          sourceId: activeCopy.sourceId,
          client: activeCopy.client,
          sourceLabel: activeCopy.sourceLabel
        }
      });
      setCreateEntryDraft(null);
      insertTreeNodeOptimistic(result, targetBaseDir);
      if (result.type === "file") {
        const file = {
          path: result.path,
          name: result.name,
          content: "",
          isMarkdown: isMarkdownPath(result.path),
          isSkillFile: result.path === activeCopy.filePath,
          size: 0,
          updatedAt: new Date().toISOString()
        };
        setActiveFile(file);
        setSelectedDirPath(parentPath(result.path));
        setDraft("");
        setPendingNavigation(null);
        setHistoryOpen(false);
        setSelectedVersion(null);
        setVersionDetail(null);
        setSelectedTreePaths([result.path]);
        setLastTreePath(result.path);
        setMode("edit");
      } else {
        setSelectedDirPath(result.path);
        setSelectedTreePaths([result.path]);
        setLastTreePath(result.path);
      }
      setSaving(false);
      refreshCopyInBackground(activeCopy);
    } catch (err) {
      setFileError(err.message || String(err));
      const refreshed = await onSaved?.();
      applyRefreshedCopy(refreshed);
    } finally {
      setSaving(false);
    }
  }

  async function renameDirectoryEntry(filePath, name, type) {
    if (!activeCopy?.dir) return;
    const entryName = String(name || "").trim();
    if (!entryName) {
      setFileError("请输入新的名称。");
      return;
    }
    setSaving(true);
    setFileError("");
    try {
      const wasActive = activeFile?.path === filePath;
      const activeWasInsideDirectory = type === "directory" && activeFile?.path?.startsWith(`${filePath}/`);
      const result = await window.skillStudio.renameFileEntry({
        path: filePath,
        name: entryName,
        skillDir: activeCopy.dir,
        sourceInfo: {
          sourceId: activeCopy.sourceId,
          client: activeCopy.client,
          sourceLabel: activeCopy.sourceLabel
        }
      });
      setCreateEntryDraft(null);
      renameTreeNodeOptimistic(filePath, result);
      const refreshed = await onSaved?.();
      applyRefreshedCopy(refreshed);
      if (result.type === "file" && wasActive) {
        await openTreeFileNow({ path: result.path, name: result.name, type: "file" });
      } else if (activeWasInsideDirectory) {
        const nextPath = `${result.path}${activeFile.path.slice(filePath.length)}`;
        await openTreeFileNow({ path: nextPath, name: activeFile.name, type: "file" });
      } else if (type === "directory") {
        setSelectedDirPath(result.path);
      }
    } catch (err) {
      setFileError(err.message || String(err));
      const refreshed = await onSaved?.();
      applyRefreshedCopy(refreshed);
    } finally {
      setSaving(false);
    }
  }

  async function deleteDirectoryEntry(node) {
    if (!activeCopy?.dir || !node?.path || node.path === activeCopy.dir) return;
    const nodesByPath = new Map(flattenTreeNodes(activeCopy.directoryTree || []).map((item) => [item.path, item]));
    const selectedSet = new Set(selectedTreePaths);
    const rawTargets = (selectedSet.has(node.path) ? selectedTreePaths : [node.path])
      .map((itemPath) => nodesByPath.get(itemPath) || (itemPath === node.path ? node : null))
      .filter((item) => item && item.path !== activeCopy.dir && item.path !== activeCopy.filePath);
    const targets = rawTargets.filter((item) => (
      !rawTargets.some((other) => other.path !== item.path && item.path.startsWith(`${other.path.replace(/\/+$/, "")}/`))
    ));
    if (!targets.length) return;
    const preview = targets.slice(0, 8).map((item) => `- ${shortPath(item.path)}`).join("\n");
    const confirmed = window.confirm(`确认删除 ${targets.length} 个项目？\n${preview}${targets.length > 8 ? "\n..." : ""}\n\n删除后可在升级前的历史版本中找回，但当前工作目录会移除它。`);
    if (!confirmed) return;
    setTreeMenu(null);
    setSaving(true);
    setFileError("");
    const targetPaths = targets.map((target) => target.path);
    targetPaths.forEach((targetPath) => pendingDeletedPathsRef.current.add(targetPath));
    removeTreeNodesOptimistic(targetPaths);
    try {
      await Promise.all(targets.map((target) => (
        window.skillStudio.deleteFileEntry({
          path: target.path,
          skillDir: activeCopy.dir
        })
      )));
      const refreshed = await onSaved?.();
      applyRefreshedCopy(refreshed);
      const freshDetail = await window.skillStudio.skillDetail?.({
        skillDir: activeCopy.dir,
        source: {
          id: activeCopy.sourceId,
          client: activeCopy.client,
          label: activeCopy.sourceLabel,
          root: activeCopy.root
        }
      });
      if (freshDetail?.id) {
        setCopyOverrides((current) => ({
          ...current,
          [activeCopy.id]: {
            ...(current[activeCopy.id] || activeCopy),
            ...freshDetail,
            id: activeCopy.id
          }
        }));
      }
      targetPaths.forEach((targetPath) => pendingDeletedPathsRef.current.delete(targetPath));
    } catch (err) {
      targetPaths.forEach((targetPath) => pendingDeletedPathsRef.current.delete(targetPath));
      setFileError(err.message || String(err));
      const refreshed = await onSaved?.();
      applyRefreshedCopy(refreshed);
    } finally {
      setSaving(false);
    }
  }

  function openTreeContextMenu(event, node) {
    event.preventDefault();
    event.stopPropagation();
    setTreeMenu({
      x: event.clientX,
      y: event.clientY,
      node
    });
  }

  async function copyTreePath(node, absolute = false) {
    if (!node) return;
    const value = absolute ? node.path : (node.relPath || copyRelativePath(activeCopy, node.path));
    try {
      await window.skillStudio.copyText?.(value);
      setFileNotice(`已复制${absolute ? "绝对" : "相对"}路径：${value}`);
      window.setTimeout(() => setFileNotice(""), 1400);
      setTreeMenu(null);
    } catch (err) {
      setFileError(`复制失败：${err.message || String(err)}`);
    }
  }

  async function saveDraft() {
    if (!activeFile) return false;
    setSaving(true);
    setFileError("");
    try {
      const result = await window.skillStudio.saveFile(activeFile.path, draft, {
        skillDir: activeCopy.dir,
        sourceInfo: {
          sourceId: activeCopy.sourceId,
          client: activeCopy.client,
          sourceLabel: activeCopy.sourceLabel
        }
      });
      const savedContent = result.content ?? draft;
      setActiveFile({ ...activeFile, content: savedContent, size: result.size, updatedAt: result.updatedAt });
      setDraft(savedContent);
      await loadHistory(activeFile.path);
      setSelectedVersion(null);
      setVersionDetail(null);
      const syncTargets = installations.filter((copy) => copy.id !== activeCopy.id);
      if (activeCopy.sourceId === effectiveBaselineSourceId && syncTargets.length) {
        setSyncDraft({
          sourceCopy: activeCopy,
          content: savedContent,
          relativePath: copyRelativePath(activeCopy, activeFile.path),
          fileName: activeFile.name,
          savedAt: new Date().toISOString()
        });
        setSyncTargetIds(syncTargets.map((copy) => copy.id));
      }
      onSaved?.();
      return true;
    } catch (err) {
      setFileError(err.message || String(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function restoreVersion(versionId) {
    if (!activeCopy) return;
    setVersionSwitching(true);
    setFileError("");
    try {
      const result = await window.skillStudio.activateSkillVersion({
        skillDir: activeCopy.dir,
        archiveId: versionId,
        sourceInfo: {
          sourceId: activeCopy.sourceId,
          client: activeCopy.client,
          sourceLabel: activeCopy.sourceLabel
        }
      });
      const nextCopy = applyCopySnapshot(result.skill, activeCopy) || activeCopy;
      refreshCopyInBackground(nextCopy);
    } catch (err) {
      setFileError(err.message || String(err));
    } finally {
      setVersionSwitching(false);
    }
  }

  async function activateSkillPackageVersion(version) {
    if (!activeCopy || !version) return;
    const confirmed = window.confirm(`将 ${activeCopy.client} 的 ${skill.name} 回滚到 ${version.label || version.id}？\n当前目录会先自动保存为一个可回滚版本。`);
    if (!confirmed) return;
    setVersionSwitching(true);
    setFileError("");
    try {
      const result = await window.skillStudio.activateSkillVersion({
        skillDir: activeCopy.dir,
        archiveId: version.id,
        sourceInfo: {
          sourceId: activeCopy.sourceId,
          client: activeCopy.client,
          sourceLabel: activeCopy.sourceLabel
        }
      });
      const nextCopy = applyCopySnapshot(result.skill, activeCopy) || activeCopy;
      refreshCopyInBackground(nextCopy);
    } catch (err) {
      setFileError(err.message || String(err));
    } finally {
      setVersionSwitching(false);
    }
  }

  async function deleteSkillPackageVersions(versionIds, afterDelete) {
    if (!activeCopy || !versionIds?.length) return;
    const confirmed = window.confirm(`确认删除选中的 ${versionIds.length} 个历史版本？\n当前正在使用的版本不会被删除。`);
    if (!confirmed) return;
    setVersionSwitching(true);
    setFileError("");
    try {
      const result = await window.skillStudio.deleteSkillVersions({
        skillDir: activeCopy.dir,
        archiveIds: versionIds
      });
      updateActiveCopyOverride({
        versionInfo: {
          ...(activeCopy.versionInfo || {}),
          versions: result.versions || []
        }
      });
      afterDelete?.();
      refreshCopyInBackground(activeCopy);
      if (result.skipped?.length) {
        const activeCount = result.skipped.filter((item) => item.reason === "active").length;
        const missingCount = result.skipped.filter((item) => item.reason === "missing").length;
        const parts = [];
        if (activeCount) parts.push(`${activeCount} 个正在使用`);
        if (missingCount) parts.push(`${missingCount} 个已不存在`);
        setFileError(`已删除 ${result.deleted?.length || 0} 个版本，跳过 ${parts.join("、")}的版本。`);
      }
    } catch (err) {
      setFileError(err.message || String(err));
    } finally {
      setVersionSwitching(false);
    }
  }

  async function prepareUpgradePreview(copy = activeCopy) {
    if (!copy) return;
    if (hasUnsavedChanges()) {
      setFileError("请先保存或取消当前修改，再执行版本升级。");
      return;
    }
    setUpgradeBusy(true);
    setFileError("");
    try {
      const detail = await window.skillStudio.previewSkillUpgrade({
        skillDir: copy.dir,
        activeArchiveId: copy.versionInfo?.activeArchiveId
      });
      setUpgradeDetail(detail);
      setUpgradeCopy(copy);
      setUpgradeOpen(true);
    } catch (err) {
      setFileError(err.message || String(err));
    } finally {
      setUpgradeBusy(false);
    }
  }

  async function openUpgradePreview() {
    if (!activeCopy) return;
    if (installations.length > 1 && agentScope === "all") {
      setUpgradeTargetCopyId(activeCopy.id);
      setUpgradeTargetOpen(true);
      return;
    }
    await prepareUpgradePreview(activeCopy);
  }

  async function confirmSkillUpgrade() {
    const targetCopy = upgradeCopy || activeCopy;
    if (!targetCopy || !upgradeDetail) return;
    setUpgradeBusy(true);
    setFileError("");
    try {
      const result = await window.skillStudio.commitSkillUpgrade({
        skillDir: targetCopy.dir,
        nextVersion: upgradeDetail.toVersion,
        sourceInfo: {
          sourceId: targetCopy.sourceId,
          client: targetCopy.client,
          sourceLabel: targetCopy.sourceLabel
        }
      });
      setUpgradeOpen(false);
      setUpgradeDetail(null);
      setUpgradeCopy(null);
      if (activeFile?.path === result.path) {
        const nextFile = {
          ...activeFile,
          content: result.content,
          size: result.size,
          updatedAt: result.updatedAt
        };
        setActiveFile(nextFile);
        setDraft(result.content);
      }
      refreshCopyInBackground(targetCopy);
    } catch (err) {
      setFileError(err.message || String(err));
    } finally {
      setUpgradeBusy(false);
    }
  }

  if (!skill) {
    return (
      <section className="detail empty">
        <Command size={34} />
        <p>选择一个 skill 查看完整内容、目录结构、来源和标签。</p>
      </section>
    );
  }
  const installations = (skill.installations || [skill]).map((copy) => copyOverrides[copy.id] ? { ...copy, ...copyOverrides[copy.id] } : copy);
  const activeCopy = installations.find((copy) => copy.id === activeCopyId) || installations[0] || skill;
  const baselineKey = skillGroupKey(skill);
  const requestedBaselineSourceId = baselineOverrides[baselineKey] || baselineSourceId;
  const baselineCopy = installations.find((copy) => copy.sourceId === requestedBaselineSourceId) || installations.find((copy) => copy.sourceId === "agents") || installations[0] || skill;
  const effectiveBaselineSourceId = baselineCopy.sourceId;
  const allAgentsScope = agentScope === "all" && installations.length > 1;
  const editTargetCopy = allAgentsScope ? baselineCopy : activeCopy;
  const syncTargets = installations.filter((copy) => copy.id !== syncDraft?.sourceCopy?.id);
  const installationAgents = [...new Set(installations.map((copy) => copy.client))];
  const isUninstalledSkill = skill.sourceId === "uninstalled";
  const uninstallSource = skill.uninstallMeta?.sourceClient || skill.uninstallMeta?.sourceLabel || "未知";
  const activeVersion = skillVersion(activeCopy || skill);

  function selectSkillBaseline(sourceId) {
    const next = { ...baselineOverrides, [baselineKey]: sourceId };
    if (sourceId === baselineSourceId) delete next[baselineKey];
    setBaselineOverrides(next);
    localStorage.setItem(baselineOverridesStorageKey, JSON.stringify(next));
    setSyncDraft(null);
  }

  return (
    <section className="detail">
      <div className="detail-header">
        <div className="detail-icon">{skill.name.slice(0, 1).toUpperCase()}</div>
        <div>
          <h2>{skill.name}</h2>
          <p>{skill.description || "暂无描述"}</p>
        </div>
        <button className="history-top-button" onClick={openHistoryPanel}>
          <History size={16} />
          历史版本
        </button>
      </div>
      <div className="detail-actions">
        <button className="action-install" onClick={() => onInstall?.(skill)}>
          <FileCode2 size={16} />
          Install
        </button>
        {onUninstall ? (
        <button className="action-uninstall" onClick={() => onUninstall(skill, installations)}>
          <RotateCcw size={16} />
          Uninstall
        </button>
        ) : null}
        <SkillVersionPicker copy={activeCopy} onActivate={activateSkillPackageVersion} onDelete={deleteSkillPackageVersions} busy={versionSwitching} showAllVersions={allAgentsScope} />
        <button className={`action-baseline action-upgrade ${upgradeBusy || upgradeOpen ? "is-busy" : ""}`} onClick={openUpgradePreview} disabled={upgradeBusy || upgradeOpen}>
          <History size={16} />
          {upgradeBusy ? "升级中" : upgradeOpen ? "确认升级" : "升级"}
        </button>
        {allAgentsScope ? (
          <label className="baseline-picker">
            <span>基准</span>
            <select value={effectiveBaselineSourceId} onChange={(event) => selectSkillBaseline(event.target.value)}>
              {installations.map((copy) => (
                <option key={copy.id} value={copy.sourceId}>{copy.client}</option>
              ))}
            </select>
          </label>
        ) : null}
        <button className="action-baseline" onClick={() => (mode === "edit" && activeCopy.id === editTargetCopy.id ? exitEditMode() : openSkillCopy(editTargetCopy, "edit"))}>
          <Edit3 size={16} />
          {mode === "edit" && activeCopy.id === editTargetCopy.id ? "取消编辑" : allAgentsScope ? "编辑基准" : "编辑"}
        </button>
        <StarButton active={starred} className="detail-star" label onClick={(event) => { event.stopPropagation(); onStar?.(skill); }} />
      </div>
      <MetaStrip
        items={[
          { label: isUninstalledSkill ? "卸载来源" : "已安装", value: isUninstalledSkill ? uninstallSource : installationAgents.join(", ") },
          { label: "版本", value: activeVersion ? `v${activeVersion}` : "" },
          ...(allAgentsScope ? [
            { label: "基准", value: baselineCopy.client },
            { label: "当前副本", value: activeCopy.client }
          ] : []),
          { label: "行数", value: activeCopy.lines },
          { label: "大小", value: `${Math.round((activeCopy.bytes || 0) / 1024)} KB` },
          { label: "更新", value: formatDate(activeCopy.updatedAt) }
        ]}
      />
      <div className={`installations-panel ${installations.length === 1 ? "single" : ""}`}>
        {(installations.length > 1 ? installations : [activeCopy]).map((copy) => (
            <div
              key={copy.id}
              className={`installation-card ${copy.id === activeCopy.id ? "active" : ""}`}
              onClick={() => openSkillCopy(copy)}
              title={`${copy.client} · 点击选择副本`}
            >
              <div className="copy-card-main">
                <strong>{copy.client}</strong>
                <button onClick={(event) => { event.stopPropagation(); copy.id === activeCopy.id && mode === "edit" ? exitEditMode() : openSkillCopy(copy, "edit"); }}>
                  {copy.id === activeCopy.id && mode === "edit" ? "取消编辑" : "编辑"}
                </button>
              </div>
              <button className="copy-path-row" onClick={(event) => { event.stopPropagation(); window.skillStudio.reveal(copy.dir); }} title="点击定位目录">
                {shortPath(copy.dir)}
              </button>
            </div>
        ))}
      </div>
      {versionSwitching ? <div className="version-switching-note">正在切换版本...</div> : null}
      {mode === "edit" ? (
        <div className="copy-edit-actions">
          <span>正在编辑 {activeCopy.client} · {shortPath(activeFile?.path)}</span>
          <button onClick={saveDraft} disabled={saving || draft === activeFile?.content}>
            <Save size={14} />
            {saving ? "保存中" : "保存修改"}
          </button>
          <button className="soft-button" onClick={() => { setDraft(activeFile?.content || ""); setPendingNavigation(null); }} disabled={draft === activeFile?.content}>
            <RotateCcw size={14} />
            取消修改
          </button>
        </div>
      ) : null}
      {pendingNavigation ? (
        <div className="pending-edit-panel">
          <span>当前文件有未保存修改，{pendingNavigation.type === "mode" ? "退出编辑前" : "切换前"}请选择处理方式。</span>
          <button
            onClick={async () => {
              const saved = await saveDraft();
              if (saved) await runPendingNavigation();
            }}
            disabled={saving}
          >
            保存并切换
          </button>
          <button className="soft-button" onClick={() => runPendingNavigation()} disabled={saving}>
            放弃修改
          </button>
          <button className="soft-button" onClick={() => setPendingNavigation(null)} disabled={saving}>
            继续编辑
          </button>
        </div>
      ) : null}
      {syncDraft ? (
        <div className="copy-sync-panel">
          <div>
            <strong>同步基准修改</strong>
            <span>{syncDraft.sourceCopy.client} 已保存 {syncDraft.relativePath}，可同步到其它 Agent。</span>
          </div>
          <div className="sync-target-list">
            {syncTargets.map((copy) => (
              <label key={copy.id}>
                <input
                  type="checkbox"
                  checked={syncTargetIds.includes(copy.id)}
                  onChange={(event) => {
                    setSyncTargetIds((current) => event.target.checked ? [...new Set([...current, copy.id])] : current.filter((id) => id !== copy.id));
                  }}
                />
                <span>{copy.client}</span>
              </label>
            ))}
          </div>
          <div className="sync-actions">
            <button onClick={() => setSyncTargetIds(syncTargets.map((copy) => copy.id))}>全选</button>
            <button className="soft-button" onClick={() => setSyncDraft(null)}>稍后</button>
            <button
              className="primary"
              disabled={!syncTargetIds.length || saving}
              onClick={async () => {
                setSaving(true);
                setFileError("");
                try {
                  const targets = syncTargets.filter((copy) => syncTargetIds.includes(copy.id));
                  for (const copy of targets) {
                    await window.skillStudio.saveFile(copyFilePath(copy, syncDraft.relativePath), syncDraft.content, {
                      skillDir: copy.dir,
                      skipAutoIncrement: true,
                      sourceInfo: {
                        sourceId: copy.sourceId,
                        client: copy.client,
                        sourceLabel: copy.sourceLabel
                      }
                    });
                  }
                  setSyncDraft(null);
                  setSyncTargetIds([]);
                  onSaved?.();
                } catch (err) {
                  setFileError(err.message || String(err));
                } finally {
                  setSaving(false);
                }
              }}
            >
              同步到选中 Agent
            </button>
          </div>
        </div>
      ) : null}
      <div className="detail-tags">
        {(skill.tags || []).length ? skill.tags.map((tag) => <TagPill key={tag} tag={tag} />) : <TagPill tag="untagged" />}
      </div>
      {fileNotice ? <div className="file-notice">{fileNotice}</div> : null}
      {fileError ? <div className="file-error">{fileError}</div> : null}
      <div className="reader-shell">
        <DirectoryTree
          skill={activeCopy}
          activePath={activeFile?.path}
          selectedDirPath={selectedDirPath}
          selectedPaths={selectedTreePaths}
          onNodeClick={handleTreeNodeClick}
          onOpenFile={openTreeFile}
          onSelectDirectory={(dirPath) => {
            setSelectedDirPath(dirPath);
            setCreateEntryDraft((current) => current ? { ...current, baseDir: dirPath } : current);
          }}
          onContextMenu={openTreeContextMenu}
          draft={createEntryDraft}
          onDraftChange={(name) => setCreateEntryDraft((current) => current ? { ...current, name } : current)}
          onDraftSubmit={submitTreeDraft}
          onDraftCancel={() => setCreateEntryDraft(null)}
        />
        <section className="content-pane">
          <div className="reader-label">
            <FileText size={15} />
            <span className="reader-file-title">
              <strong>{activeFile?.name || "SKILL.md"}</strong>
              <small>{shortPath(activeFile?.path)}</small>
            </span>
            <button title="在当前目录新增文件" onClick={() => beginCreateEntry("file")}>+ 文件</button>
            <button title="在当前目录新增目录" onClick={() => beginCreateEntry("directory")}>+ 目录</button>
            <button className="reader-mode-toggle" onClick={() => setMode(mode === "edit" ? "view" : "edit")}>
              {mode === "edit" ? "编辑模式" : "阅读模式"}
            </button>
          </div>
          {mode === "edit" ? (
            <HighlightedEditor
              value={draft}
              language={codeLanguageFromPath(activeFile?.path || activeFile?.name)}
              onChange={(event) => setDraft(event.target.value)}
            />
          ) : activeFile ? (
            <SkillReader file={activeFile} />
          ) : null}
        </section>
      </div>
      {treeMenu ? (
        <div className="tree-context-menu" style={{ left: treeMenu.x, top: treeMenu.y }} onClick={(event) => event.stopPropagation()}>
          <button onClick={() => copyTreePath(treeMenu.node, false)}>复制相对路径</button>
          <button onClick={() => copyTreePath(treeMenu.node, true)}>复制绝对路径</button>
          {treeMenu.node.type === "directory" ? (
            <>
              <hr />
              <button onClick={() => beginCreateEntry("file", treeMenu.node.path)}>在此新增文件</button>
              <button onClick={() => beginCreateEntry("directory", treeMenu.node.path)}>在此新增目录</button>
            </>
          ) : null}
          {treeMenu.node.path !== activeCopy?.dir ? (
            <>
              <hr />
              <button onClick={() => beginRenameEntry(treeMenu.node)}>重命名</button>
              {treeMenu.node.path !== activeCopy?.filePath ? (
                <button onClick={() => deleteDirectoryEntry(treeMenu.node)}>删除</button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
      {historyOpen ? (
        <div className="history-overlay">
          <div className="history-panel">
            <div className="history-head">
              <div>
                <h3>历史版本</h3>
                <p>{activeCopy?.client} · {history.length} 个历史目录版本</p>
              </div>
              <button onClick={() => setHistoryOpen(false)}>关闭</button>
            </div>
            <div className="history-body" style={{ "--history-list-width": `${historyListWidth}px` }}>
              <div className="history-list">
                {history.length ? history.map((entry) => (
                  <button key={entry.id} className={selectedVersion?.id === entry.id ? "selected" : ""} onClick={() => selectVersion(entry)}>
                    <strong>{entry.label || entry.id}</strong>
                    <span>{entry.reason} · {formatDate(entry.createdAt)}</span>
                  </button>
                )) : <p>还没有历史版本。保存 skill 后会自动创建目录版本。</p>}
              </div>
              <div
                className="history-resizer"
                onMouseDown={(event) => {
                  event.preventDefault();
                  const startX = event.clientX;
                  const startWidth = historyListWidth;
                  const move = (moveEvent) => {
                    setHistoryListWidth(Math.max(150, Math.min(320, startWidth + moveEvent.clientX - startX)));
                  };
                  const up = () => {
                    window.removeEventListener("mousemove", move);
                    window.removeEventListener("mouseup", up);
                  };
                  window.addEventListener("mousemove", move);
                  window.addEventListener("mouseup", up);
                }}
              />
              <div className="diff-pane">
                {versionDetail ? (
                  <>
                    <div className="diff-toolbar">
                      <span>对比当前目录与 {versionDetail.version?.label || selectedVersion?.label || "历史版本"}</span>
                      <button onClick={() => restoreVersion(versionDetail.version?.id || selectedVersion?.id)} disabled={saving}>
                        <RotateCcw size={13} />
                        回滚到此版本
                      </button>
                    </div>
                    <DirectoryDiffViewer detail={versionDetail} />
                  </>
                ) : (
                  <div className="diff-empty">选择一个历史版本查看更改。</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {upgradeTargetOpen ? (
        <div className="history-overlay">
          <div className="history-panel upgrade-target-panel">
            <div className="history-head">
              <div>
                <h3>选择升级的 Agent</h3>
                <p>{skill.name} · 每次升级只写入选中的 Agent 目录</p>
              </div>
              <button onClick={() => setUpgradeTargetOpen(false)} disabled={upgradeBusy}>关闭</button>
            </div>
            <div className="upgrade-target-list">
              {installations.map((copy) => (
                <label key={copy.id} className={upgradeTargetCopyId === copy.id ? "selected" : ""}>
                  <input
                    type="radio"
                    name="upgrade-target-copy"
                    checked={upgradeTargetCopyId === copy.id}
                    onChange={() => setUpgradeTargetCopyId(copy.id)}
                  />
                  <span>
                    <strong>{copy.client}</strong>
                    <small>{shortPath(copy.dir)}</small>
                  </span>
                  <em>{skillVersion(copy) ? `v${skillVersion(copy)}` : "无版本"}</em>
                </label>
              ))}
            </div>
            <div className="modal-actions upgrade-target-actions">
              <button className="soft-button" onClick={() => setUpgradeTargetOpen(false)} disabled={upgradeBusy}>取消</button>
              <button
                className="action-install"
                disabled={upgradeBusy || !upgradeTargetCopyId}
                onClick={async () => {
                  const copy = installations.find((item) => item.id === upgradeTargetCopyId) || activeCopy;
                  setUpgradeTargetOpen(false);
                  await prepareUpgradePreview(copy);
                }}
              >
                继续
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {upgradeOpen ? (
        <div className="history-overlay">
          <div className={`history-panel upgrade-panel ${upgradeBusy ? "is-upgrading" : ""}`}>
            <div className="history-head">
              <div>
                <h3>确认升级</h3>
                <p>{(upgradeCopy || activeCopy)?.client} · {upgradeDetail?.fromVersion || "-"} {"->"} {upgradeDetail?.toVersion || "-"}</p>
              </div>
              <div className="modal-actions">
                <button className="soft-button" onClick={() => { setUpgradeOpen(false); setUpgradeCopy(null); }} disabled={upgradeBusy}>取消</button>
                <button className={upgradeBusy ? "upgrade-confirm-busy" : ""} onClick={confirmSkillUpgrade} disabled={upgradeBusy || !upgradeDetail?.files?.length}>
                  {upgradeBusy ? "升级中..." : `升级到 v${upgradeDetail?.toVersion || ""}`}
                </button>
              </div>
            </div>
            <div className="upgrade-body">
              {upgradeDetail ? (
                <>
                  <div className="diff-toolbar">
                    <span>升级前后差异。确认后才会写入 SKILL.md 并创建新的 skill 版本。</span>
                  </div>
                  <DirectoryDiffViewer detail={upgradeDetail} />
                </>
              ) : (
                <div className="diff-empty">正在生成升级差异。</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SettingsPage({ settings, onSave, saving }) {
  const fallbackSettings = {
    sources: [],
    ignorePatterns: [],
    installSourceId: "agents",
    baselineSourceId: "agents",
    installTargetMode: "remember-last",
    mergeDuplicateSkills: true,
    skillVersionRetentionDays: 30,
    logRetentionDays: null,
    eventRetentionDays: null
  };
  const [draft, setDraft] = useState(settings || {
    sources: [],
    ignorePatterns: [],
    installSourceId: "agents",
    baselineSourceId: "agents",
    installTargetMode: "remember-last",
    mergeDuplicateSkills: true,
    skillVersionRetentionDays: 30,
    logRetentionDays: null,
    eventRetentionDays: null
  });
  const [settingsMode, setSettingsMode] = useState("visual");
  const [jsonText, setJsonText] = useState(JSON.stringify(settings || fallbackSettings, null, 2));
  const [jsonError, setJsonError] = useState("");
  const [ignoreText, setIgnoreText] = useState((settings?.ignorePatterns || []).join("\n"));
  const [appInfo, setAppInfo] = useState(null);

  useEffect(() => {
    if (!settings) return;
    setDraft(settings);
    setIgnoreText((settings.ignorePatterns || []).join("\n"));
    setJsonText(JSON.stringify(settings, null, 2));
    setJsonError("");
  }, [settings]);

  useEffect(() => {
    let alive = true;
    window.skillStudio.getAppInfo?.().then((info) => {
      if (alive) setAppInfo(info);
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  function switchSettingsMode(mode) {
    if (mode === settingsMode) return;
    if (mode === "json") {
      const synced = {
        ...draft,
        ignorePatterns: ignoreText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      };
      setJsonText(JSON.stringify(synced, null, 2));
      setJsonError("");
    }
    setSettingsMode(mode);
  }

  function updateSource(id, patch) {
    setDraft((current) => ({
      ...current,
      sources: current.sources.map((source) => source.id === id ? { ...source, ...patch } : source)
    }));
  }

  function addSource() {
    const id = `custom-${Date.now()}`;
    setDraft((current) => ({
      ...current,
      sources: [
        ...current.sources,
        { id, client: "New Agent", label: "New Agent Skills", root: "~/skills", enabled: true }
      ],
      installSourceId: current.installSourceId || id
    }));
  }

  function removeSource(id) {
    setDraft((current) => {
      const sources = current.sources.filter((source) => source.id !== id);
      return {
        ...current,
        sources,
        installSourceId: current.installSourceId === id ? (sources.find((source) => source.enabled)?.id || "agents") : current.installSourceId,
        baselineSourceId: current.baselineSourceId === id ? (sources.find((source) => source.enabled)?.id || "agents") : current.baselineSourceId
      };
    });
  }

  async function save() {
    if (settingsMode === "json") {
      try {
        const parsed = JSON.parse(jsonText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("配置必须是 JSON object。");
        setJsonError("");
        await onSave(parsed);
      } catch (error) {
        setJsonError(error.message || String(error));
      }
      return;
    }
    const cleaned = {
      ...draft,
      ignorePatterns: ignoreText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    };
    await onSave(cleaned);
  }

  const installable = draft.sources.filter((source) => source.enabled);
  const setRetention = (key, value) => {
    setDraft((current) => ({
      ...current,
      [key]: value === "forever" ? null : Math.max(1, Number(current[key]) || 30)
    }));
  };
  const setRetentionDays = (key, value) => {
    setDraft((current) => ({
      ...current,
      [key]: Math.max(1, Math.floor(Number(value) || 1))
    }));
  };

  return (
    <section className="settings-page">
      <div className="settings-head">
        <div>
          <h2>Settings</h2>
          <p>管理安装目标、Agent 命名和 skill 目录展示规则。</p>
        </div>
        <div className="settings-head-actions">
          <div className="settings-mode-switch">
            <button className={settingsMode === "visual" ? "on" : ""} onClick={() => switchSettingsMode("visual")}>可视化</button>
            <button className={settingsMode === "json" ? "on" : ""} onClick={() => switchSettingsMode("json")}>JSON</button>
          </div>
          <button onClick={save} disabled={saving}>
            <Save size={16} />
            {saving ? "保存中" : "保存设置"}
          </button>
        </div>
      </div>

      <section className="settings-version-card">
        <div>
          <span>应用版本</span>
          <strong>{appInfo?.version ? `v${appInfo.version}` : "读取中"}</strong>
        </div>
        <p>{appInfo?.name || "Skill Manager"} · {appInfo?.isPackaged ? "已打包应用" : "开发模式"}</p>
      </section>

      {settingsMode === "json" ? (
        <section className="settings-card settings-json-card">
          <div className="settings-card-head">
            <h3>JSON 配置</h3>
            <p>直接编辑完整 settings。保存时会校验 JSON，并继续应用默认值与来源过滤规则。</p>
          </div>
          <textarea
            className={`settings-json-editor ${jsonError ? "has-error" : ""}`}
            value={jsonText}
            onChange={(event) => {
              setJsonText(event.target.value);
              if (jsonError) setJsonError("");
            }}
            spellCheck={false}
          />
          {jsonError ? <div className="json-error">{jsonError}</div> : null}
        </section>
      ) : (
      <div className="settings-grid">
        <section className="settings-card">
          <div className="settings-card-head">
            <h3>默认安装目标</h3>
            <p>Discover 安装和 Uninstalled 恢复默认会放到这里。</p>
          </div>
          <label className="settings-field">
            <span>Install to Agent</span>
            <select value={draft.installSourceId || "agents"} onChange={(event) => setDraft({ ...draft, installSourceId: event.target.value })}>
              {installable.map((source) => (
                <option key={source.id} value={source.id}>{source.client} · {shortPath(source.root)}</option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span>默认基准 Agent</span>
            <select value={draft.baselineSourceId || "agents"} onChange={(event) => setDraft({ ...draft, baselineSourceId: event.target.value })}>
              {installable.map((source) => (
                <option key={source.id} value={source.id}>{source.client} · {shortPath(source.root)}</option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span>安装弹窗默认选择</span>
            <select value={draft.installTargetMode || "remember-last"} onChange={(event) => setDraft({ ...draft, installTargetMode: event.target.value })}>
              <option value="remember-last">记住上次选择</option>
              <option value="always-default">每次使用默认 Agent</option>
            </select>
          </label>
          <label className="toggle-field settings-toggle">
            <input type="checkbox" checked={draft.mergeDuplicateSkills !== false} onChange={(event) => setDraft({ ...draft, mergeDuplicateSkills: event.target.checked })} />
            All Agents 下合并同名 skill
          </label>
        </section>

        <section className="settings-card">
          <div className="settings-card-head">
            <h3>记录保留</h3>
            <p>Events 和 Logs 默认永久保留；填写天数后会自动清理更早的记录。</p>
          </div>
          <label className="settings-field retention-field">
            <span>Skill Versions</span>
            <em>保留天数</em>
            <input
              type="number"
              min="1"
              value={draft.skillVersionRetentionDays || 30}
              onChange={(event) => setRetentionDays("skillVersionRetentionDays", event.target.value)}
            />
          </label>
          <label className="settings-field retention-field">
            <span>Operation Events</span>
            <select value={draft.eventRetentionDays ? "custom" : "forever"} onChange={(event) => setRetention("eventRetentionDays", event.target.value)}>
              <option value="forever">永久保留</option>
              <option value="custom">按天数保留</option>
            </select>
            <input
              type="number"
              min="1"
              disabled={!draft.eventRetentionDays}
              value={draft.eventRetentionDays || 30}
              onChange={(event) => setRetentionDays("eventRetentionDays", event.target.value)}
            />
          </label>
          <label className="settings-field retention-field">
            <span>Operation Logs</span>
            <select value={draft.logRetentionDays ? "custom" : "forever"} onChange={(event) => setRetention("logRetentionDays", event.target.value)}>
              <option value="forever">永久保留</option>
              <option value="custom">按天数保留</option>
            </select>
            <input
              type="number"
              min="1"
              disabled={!draft.logRetentionDays}
              value={draft.logRetentionDays || 30}
              onChange={(event) => setRetentionDays("logRetentionDays", event.target.value)}
            />
          </label>
        </section>

        <section className="settings-card">
          <div className="settings-card-head">
            <h3>目录 Ignore</h3>
            <p>类似 gitignore。配置后文件不会出现在 skill 目录树里。</p>
          </div>
          <textarea
            className="ignore-editor"
            value={ignoreText}
            onChange={(event) => setIgnoreText(event.target.value)}
            spellCheck={false}
          />
        </section>

        <section className="settings-card wide">
          <div className="settings-card-head row">
            <div>
              <h3>Agents</h3>
              <p>配置左侧 Agents 的命名，以及每个 Agent 对应的 skills 目录。</p>
            </div>
            <button className="soft-button" onClick={addSource}>新增 Agent</button>
          </div>
          <div className="agent-editor-list">
            {draft.sources.map((source) => (
              <div className="agent-editor-row" key={source.id}>
                <label className="toggle-field">
                  <input type="checkbox" checked={source.enabled} onChange={(event) => updateSource(source.id, { enabled: event.target.checked })} />
                  启用
                </label>
                <label>
                  <span>名称</span>
                  <input value={source.client} onChange={(event) => updateSource(source.id, { client: event.target.value })} />
                </label>
                <label>
                  <span>说明</span>
                  <input value={source.label} onChange={(event) => updateSource(source.id, { label: event.target.value })} />
                </label>
                <label>
                  <span>目录</span>
                  <input value={source.root} onChange={(event) => updateSource(source.id, { root: event.target.value })} />
                </label>
                <button className="tiny-danger" onClick={() => removeSource(source.id)}>移除</button>
              </div>
            ))}
          </div>
        </section>
      </div>
      )}
    </section>
  );
}

function InstallTargetDialog({ pending, targets, selectedTargets, onChangeTargets, onCancel, onConfirm, busy }) {
  if (!pending) return null;
  const name = pending.item?.name || pending.item?.slug || "skill";
  const isUninstall = pending.type === "uninstall";
  const isUpdate = pending.forceUpdate;
  const selectedSet = new Set(selectedTargets);
  function toggleTarget(id) {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChangeTargets([...next]);
  }
  return (
    <div className="modal-overlay">
      <div className="install-dialog">
        <div>
          <h3>{isUninstall ? "选择卸载的 Agent" : isUpdate ? "选择更新的 Agent" : "选择安装到的 Agent"}</h3>
          <p>{name}</p>
        </div>
        <div className="target-check-list">
          {targets.map((target) => (
            <label key={target.id} className="target-check">
              <input type="checkbox" checked={selectedSet.has(target.id)} onChange={() => toggleTarget(target.id)} />
              <span>
                <strong>{target.client}</strong>
                <em>{shortPath(target.root || target.dir)}</em>
              </span>
            </label>
          ))}
        </div>
        <div className="dialog-actions">
          <button className="soft-button" onClick={onCancel} disabled={busy}>取消</button>
          <button onClick={onConfirm} disabled={busy || !selectedTargets.length}>{busy ? "处理中" : isUninstall ? "卸载" : isUpdate ? "更新" : "安装"}</button>
        </div>
      </div>
    </div>
  );
}

function OperationLogPage({ logs, onRefresh, onClear }) {
  return (
    <section className="logs-page">
      <div className="settings-head">
        <div>
          <h2>Operation Logs</h2>
          <p>查看 install、uninstall、restore 和 settings 的最近操作结果。</p>
        </div>
        <div className="log-actions">
          <button className="soft-button" onClick={onRefresh}>
            <RefreshCcw size={16} />
            刷新
          </button>
          <button onClick={onClear}>清空日志</button>
        </div>
      </div>
      <div className="log-list">
        {logs.length ? logs.map((log) => (
          <article className={`log-entry ${log.status}`} key={log.id}>
            <div className="log-entry-head">
              <span>{log.type}</span>
              <strong>{log.title || "-"}</strong>
              <em>{formatDate(log.createdAt)}</em>
            </div>
            <p>{log.message}</p>
            {log.detail ? <code>{shortPath(log.detail)}</code> : null}
          </article>
        )) : (
          <div className="list-empty">还没有操作日志。</div>
        )}
      </div>
    </section>
  );
}

function OperationEventPage({ events, onRefresh, onClear }) {
  const stages = ["queued", "running", "success"];
  function stageState(event, stage) {
    if (event.status === "failed") return stage === "success" ? "failed" : "done";
    const index = stages.indexOf(stage);
    const current = stages.indexOf(event.status);
    if (index < current) return "done";
    if (index === current) return "active";
    return "";
  }
  return (
    <section className="logs-page">
      <div className="settings-head">
        <div>
          <h2>Operation Events</h2>
          <p>后台 install、uninstall、update、restore 的状态流转和进度。</p>
        </div>
        <div className="log-actions">
          <button className="soft-button" onClick={onRefresh}>
            <RefreshCcw size={16} />
            刷新
          </button>
          <button onClick={onClear}>清空事件</button>
        </div>
      </div>
      <div className="log-list">
        {events.length ? events.map((event) => {
          const percent = Math.round((event.progress / Math.max(1, event.total)) * 100);
          return (
            <article className={`event-entry ${event.status}`} key={event.id}>
              <div className="log-entry-head">
                <span>{event.type}</span>
                <strong>{event.title}</strong>
                <em>{formatDate(event.updatedAt)}</em>
              </div>
              <div className="event-status-row">
                <strong>{event.status}</strong>
                <b>{percent}%</b>
              </div>
              <div className="event-stage-flow">
                {stages.map((stage) => (
                  <div key={stage} className={stageState(event, stage)}>
                    <span />
                    <em>{stage === "success" && event.status === "failed" ? "failed" : stage}</em>
                  </div>
                ))}
              </div>
              <div className="event-progress">
                <div style={{ width: `${percent}%` }} />
              </div>
              <p>{event.status} · {event.progress}/{event.total} · {event.current || event.detail}</p>
              {event.error ? <code>{event.error}</code> : event.detail ? <code>{event.detail}</code> : null}
            </article>
          );
        }) : (
          <div className="list-empty">还没有后台事件。</div>
        )}
      </div>
    </section>
  );
}

function TagSkillPanel({ tag, skills, onOpenSkill }) {
  if (!tag) {
    return (
      <section className="detail empty">
        <Tags size={34} />
        <p>选择一个标签，查看包含该标签的所有 skill。</p>
      </section>
    );
  }
  return (
    <section className="tag-skill-panel">
      <div className="tag-skill-head">
        <TagPill tag={tag}>标签：{tag}</TagPill>
        <p>{skills.length} 个 skill 包含这个标签</p>
      </div>
      <div className="tag-skill-list">
        {skills.map((skill) => (
          <button key={skill.id} className="tag-skill-card" onClick={() => onOpenSkill(skill)}>
            <div className="skill-glyph">{skill.name.slice(0, 1).toUpperCase()}</div>
            <span>
              <strong>{skill.name}</strong>
              <em>{skill.installationCount ? `${[...new Set((skill.installations || [skill]).map((copy) => copy.client))].join(", ")} · ${skill.installationCount} copies` : skill.client}</em>
              <small>{skill.description || "暂无描述"}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SearchConfig({ open, options, onChange }) {
  const fields = [
    ["name", "名称"],
    ["description", "描述"],
    ["tags", "标签/来源"],
    ["path", "路径"],
    ["content", "内容"]
  ];
  if (!open) return null;
  return (
    <div className="search-config-panel">
      <div className="search-config-title">搜索范围</div>
      {fields.map(([key, label]) => (
        <label key={key} className="search-check">
          <input
            type="checkbox"
            checked={Boolean(options[key])}
            onChange={(event) => onChange({ ...options, [key]: event.target.checked })}
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

function searchPlaceholder(options) {
  const labels = [
    ["name", "名称"],
    ["description", "描述"],
    ["tags", "标签"],
    ["path", "路径"],
    ["content", "内容"]
  ]
    .filter(([key]) => options[key])
    .map(([, label]) => label);
  return `搜索${labels.length ? labels.join("、") : "名称"}，可自定义`;
}

function App() {
  const { data, loading, error, refresh } = useSkillData();
  const [discoverSort, setDiscoverSort] = useState("alltime");
  const discoverSource = discoverSort;
  const githubTrends = useGithubTrends(discoverSource);
  const [uninstalledData, setUninstalledData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [query, setQuery] = useState("");
  const [searchConfigOpen, setSearchConfigOpen] = useState(false);
  const [searchOptions, setSearchOptions] = useState({
    name: true,
    description: true,
    tags: true,
    path: true,
    content: false
  });
  const [listMode, setListMode] = useState("installed");
  const [localSort, setLocalSort] = useState("updated");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [tagCloudOpen, setTagCloudOpen] = useState(false);
  const [activeTags, setActiveTags] = useState([]);
  const [tagMatchMode, setTagMatchMode] = useState("and");
  const [selected, setSelected] = useState(null);
  const [selectedDiscover, setSelectedDiscover] = useState(null);
  const [selectedStarred, setSelectedStarred] = useState(null);
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedInstallTargets, setSelectedInstallTargets] = useState(["agents"]);
  const [dialogTargetIds, setDialogTargetIds] = useState(["agents"]);
  const [pendingInstall, setPendingInstall] = useState(null);
  const [starredMap, setStarredMap] = useState({});
  const [operationLogs, setOperationLogs] = useState([]);
  const [operationEvents, setOperationEvents] = useState([]);
  const [busyAction, setBusyAction] = useState("");
  const [notice, setNotice] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);

  async function refreshAll() {
    await refresh();
    try {
      setUninstalledData(await window.skillStudio.scanUninstalled());
    } catch {
      setUninstalledData({ skills: [] });
    }
    await refreshLogs();
  }

  async function refreshLogs() {
    try {
      setOperationLogs(await window.skillStudio.operationLogs());
    } catch {
      setOperationLogs([]);
    }
  }

  async function refreshEvents() {
    try {
      setOperationEvents(await window.skillStudio.operationEvents());
    } catch {
      setOperationEvents([]);
    }
  }

  async function clearLogs() {
    if (!window.confirm("确认清空所有 Operation Logs？此操作不可撤销。")) return;
    await window.skillStudio.clearOperationLogs();
    setOperationLogs([]);
  }

  async function clearEvents() {
    if (!window.confirm("确认清空所有 Operation Events？此操作不可撤销。")) return;
    await window.skillStudio.clearOperationEvents();
    setOperationEvents([]);
  }

  useEffect(() => {
    setStarredMap(readStoredJson(starStorageKey, legacyStarStorageKey, {}));
    window.skillStudio.scanUninstalled().then(setUninstalledData).catch(() => setUninstalledData({ skills: [] }));
    refreshLogs();
    refreshEvents();
    window.skillStudio.getSettings().then((result) => {
      setSettings(result);
      const remembered = readStoredJson(installTargetsStorageKey, legacyInstallTargetsStorageKey, []);
      const initialTargets = result.installTargetMode === "remember-last" && remembered.length ? remembered : [result.installSourceId || "agents"];
      setSelectedInstallTargets(initialTargets);
      setDialogTargetIds(initialTargets);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 1800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      await refreshEvents();
      const hasRunning = operationEvents.some((event) => event.status === "queued" || event.status === "running");
      if (hasRunning) await refreshAll();
    }, 1600);
    return () => window.clearInterval(timer);
  }, [operationEvents]);

  function saveStarred(next) {
    setStarredMap(next);
    localStorage.setItem(starStorageKey, JSON.stringify(next));
  }

  function toggleStar(type, item) {
    const snapshot = starSnapshot(type, item);
    const next = { ...starredMap };
    if (next[snapshot.key]) delete next[snapshot.key];
    else next[snapshot.key] = snapshot;
    saveStarred(next);
  }

  function isStarred(type, item) {
    return Boolean(starredMap[starKey(type, item)]);
  }

  async function uninstallSkill(skill, skipConfirm = false) {
    const copies = skill.installations || [skill];
    const confirmed = skipConfirm || window.confirm(`卸载 ${skill.name}？\n不会真正删除，会移动到 Uninstalled，之后可以恢复安装。`);
    if (!confirmed) return false;
    try {
      await window.skillStudio.submitEvent({
        type: "uninstall",
        title: skill.name,
        skills: copies.map((copy) => ({
          dir: copy.dir,
          client: copy.client,
          sourceId: copy.sourceId,
          sourceLabel: copy.sourceLabel
        }))
      });
      await refreshEvents();
      setNotice(`${skill.name} 已提交后台卸载。`);
      return true;
    } catch (err) {
      setNotice(`提交失败：${err.message || String(err)}`);
      return false;
    }
  }

  function defaultTargetSelection() {
    if (settings?.installTargetMode === "always-default") return [settings.installSourceId || "agents"];
    return selectedInstallTargets.length ? selectedInstallTargets : [settings?.installSourceId || "agents"];
  }

  function openInstallDialog(type, item, targets = installTargets, extras = {}) {
    const nextTargets = defaultTargetSelection().filter((id) => targets.some((target) => target.id === id));
    setDialogTargetIds(nextTargets.length ? nextTargets : targets.slice(0, 1).map((target) => target.id));
    setPendingInstall({ type, item, targets, ...extras });
  }

  function beginInstallDiscover(item, forceUpdate = false) {
    openInstallDialog("discover", item, installTargets, { forceUpdate });
  }

  function beginRestoreSkill(skill) {
    openInstallDialog("uninstalled", skill);
  }

  function beginInstallLocal(skill) {
    openInstallDialog("local", skill);
  }

  function beginUninstallMany(item, skills) {
    const targets = skills.map((skill) => ({
      id: skill.id,
      client: skill.client,
      root: skill.dir,
      dir: skill.dir,
      skill
    }));
    setDialogTargetIds(targets.map((target) => target.id));
    setPendingInstall({ type: "uninstall", item, targets });
  }

  async function confirmPendingInstall() {
    if (!pendingInstall) return;
    const targetIds = dialogTargetIds.filter((id) => pendingInstall.targets?.some((target) => target.id === id));
    if (!targetIds.length) return;
    const eventPayload = pendingInstall.type === "discover" ? {
      type: "install-discover",
      title: pendingInstall.item.name,
      item: pendingInstall.item,
      targetIds,
      forceUpdate: pendingInstall.forceUpdate
    } : pendingInstall.type === "local" ? {
      type: "install-local",
      title: pendingInstall.item.name,
      skillName: pendingInstall.item.name,
      skillDir: pendingInstall.item.dir,
      targetIds
    } : pendingInstall.type === "uninstalled" ? {
      type: "restore",
      title: pendingInstall.item.name,
      skillName: pendingInstall.item.name,
      skillDir: pendingInstall.item.dir,
      targetIds
    } : {
      type: "uninstall",
      title: pendingInstall.item.name,
      skills: pendingInstall.targets.filter((target) => targetIds.includes(target.id)).map((target) => ({
        dir: target.skill.dir,
        client: target.skill.client
      }))
    };
    try {
      await window.skillStudio.submitEvent(eventPayload);
      if (settings?.installTargetMode !== "always-default" && pendingInstall.type !== "uninstall") {
        setSelectedInstallTargets(targetIds);
        localStorage.setItem(installTargetsStorageKey, JSON.stringify(targetIds));
      }
      setPendingInstall(null);
      await refreshEvents();
      setNotice(`${pendingInstall.item.name} 已提交后台执行。`);
    } catch (err) {
      setNotice(`提交失败：${err.message || String(err)}`);
    }
  }

  async function restoreSkill(skill, targetSourceId = selectedInstallTargets[0]) {
    setBusyAction(`restore:${skill.id}`);
    setNotice("");
    try {
      const result = await window.skillStudio.restoreSkill(skill.dir, targetSourceId);
      await refreshAll();
      setListMode("installed");
      setSelected(null);
      setNotice(result?.missing ? `${skill.name} 的 Uninstalled 目录已不存在，列表已刷新。` : `${skill.name} 已恢复安装。`);
    } catch (err) {
      setNotice(`恢复失败：${err.message || String(err)}`);
    } finally {
      setBusyAction("");
    }
  }

  async function installDiscover(item, targetSourceId = selectedInstallTargets[0]) {
    setBusyAction(`discover:${item.id}`);
    setNotice("");
    try {
      const result = await window.skillStudio.installDiscover(item, targetSourceId);
      await refreshAll();
      setNotice(result?.alreadyInstalled ? `${item.name} 已经安装在目标 Agent。` : `${item.name} 已安装到本地。`);
    } catch (err) {
      setNotice(`安装失败：${err.message || String(err)}`);
    } finally {
      setBusyAction("");
    }
  }

  async function installLocalSkill(skill, targetSourceId) {
    setBusyAction(`install-local:${skill.id}:${targetSourceId}`);
    setNotice("");
    try {
      const result = await window.skillStudio.installLocalSkill(skill.dir, targetSourceId);
      await refreshAll();
      setNotice(result?.alreadyInstalled ? `${skill.name} 已经安装在目标 Agent。` : `${skill.name} 已安装到本地。`);
    } catch (err) {
      setNotice(`安装失败：${err.message || String(err)}`);
    } finally {
      setBusyAction("");
    }
  }

  async function installDiscoverMany(item, targetIds, forceUpdate = false) {
    let ok = 0;
    setBusyAction(`discover:${item.id}`);
    setNotice("");
    try {
      for (const targetId of targetIds) {
        await window.skillStudio.installDiscover(item, targetId, forceUpdate);
        ok += 1;
      }
      await refreshAll();
      setNotice(`${item.name} 已${forceUpdate ? "更新" : "安装"}到 ${ok} 个 Agent。`);
    } catch (err) {
      await refreshAll();
      setNotice(`安装失败：${err.message || String(err)}`);
    } finally {
      setBusyAction("");
    }
  }

  async function installLocalMany(skill, targetIds) {
    let ok = 0;
    setBusyAction(`install-local:${skill.id}`);
    setNotice("");
    try {
      for (const targetId of targetIds) {
        await window.skillStudio.installLocalSkill(skill.dir, targetId);
        ok += 1;
      }
      await refreshAll();
      setNotice(`${skill.name} 已安装到 ${ok} 个 Agent。`);
    } catch (err) {
      await refreshAll();
      setNotice(`安装失败：${err.message || String(err)}`);
    } finally {
      setBusyAction("");
    }
  }

  async function restoreSkillMany(skill, targetIds) {
    let ok = 0;
    setBusyAction(`restore:${skill.id}`);
    setNotice("");
    try {
      for (let index = 0; index < targetIds.length; index += 1) {
        const targetId = targetIds[index];
        if (index === targetIds.length - 1) await window.skillStudio.restoreSkill(skill.dir, targetId);
        else await window.skillStudio.installLocalSkill(skill.dir, targetId);
        ok += 1;
      }
      await refreshAll();
      setListMode("installed");
      setSelected(null);
      setNotice(`${skill.name} 已安装到 ${ok} 个 Agent。`);
    } catch (err) {
      await refreshAll();
      setNotice(`恢复失败：${err.message || String(err)}`);
    } finally {
      setBusyAction("");
    }
  }

  async function uninstallMany(skills) {
    if (!skills.length) return;
    const confirmed = window.confirm(`卸载选中的 ${skills.length} 个安装副本？\n不会真正删除，会移动到 Uninstalled。`);
    if (!confirmed) return;
    setBusyAction(`uninstall-many:${skills.map((skill) => skill.id).join(",")}`);
    setNotice("");
    let ok = 0;
    try {
      for (const skill of skills) {
        await window.skillStudio.uninstallSkill(skill.dir);
        ok += 1;
      }
      await refreshAll();
      setSelected(null);
      setNotice(`已卸载 ${ok} 个安装副本。`);
    } catch (err) {
      await refreshAll();
      setNotice(`卸载失败：${err.message || String(err)}`);
    } finally {
      setBusyAction("");
    }
  }

  async function saveSettings(nextSettings) {
    setSettingsSaving(true);
    setNotice("");
    try {
      const saved = await window.skillStudio.saveSettings(nextSettings);
      setSettings(saved);
      if (saved.installTargetMode === "always-default") {
        const defaults = [saved.installSourceId || "agents"];
        setSelectedInstallTargets(defaults);
        setDialogTargetIds(defaults);
      }
      await refreshAll();
      setNotice("设置已保存。");
    } catch (err) {
      setNotice(`设置保存失败：${err.message || String(err)}`);
    } finally {
      setSettingsSaving(false);
    }
  }

  const agentCounts = useMemo(() => {
    const map = new Map();
    (data?.skills || []).forEach((skill) => map.set(skill.client, (map.get(skill.client) || 0) + 1));
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [data]);

  const installedFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (data?.skills || []).filter((skill) => {
      const sourceOk = sourceFilter === "all" || skill.client === sourceFilter;
      if (!sourceOk) return false;
      if (activeTags.length) {
        const skillTags = skill.tags || [];
        const tagOk = tagMatchMode === "or"
          ? activeTags.some((tag) => skillTags.includes(tag))
          : activeTags.every((tag) => skillTags.includes(tag));
        if (!tagOk) return false;
      }
      return matchesSearchFields(localSkillSearchValues(skill, searchOptions), q);
    });
    const visible = sourceFilter === "all" && settings?.mergeDuplicateSkills !== false ? mergeSkillCopies(matches) : matches;
    return visible.sort((a, b) => {
      if (localSort === "alpha") return a.name.localeCompare(b.name);
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }, [data, query, sourceFilter, activeTags, tagMatchMode, localSort, searchOptions, settings]);

  const tagCounts = useMemo(() => {
    const map = new Map();
    (data?.skills || []).forEach((skill) => {
      if (sourceFilter !== "all" && skill.client !== sourceFilter) return;
      (skill.tags || []).forEach((tag) => {
        if (!tag) return;
        map.set(tag, (map.get(tag) || 0) + 1);
      });
    });
    return [...map.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [data, sourceFilter]);

  const allTagCounts = useMemo(() => {
    const map = new Map();
    (data?.skills || []).forEach((skill) => {
      (skill.tags || []).forEach((tag) => {
        if (!tag) return;
        map.set(tag, (map.get(tag) || 0) + 1);
      });
    });
    return [...map.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [data]);

  const selectedTagSkills = useMemo(() => {
    if (!selectedTag) return [];
    const matches = (data?.skills || []).filter((skill) => (skill.tags || []).includes(selectedTag));
    const visible = settings?.mergeDuplicateSkills !== false ? mergeSkillCopies(matches) : matches;
    return visible.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }, [data, selectedTag, settings]);

  const uninstalledFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (uninstalledData?.skills || []).filter((skill) => {
      return matchesSearchFields(localSkillSearchValues(skill, searchOptions), q);
    });
    const visible = settings?.mergeDuplicateSkills !== false ? mergeSkillCopies(matches) : matches;
    return visible.sort((a, b) => a.name.localeCompare(b.name));
  }, [uninstalledData, query, searchOptions, settings]);

  const discoverItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return githubTrends.items
      .filter((item) => matchesSearchFields(discoverSearchValues(item, searchOptions), q))
      .sort((a, b) => (a.rank || 999999) - (b.rank || 999999) || b.stars - a.stars);
  }, [githubTrends.items, query, discoverSource, searchOptions]);

  const discoverInstalledMap = useMemo(() => {
    const map = new Map();
    (data?.skills || []).forEach((skill) => {
      [skill.name, skill.slug, skill.frontmatter?.name]
        .map(normalizeSkillName)
        .filter(Boolean)
        .forEach((key) => {
          const existing = map.get(key) || [];
          existing.push(skill);
          map.set(key, existing);
        });
    });
    return map;
  }, [data]);

  function installedForDiscover(item) {
    return discoverInstalledMap.get(normalizeSkillName(item?.name)) || [];
  }

  const visibleDiscoverItems = discoverItems;
  const starredItems = useMemo(() => Object.values(starredMap), [starredMap]);
  const starredFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const refreshedEntries = starredItems.flatMap((entry) => {
      if (entry.type === "discover") return [entry];
      const pool = entry.type === "uninstalled" ? (uninstalledData?.skills || []) : (data?.skills || []);
      const key = skillGroupKey(entry.item);
      const matches = pool.filter((skill) => skillGroupKey(skill) === key);
      return (matches.length ? matches : [entry.item]).map((item) => ({ ...entry, item }));
    });
    const filtered = refreshedEntries.filter((entry) => {
      if (!q) return true;
      const item = entry.item || {};
      const values = entry.type === "discover" ? discoverSearchValues(item, searchOptions) : localSkillSearchValues(item, searchOptions);
      return matchesSearchFields(values, q);
    });
    if (settings?.mergeDuplicateSkills === false) return filtered;
    const installedEntries = filtered.filter((entry) => entry.type === "installed");
    const uninstalledEntries = filtered.filter((entry) => entry.type === "uninstalled");
    const discoverEntries = filtered.filter((entry) => entry.type === "discover");
    const groupedInstalled = mergeSkillCopies(installedEntries.map((entry) => entry.item)).map((skill) => ({
      type: "installed",
      key: `starred:${skill.id}`,
      item: skill
    }));
    const groupedUninstalled = mergeSkillCopies(uninstalledEntries.map((entry) => entry.item)).map((skill) => ({
      type: "uninstalled",
      key: `starred:${skill.id}`,
      item: skill
    }));
    return [...discoverEntries, ...groupedInstalled, ...groupedUninstalled];
  }, [starredItems, query, searchOptions, settings, data, uninstalledData]);

  useEffect(() => {
    if (listMode === "settings" || listMode === "logs" || listMode === "events" || listMode === "tags") {
      setSelected(null);
      setSelectedDiscover(null);
      setSelectedStarred(null);
      if (listMode === "tags" && (!selectedTag || !allTagCounts.some((item) => item.tag === selectedTag))) {
        setSelectedTag(allTagCounts[0]?.tag || "");
      }
      return;
    }
    if (listMode === "starred") {
      setSelected(null);
      setSelectedDiscover(null);
      if (!starredFiltered.length) setSelectedStarred(null);
      else {
        const refreshedStarred = selectedStarred ? starredFiltered.find((entry) => entry.key === selectedStarred.key) : null;
        if (refreshedStarred && refreshedStarred !== selectedStarred) {
          setSelectedStarred(refreshedStarred);
        } else if (!selectedStarred || !refreshedStarred) {
          setSelectedStarred(starredFiltered[0]);
        }
      }
      return;
    }
    const activeList = listMode === "uninstalled" ? uninstalledFiltered : installedFiltered;
    if (listMode !== "discover") {
      setSelectedDiscover(null);
      setSelectedStarred(null);
      if (!activeList.length) {
        setSelected(null);
      } else {
        const refreshedSelected = selected ? activeList.find((skill) => skill.id === selected.id) : null;
        if (refreshedSelected && refreshedSelected !== selected) {
          setSelected(refreshedSelected);
        } else if (!selected || !refreshedSelected) {
          setSelected(activeList[0]);
        }
      }
    }
    if (listMode === "discover") {
      setSelected(null);
      setSelectedStarred(null);
      if ((!selectedDiscover || !discoverItems.some((item) => item.id === selectedDiscover.id)) && discoverItems.length) {
        setSelectedDiscover(discoverItems[0]);
      }
      if (!discoverItems.length) setSelectedDiscover(null);
    }
  }, [installedFiltered, uninstalledFiltered, discoverItems, starredFiltered, selected, selectedDiscover, selectedStarred, selectedTag, allTagCounts, listMode]);

  useEffect(() => {
    if (listMode === "logs") refreshLogs();
    if (listMode === "events") refreshEvents();
  }, [listMode]);

  const installedCount = data?.skills?.length || 0;
  const uninstalledCount = uninstalledData?.skills?.length || 0;
  const visibleCount = listMode === "discover" ? discoverItems.length : listMode === "tags" ? allTagCounts.length : listMode === "starred" ? starredFiltered.length : listMode === "uninstalled" ? uninstalledFiltered.length : installedFiltered.length;
  const discoverTotalLabel = githubTrends.meta?.totalLabel || githubTrends.items.length || 0;
  const discoverTabLabels = githubTrends.meta?.tabLabels || {};
  const installTargets = useMemo(() => {
    const sources = settings?.sources?.length ? settings.sources : data?.sources || [];
    return sources.filter((source) => source.enabled);
  }, [settings, data]);

  function toggleActiveTag(tag) {
    setActiveTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  }

  useEffect(() => {
    if (!installTargets.length) return;
    const valid = selectedInstallTargets.filter((id) => installTargets.some((source) => source.id === id));
    if (!valid.length) {
      const fallback = [installTargets.find((source) => source.id === "agents")?.id || installTargets[0].id];
      setSelectedInstallTargets(fallback);
      setDialogTargetIds((current) => current.length ? current : fallback);
    } else if (valid.length !== selectedInstallTargets.length) {
      setSelectedInstallTargets(valid);
    }
  }, [installTargets, selectedInstallTargets]);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><SkillManagerLogo /></div>
          <div>
            <h1>Skill Manager</h1>
            <p>本地多客户端 skill 管理器</p>
          </div>
        </div>
        <div className="toolbar">
          <label className="search-box">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder(searchOptions)} />
          </label>
          <div className="search-config-wrap">
            <button
              className={`icon-button search-config-button ${searchOptions.content ? "active" : ""}`}
              onClick={() => setSearchConfigOpen((open) => !open)}
              title="搜索配置"
            >
              <SlidersHorizontal size={18} />
            </button>
            <SearchConfig open={searchConfigOpen} options={searchOptions} onChange={setSearchOptions} />
          </div>
          <button className="icon-button" onClick={refresh} disabled={loading} title="重新扫描">
            <RefreshCcw size={18} />
          </button>
        </div>
      </header>

      {error ? <div className="error">{error}</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}

      <section className="dashboard">
        <aside className="left-rail">
          <div className="library-nav">
            <div className="section-label">Library</div>
            <NavRow icon={Github} label="Discover" count={discoverTotalLabel} active={listMode === "discover"} onClick={() => setListMode("discover")} />
            <NavRow icon={FileCode2} label="Installed" count={installedCount} active={listMode === "installed"} onClick={() => { setListMode("installed"); setSourceFilter("all"); }} />
            <NavRow icon={RotateCcw} label="Uninstalled" count={uninstalledCount} active={listMode === "uninstalled"} onClick={() => { setListMode("uninstalled"); setSourceFilter("all"); }} />
            <NavRow icon={Star} label="Starred" count={starredItems.length} active={listMode === "starred"} onClick={() => setListMode("starred")} />
            <NavRow icon={Tags} label="Tags" count={allTagCounts.length} active={listMode === "tags"} onClick={() => setListMode("tags")} />
          </div>

          <div className="agent-nav">
            <div className="section-label">Agents</div>
            <CountRow label="All Agents" count={installedCount} active={listMode === "installed" && sourceFilter === "all"} onClick={() => { setListMode("installed"); setSourceFilter("all"); }} />
            {agentCounts.map((agent) => (
              <CountRow key={agent.name} label={agent.name} count={agent.count} active={listMode === "installed" && sourceFilter === agent.name} onClick={() => { setListMode("installed"); setSourceFilter(agent.name); }} />
            ))}
          </div>
          <div className="settings-nav">
            <NavRow icon={Activity} label="Events" count={operationEvents.length} active={listMode === "events"} onClick={() => setListMode("events")} />
            <NavRow icon={Activity} label="Logs" count={operationLogs.length} active={listMode === "logs"} onClick={() => setListMode("logs")} />
            <NavRow icon={Settings2} label="Settings" count="" active={listMode === "settings"} onClick={() => setListMode("settings")} />
          </div>
        </aside>

        {listMode === "settings" ? (
          <SettingsPage settings={settings} onSave={saveSettings} saving={settingsSaving} />
        ) : listMode === "events" ? (
          <OperationEventPage events={operationEvents} onRefresh={refreshEvents} onClear={clearEvents} />
        ) : listMode === "logs" ? (
          <OperationLogPage logs={operationLogs} onRefresh={refreshLogs} onClear={clearLogs} />
        ) : (
        <>
        <section className="results">
          <div className="result-head">
            <div>
              <h2>{listMode === "discover" ? "Discover Skills" : listMode === "tags" ? "Tags" : listMode === "starred" ? "Star" : listMode === "uninstalled" ? "Uninstalled" : "Installed"}</h2>
              <p>{loading ? "正在扫描..." : (listMode === "discover" ? "" : `${visibleCount} 个匹配项 · ${data?.scannedAt ? formatDate(data.scannedAt) : ""}`)}</p>
            </div>
            <div className="result-controls">
              {listMode === "installed" ? (
                <>
                  <select value={localSort} onChange={(event) => setLocalSort(event.target.value)}>
                    <option value="updated">按更新时间</option>
                    <option value="alpha">按字母顺序</option>
                  </select>
                  <div className="tag-filter-wrap">
                    <button className={`tag-cloud-toggle ${tagCloudOpen ? "on" : ""}`} onClick={() => setTagCloudOpen((open) => !open)}>
                      <Tags size={15} />
                      标签
                      {activeTags.length ? <em>{activeTags.length}</em> : null}
                    </button>
                    {tagCloudOpen ? (
                      <div className="tag-cloud-panel">
                        <div className="tag-cloud-head">
                          <div>
                            <span>多选标签</span>
                            {activeTags.length ? <button onClick={() => setActiveTags([])}>清除</button> : null}
                          </div>
                          <div>
                            <span>关系</span>
                            <div className="tag-match-switch">
                              <button className={tagMatchMode === "and" ? "on" : ""} onClick={() => setTagMatchMode("and")} title="必须同时包含所有已选标签">AND</button>
                              <button className={tagMatchMode === "or" ? "on" : ""} onClick={() => setTagMatchMode("or")} title="包含任意一个已选标签即可">OR</button>
                            </div>
                          </div>
                        </div>
                        <div className="tag-cloud">
                          {tagCounts.length ? tagCounts.slice(0, 80).map(({ tag, count }) => {
                            return (
                              <TagPill
                                key={tag}
                                tag={tag}
                                as="button"
                                className={`cloud-tag ${activeTags.includes(tag) ? "active" : ""}`}
                                onClick={() => toggleActiveTag(tag)}
                              >
                                <i>{activeTags.includes(tag) ? "✓" : ""}</i>
                                <strong>{tag}</strong>
                                <em>{count}</em>
                              </TagPill>
                            );
                          }) : <span className="tag-cloud-empty">暂无标签</span>}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : listMode === "discover" ? (
                <>
                  <div className="segmented">
                    <button className={discoverSort === "alltime" ? "on" : ""} onClick={() => setDiscoverSort("alltime")}>All Time {discoverTabLabels.alltime ? `(${discoverTabLabels.alltime})` : ""}</button>
                    <button className={discoverSort === "trending" ? "on" : ""} onClick={() => setDiscoverSort("trending")}>Trending (24h)</button>
                    <button className={discoverSort === "hot" ? "on" : ""} onClick={() => setDiscoverSort("hot")}>Hot</button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
          {listMode === "installed" && activeTags.length ? (
            <div className="active-filter-row">
              {activeTags.map((tag) => (
                <TagPill key={tag} tag={tag} as="button" onClick={() => toggleActiveTag(tag)}>标签：{tag}</TagPill>
              ))}
              <button onClick={() => setActiveTags([])}>清除</button>
            </div>
          ) : null}
          <div className="skill-list">
            {listMode === "discover" && !githubTrends.loading && (githubTrends.error || githubTrends.meta?.stale) ? (
              <div className={`discover-status ${githubTrends.error ? "warn" : ""}`}>
                {githubTrends.meta?.stale
                  ? `skills.sh 暂时不可用，正在显示缓存${githubTrends.meta?.cachedAt ? ` · ${formatDate(githubTrends.meta.cachedAt)}` : ""}`
                  : `Discover 加载失败：${githubTrends.error}`}
              </div>
            ) : null}
            {visibleCount === 0 ? <EmptyList mode={listMode} scanning={listMode === "discover" ? githubTrends.loading : loading} /> : null}
            {listMode === "tags" ? (
              <div className="tag-overview">
                {allTagCounts.map(({ tag, count }) => {
                  const max = Math.max(1, allTagCounts[0]?.count || 1);
                  const level = Math.min(6, Math.max(1, Math.ceil((count / max) * 6)));
                  return (
                    <TagPill
                      key={tag}
                      tag={tag}
                      as="button"
                      className={`tag-page-tag size-${level} ${selectedTag === tag ? "active" : ""}`}
                      onClick={() => setSelectedTag(tag)}
                    >
                      <strong>{tag}</strong>
                      <em>{count}</em>
                    </TagPill>
                  );
                })}
              </div>
            ) : listMode === "discover" ? visibleDiscoverItems.map((item, index) => (
              <DiscoverRow
                key={item.id}
                item={item}
                index={item.rank ? item.rank - 1 : index}
                selected={selectedDiscover?.id === item.id}
                onSelect={setSelectedDiscover}
                onInstall={beginInstallDiscover}
                onUninstall={beginUninstallMany}
                busy={busyAction === `discover:${item.id}` || installedForDiscover(item).some((skill) => busyAction === `uninstall:${skill.id}`)}
                starred={isStarred("discover", item)}
                onStar={(starItem) => toggleStar("discover", starItem)}
                installedSkills={installedForDiscover(item)}
              />
            )) : listMode === "starred" ? starredFiltered.map((entry, index) => entry.type === "discover" ? (
              <DiscoverRow
                key={entry.key}
                item={entry.item}
                index={entry.item.rank ? entry.item.rank - 1 : index}
                selected={selectedStarred?.key === entry.key}
                onSelect={() => setSelectedStarred(entry)}
                onInstall={beginInstallDiscover}
                onUninstall={beginUninstallMany}
                busy={busyAction === `discover:${entry.item.id}` || installedForDiscover(entry.item).some((skill) => busyAction === `uninstall:${skill.id}`)}
                starred
                onStar={() => toggleStar(entry.type, entry.item)}
                installedSkills={installedForDiscover(entry.item)}
              />
            ) : (
              <SkillRow
                key={entry.key}
                skill={entry.item}
                selected={selectedStarred?.key === entry.key}
                onSelect={() => setSelectedStarred(entry)}
                actionLabel={entry.type === "uninstalled" ? "Install" : "Uninstall"}
                onAction={entry.type === "uninstalled" ? beginRestoreSkill : (skill) => beginUninstallMany(skill, skill.installations || [skill])}
                busy={busyAction === `${entry.type === "uninstalled" ? "restore" : "uninstall"}:${entry.item.id}`}
                starred
                onStar={() => toggleStar(entry.type, entry.item)}
              />
            )) : listMode === "uninstalled" ? uninstalledFiltered.map((skill) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                selected={selected?.id === skill.id}
                onSelect={setSelected}
                actionLabel="Install"
                onAction={beginRestoreSkill}
                busy={busyAction === `restore:${skill.id}`}
                starred={isStarred("uninstalled", skill)}
                onStar={(starItem) => toggleStar("uninstalled", starItem)}
              />
            )) : installedFiltered.map((skill) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                selected={selected?.id === skill.id}
                onSelect={setSelected}
                actionLabel="Uninstall"
                onAction={(skill) => beginUninstallMany(skill, skill.installations || [skill])}
                busy={busyAction === `uninstall:${skill.id}`}
                starred={isStarred("installed", skill)}
                onStar={(starItem) => toggleStar("installed", starItem)}
              />
            ))}
          </div>
        </section>

        {listMode === "discover" ? (
          <DiscoverDetail
            item={selectedDiscover}
            onInstall={beginInstallDiscover}
            onUninstall={beginUninstallMany}
            busy={selectedDiscover ? busyAction === `discover:${selectedDiscover.id}` || installedForDiscover(selectedDiscover).some((skill) => busyAction === `uninstall:${skill.id}`) : false}
            starred={selectedDiscover ? isStarred("discover", selectedDiscover) : false}
            onStar={(item) => toggleStar("discover", item)}
            installedSkills={selectedDiscover ? installedForDiscover(selectedDiscover) : []}
          />
        ) : listMode === "tags" ? (
          <TagSkillPanel
            tag={selectedTag}
            skills={selectedTagSkills}
            onOpenSkill={(skill) => {
              setActiveTags([]);
              setSourceFilter("all");
              setSelected(skill);
              setListMode("installed");
            }}
          />
        ) : listMode === "starred" ? (
          selectedStarred?.type === "discover" ? (
            <DiscoverDetail
              item={selectedStarred.item}
              onInstall={beginInstallDiscover}
              onUninstall={beginUninstallMany}
              busy={busyAction === `discover:${selectedStarred.item.id}` || installedForDiscover(selectedStarred.item).some((skill) => busyAction === `uninstall:${skill.id}`)}
              starred
              onStar={(item) => toggleStar("discover", item)}
              installedSkills={installedForDiscover(selectedStarred.item)}
            />
          ) : (
            <Detail
              skill={selectedStarred?.item || null}
              onSaved={refresh}
              starred={Boolean(selectedStarred)}
              onStar={(item) => toggleStar(selectedStarred?.type || "installed", item)}
              onInstall={selectedStarred?.type === "uninstalled" ? beginRestoreSkill : beginInstallLocal}
              onUninstall={selectedStarred?.type === "uninstalled" ? null : beginUninstallMany}
              baselineSourceId={settings?.baselineSourceId || "agents"}
              agentScope={sourceFilter}
            />
          )
        ) : (
          <Detail
            skill={selected}
            onSaved={refresh}
            starred={selected ? isStarred(listMode === "uninstalled" ? "uninstalled" : "installed", selected) : false}
            onStar={(item) => toggleStar(listMode === "uninstalled" ? "uninstalled" : "installed", item)}
            onInstall={listMode === "uninstalled" ? beginRestoreSkill : beginInstallLocal}
            onUninstall={listMode === "uninstalled" ? null : beginUninstallMany}
            baselineSourceId={settings?.baselineSourceId || "agents"}
            agentScope={sourceFilter}
          />
        )}
        </>
        )}
      </section>
      <InstallTargetDialog
        pending={pendingInstall}
        targets={pendingInstall?.targets || installTargets}
        selectedTargets={dialogTargetIds}
        onChangeTargets={setDialogTargetIds}
        onCancel={() => setPendingInstall(null)}
        onConfirm={confirmPendingInstall}
        busy={Boolean(busyAction)}
      />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
