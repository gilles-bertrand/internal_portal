const EXCLUDED_KEYS = new Set(["hash", "prevHash"]);

function stableStringify(value: unknown, excludeTopKeys?: Set<string>): string {
  if (value === null || value === undefined) return JSON.stringify(value) ?? "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map((v) => stableStringify(v)).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => !excludeTopKeys?.has(k))
    .sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

export function canonicalSerialize(record: Record<string, unknown>): string {
  return stableStringify(record, EXCLUDED_KEYS);
}
