export function moveItem(items, fromIndex, toIndex) {
  const next = [...items];
  if (fromIndex < 0 || fromIndex >= next.length || !next.length) return next;
  const target = Math.max(0, Math.min(next.length - 1, toIndex));
  if (target === fromIndex) return next;
  const [item] = next.splice(fromIndex, 1);
  next.splice(target, 0, item);
  return next;
}

export function orderedAgentCounts(sources = [], skills = []) {
  const counts = new Map();
  skills.forEach((skill) => {
    if (!skill?.client) return;
    counts.set(skill.client, (counts.get(skill.client) || 0) + 1);
  });

  const configuredClients = new Set(sources.map((source) => source.client));
  const configured = sources
    .filter((source) => source.enabled)
    .map((source) => ({
      id: source.id,
      name: source.client,
      count: counts.get(source.client) || 0,
      source
    }));
  const fallback = [...counts.entries()]
    .filter(([name]) => !configuredClients.has(name))
    .map(([name, count]) => ({ id: `client:${name}`, name, count, source: { id: `client:${name}`, client: name } }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return [...configured, ...fallback];
}
