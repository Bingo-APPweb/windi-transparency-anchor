// src/services/snapshotService.js — Collect system state for anchoring
const { sha256, computeRootHash, stableStringify } = require("./hash");

const REGISTRY_URL = process.env.REGISTRY_URL || "http://issuer-registry:4030";
const FORENSICS_URL = process.env.FORENSICS_URL || "http://forensics-api:4010";

/**
 * Fetch issuer registry snapshot
 */
async function getIssuerRegistrySnapshot() {
  try {
    // Get all issuers from directory
    const response = await fetch(`${REGISTRY_URL}/directory?limit=10000`);
    if (!response.ok) {
      throw new Error(`Registry fetch failed: ${response.status}`);
    }

    const data = await response.json();
    const issuers = data.issuers || [];

    // Create deterministic snapshot
    const snapshot = issuers.map(i => ({
      issuer_id: i.issuer_id,
      current_status: i.current_status,
      status_updated_at: i.status_updated_at
    })).sort((a, b) => a.issuer_id.localeCompare(b.issuer_id));

    const hash = sha256(stableStringify(snapshot));

    return {
      hash,
      count: issuers.length,
      snapshot_at: new Date().toISOString()
    };
  } catch (err) {
    console.error("Failed to get issuer registry snapshot:", err.message);
    return {
      hash: sha256("REGISTRY_UNAVAILABLE"),
      count: 0,
      error: err.message
    };
  }
}

/**
 * Fetch WCAF chain heads snapshot
 */
async function getWcafHeadsSnapshot() {
  try {
    // This endpoint would need to be added to forensics-api
    // For now, we'll use a simplified approach
    const response = await fetch(`${FORENSICS_URL}/chain-heads`);

    if (!response.ok) {
      // Fallback: try health endpoint to confirm service is up
      const healthResp = await fetch(`${FORENSICS_URL}/health`);
      if (healthResp.ok) {
        // Service is up but endpoint doesn't exist yet
        return {
          hash: sha256("WCAF_HEADS_NOT_AVAILABLE"),
          count: 0,
          note: "chain-heads endpoint not yet implemented"
        };
      }
      throw new Error(`Forensics fetch failed: ${response.status}`);
    }

    const data = await response.json();
    const heads = data.heads || [];

    // Sort by document_id for determinism
    const sortedHeads = heads
      .map(h => ({ document_id: h.document_id, head_hash: h.head_event_hash }))
      .sort((a, b) => a.document_id.localeCompare(b.document_id));

    const headHashes = sortedHeads.map(h => h.head_hash);
    const hash = computeRootHash(headHashes);

    return {
      hash,
      count: heads.length,
      snapshot_at: new Date().toISOString()
    };
  } catch (err) {
    console.error("Failed to get WCAF heads snapshot:", err.message);
    return {
      hash: sha256("WCAF_UNAVAILABLE"),
      count: 0,
      error: err.message
    };
  }
}

/**
 * Create complete system snapshot for anchoring
 */
async function createSnapshot() {
  const [registrySnapshot, wcafSnapshot] = await Promise.all([
    getIssuerRegistrySnapshot(),
    getWcafHeadsSnapshot()
  ]);

  const combinedRootHash = sha256(
    registrySnapshot.hash + wcafSnapshot.hash
  );

  return {
    issuer_registry_root_hash: registrySnapshot.hash,
    issuer_count: registrySnapshot.count,
    wcaf_heads_root_hash: wcafSnapshot.hash,
    wcaf_document_count: wcafSnapshot.count,
    combined_root_hash: combinedRootHash,
    snapshot_at: new Date().toISOString()
  };
}

module.exports = {
  getIssuerRegistrySnapshot,
  getWcafHeadsSnapshot,
  createSnapshot
};
