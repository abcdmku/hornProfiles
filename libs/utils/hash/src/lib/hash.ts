import * as CryptoJS from "crypto-js";

export function hashObject(obj: unknown): string {
  const stableJson = sortedStringify(obj);
  return CryptoJS.SHA256(stableJson).toString();
}

function sortedStringify(obj: unknown): string {
  if (obj === null) return "null";
  if (obj === undefined) return "undefined";
  if (typeof obj !== "object") return JSON.stringify(obj);

  if (Array.isArray(obj)) {
    return "[" + obj.map(sortedStringify).join(",") + "]";
  }

  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sortedKeys.map((key) => {
    const value = (obj as Record<string, unknown>)[key];
    return `"${key}":${sortedStringify(value)}`;
  });

  return "{" + pairs.join(",") + "}";
}

export function generateRequestHash(geometry: unknown, params: unknown, version = "1.0.0"): string {
  return hashObject({
    geometry,
    params,
    version,
    timestamp: Math.floor(Date.now() / 3600000), // Round to hour for cache effectiveness
  });
}

export function generateJobId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `job_${timestamp}_${randomPart}`;
}
