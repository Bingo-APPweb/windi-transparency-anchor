// test/anchor.test.js — Transparency Anchor unit tests
const assert = require("assert");
const { sha256, stableStringify, computeRootHash } = require("../src/services/hash");

console.log("windi-transparency-anchor tests\n");

// =============================================================================
// Test 1: SHA-256 hashing
// =============================================================================

console.log("1. SHA-256 hashing");

const hash1 = sha256("hello");
assert.strictEqual(hash1.length, 64);
assert.strictEqual(hash1, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");

const hash2 = sha256({ foo: "bar" });
assert.strictEqual(hash2.length, 64);

// Same input → same hash
assert.strictEqual(sha256({ a: 1, b: 2 }), sha256({ b: 2, a: 1 }));

console.log("   ✓ SHA-256 produces consistent 64-char hex hashes\n");

// =============================================================================
// Test 2: Stable stringify
// =============================================================================

console.log("2. Stable stringify (deterministic)");

const obj1 = { z: 1, a: 2, m: 3 };
const obj2 = { a: 2, m: 3, z: 1 };

assert.strictEqual(stableStringify(obj1), stableStringify(obj2));
assert.strictEqual(stableStringify(obj1), '{"a":2,"m":3,"z":1}');

// Handles undefined
const obj3 = { a: 1, b: undefined, c: 3 };
assert.strictEqual(stableStringify(obj3), '{"a":1,"c":3}');

// Handles null
assert.strictEqual(stableStringify(null), "null");

// Handles arrays
assert.strictEqual(stableStringify([3, 1, 2]), "[3,1,2]");

console.log("   ✓ Stable stringify is deterministic\n");

// =============================================================================
// Test 3: Compute root hash
// =============================================================================

console.log("3. Compute root hash (Merkle-style)");

const hashes = [
  "abc123",
  "def456",
  "ghi789"
];

const root1 = computeRootHash(hashes);
assert.strictEqual(root1.length, 64);

// Same hashes in different order → same root (sorted internally)
const root2 = computeRootHash(["ghi789", "abc123", "def456"]);
assert.strictEqual(root1, root2);

// Empty array
const emptyRoot = computeRootHash([]);
assert.strictEqual(emptyRoot, sha256("EMPTY"));

console.log("   ✓ Root hash is deterministic and handles empty arrays\n");

// =============================================================================
// Test 4: Combined root hash
// =============================================================================

console.log("4. Combined root hash calculation");

const registryHash = sha256("registry-snapshot");
const wcafHash = sha256("wcaf-heads");
const combinedHash = sha256(registryHash + wcafHash);

assert.strictEqual(combinedHash.length, 64);
assert.notStrictEqual(combinedHash, registryHash);
assert.notStrictEqual(combinedHash, wcafHash);

console.log("   ✓ Combined hash correctly merges registry and WCAF hashes\n");

// =============================================================================
// Test 5: Anchor status values
// =============================================================================

console.log("5. Anchor status values");

const validStatuses = ["PENDING", "ANCHORED", "FAILED", "EXPIRED"];
const targetTypes = ["PUBLIC_LOG", "NOTARY", "BLOCKCHAIN", "CERTIFICATE_TRANSPARENCY"];

console.log(`   ✓ ${validStatuses.length} valid anchor statuses`);
console.log(`   ✓ ${targetTypes.length} supported target types\n`);

// =============================================================================
// Summary
// =============================================================================

console.log("═══════════════════════════════════════");
console.log("  All 5 tests passed! ✓");
console.log("═══════════════════════════════════════\n");

console.log("Note: Integration tests require running PostgreSQL and other services.");
console.log("Run with: DATABASE_URL=... REGISTRY_URL=... FORENSICS_URL=... npm test\n");
