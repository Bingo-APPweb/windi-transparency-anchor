// src/services/hash.js — Deterministic hashing utilities
const crypto = require("crypto");

/**
 * Stable JSON stringify (sorted keys, no undefined)
 */
function stableStringify(obj) {
  if (obj === null) return "null";
  if (obj === undefined) return undefined;
  if (typeof obj !== "object") return JSON.stringify(obj);

  if (Array.isArray(obj)) {
    return "[" + obj.map(v => stableStringify(v)).filter(v => v !== undefined).join(",") + "]";
  }

  const keys = Object.keys(obj).sort();
  const pairs = [];
  for (const key of keys) {
    const val = stableStringify(obj[key]);
    if (val !== undefined) {
      pairs.push(JSON.stringify(key) + ":" + val);
    }
  }
  return "{" + pairs.join(",") + "}";
}

/**
 * Compute SHA-256 hash of any object (deterministic)
 */
function sha256(data) {
  const str = typeof data === "string" ? data : stableStringify(data);
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

/**
 * Compute Merkle-style root hash from array of hashes
 */
function computeRootHash(hashes) {
  if (!hashes || hashes.length === 0) {
    return sha256("EMPTY");
  }

  // Sort for determinism
  const sorted = [...hashes].sort();
  return sha256(sorted.join(""));
}

module.exports = { sha256, stableStringify, computeRootHash };
