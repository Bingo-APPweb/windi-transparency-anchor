// src/services/publishService.js — Publish anchors to external targets
const { sha256 } = require("./hash");

/**
 * Publish anchor to local append-only log (development)
 */
async function publishToLocalLog(anchor) {
  // In production, this would write to a real append-only log
  const logEntry = {
    timestamp: new Date().toISOString(),
    combined_root_hash: anchor.combined_root_hash,
    issuer_registry_root_hash: anchor.issuer_registry_root_hash,
    wcaf_heads_root_hash: anchor.wcaf_heads_root_hash,
    anchor_id: anchor.id
  };

  // For dev, just log it
  console.log("LOCAL LOG ENTRY:", JSON.stringify(logEntry, null, 2));

  return {
    success: true,
    anchor_ref: `local://log/${anchor.id}`,
    proof: {
      type: "local-log",
      entry_hash: sha256(logEntry),
      logged_at: logEntry.timestamp
    }
  };
}

/**
 * Publish anchor to public HTTP log
 */
async function publishToPublicLog(anchor, config) {
  const logUrl = config?.url || "https://transparency.windi.systems/log";

  try {
    const response = await fetch(`${logUrl}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        combined_root_hash: anchor.combined_root_hash,
        issuer_registry_root_hash: anchor.issuer_registry_root_hash,
        wcaf_heads_root_hash: anchor.wcaf_heads_root_hash,
        timestamp: new Date().toISOString(),
        source: "windi-transparency-anchor",
        source_id: anchor.id
      })
    });

    if (!response.ok) {
      throw new Error(`Log server returned ${response.status}`);
    }

    const result = await response.json();

    return {
      success: true,
      anchor_ref: result.entry_url || `${logUrl}/entries/${result.entry_id}`,
      proof: {
        type: "public-log",
        entry_id: result.entry_id,
        entry_hash: result.entry_hash,
        inclusion_proof: result.inclusion_proof
      }
    };
  } catch (err) {
    console.error("Public log publish failed:", err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Publish anchor to a notary service
 */
async function publishToNotary(anchor, config) {
  // Placeholder for notary integration
  console.log("NOTARY publish not yet implemented");
  return {
    success: false,
    error: "Notary integration not yet implemented"
  };
}

/**
 * Publish anchor to blockchain
 */
async function publishToBlockchain(anchor, config) {
  // Placeholder for blockchain integration
  console.log("BLOCKCHAIN publish not yet implemented");
  return {
    success: false,
    error: "Blockchain integration not yet implemented"
  };
}

/**
 * Publish anchor to specified target
 */
async function publishToTarget(anchor, target) {
  switch (target.target_type) {
    case "PUBLIC_LOG":
      if (target.target_id === "local-log") {
        return publishToLocalLog(anchor);
      }
      return publishToPublicLog(anchor, target.config);

    case "NOTARY":
      return publishToNotary(anchor, target.config);

    case "BLOCKCHAIN":
      return publishToBlockchain(anchor, target.config);

    default:
      return {
        success: false,
        error: `Unknown target type: ${target.target_type}`
      };
  }
}

module.exports = {
  publishToLocalLog,
  publishToPublicLog,
  publishToNotary,
  publishToBlockchain,
  publishToTarget
};
