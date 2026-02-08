// src/services/anchorService.js — Core anchoring operations
const { query } = require("../db");
const { createSnapshot } = require("./snapshotService");

const FORENSICS_URL = process.env.FORENSICS_URL || "http://forensics-api:4010";

/**
 * Create a new anchor record
 */
async function createAnchor() {
  // Get current system snapshot
  const snapshot = await createSnapshot();

  // Insert anchor record
  const result = await query(
    `INSERT INTO transparency_anchors
     (issuer_registry_root_hash, wcaf_heads_root_hash, combined_root_hash,
      issuer_count, wcaf_document_count, snapshot_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
     RETURNING *`,
    [
      snapshot.issuer_registry_root_hash,
      snapshot.wcaf_heads_root_hash,
      snapshot.combined_root_hash,
      snapshot.issuer_count,
      snapshot.wcaf_document_count,
      snapshot.snapshot_at
    ]
  );

  const anchor = result.rows[0];

  // Emit WCAF event
  await emitAnchorEvent("TRANSPARENCY_ANCHOR_CREATED", anchor);

  return anchor;
}

/**
 * Confirm anchor publication
 */
async function confirmAnchor(anchorId, { anchor_target, anchor_ref, anchor_proof }) {
  const result = await query(
    `UPDATE transparency_anchors
     SET status = 'ANCHORED',
         anchor_target = $2,
         anchor_ref = $3,
         anchor_proof = $4,
         anchored_at = now()
     WHERE id = $1
     RETURNING *`,
    [anchorId, anchor_target, anchor_ref, anchor_proof ? JSON.stringify(anchor_proof) : null]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const anchor = result.rows[0];

  // Emit WCAF event
  await emitAnchorEvent("TRANSPARENCY_ANCHOR_CONFIRMED", anchor);

  return anchor;
}

/**
 * Mark anchor as failed
 */
async function failAnchor(anchorId, reason) {
  const result = await query(
    `UPDATE transparency_anchors
     SET status = 'FAILED',
         anchor_proof = $2
     WHERE id = $1
     RETURNING *`,
    [anchorId, JSON.stringify({ error: reason })]
  );
  return result.rows[0] || null;
}

/**
 * Get anchor by ID
 */
async function getAnchor(anchorId) {
  const result = await query(
    `SELECT * FROM transparency_anchors WHERE id = $1`,
    [anchorId]
  );
  return result.rows[0] || null;
}

/**
 * Get anchor history
 */
async function getAnchorHistory({ limit = 100, offset = 0, status } = {}) {
  let sql = `SELECT * FROM anchor_history WHERE 1=1`;
  const params = [];
  let paramIdx = 1;

  if (status) {
    sql += ` AND status = $${paramIdx++}`;
    params.push(status);
  }

  sql += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  return result.rows;
}

/**
 * Get latest anchor
 */
async function getLatestAnchor() {
  const result = await query(`SELECT * FROM latest_anchor`);
  return result.rows[0] || null;
}

/**
 * Verify a hash against anchor history
 */
async function verifyHash(combinedRootHash) {
  const result = await query(
    `SELECT * FROM transparency_anchors
     WHERE combined_root_hash = $1 AND status = 'ANCHORED'
     ORDER BY created_at DESC
     LIMIT 1`,
    [combinedRootHash]
  );

  if (result.rows.length === 0) {
    return { verified: false, message: "Hash not found in anchor history" };
  }

  const anchor = result.rows[0];
  return {
    verified: true,
    anchor_id: anchor.id,
    anchored_at: anchor.anchored_at,
    anchor_target: anchor.anchor_target,
    anchor_ref: anchor.anchor_ref
  };
}

/**
 * Emit WCAF event for anchor operations
 */
async function emitAnchorEvent(type, anchor) {
  try {
    const response = await fetch(`${FORENSICS_URL}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_id: `transparency:anchor-${anchor.id}`,
        type,
        payload: {
          anchor_id: anchor.id,
          combined_root_hash: anchor.combined_root_hash,
          issuer_registry_root_hash: anchor.issuer_registry_root_hash,
          wcaf_heads_root_hash: anchor.wcaf_heads_root_hash,
          issuer_count: anchor.issuer_count,
          wcaf_document_count: anchor.wcaf_document_count,
          anchor_target: anchor.anchor_target,
          anchor_ref: anchor.anchor_ref,
          status: anchor.status
        },
        actor: {
          system: "transparency-anchor",
          instance_id: process.env.HOSTNAME || "anchor-1"
        }
      })
    });

    if (!response.ok) {
      console.warn(`WCAF emit failed for ${type}`);
    }
  } catch (err) {
    console.warn(`WCAF emit error for ${type}:`, err.message);
  }
}

/**
 * Get supported anchor targets
 */
async function getAnchorTargets() {
  const result = await query(
    `SELECT * FROM anchor_targets WHERE enabled = true`
  );
  return result.rows;
}

module.exports = {
  createAnchor,
  confirmAnchor,
  failAnchor,
  getAnchor,
  getAnchorHistory,
  getLatestAnchor,
  verifyHash,
  getAnchorTargets
};
