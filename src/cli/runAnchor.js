#!/usr/bin/env node
// src/cli/runAnchor.js — CLI to run anchor manually
const anchorService = require("../services/anchorService");
const publishService = require("../services/publishService");

async function main() {
  const targetId = process.argv[2] || "local-log";

  console.log("Creating transparency anchor...\n");

  try {
    const anchor = await anchorService.createAnchor();

    console.log("Anchor created:");
    console.log(`  ID: ${anchor.id}`);
    console.log(`  Issuer Registry Hash: ${anchor.issuer_registry_root_hash}`);
    console.log(`  WCAF Heads Hash: ${anchor.wcaf_heads_root_hash}`);
    console.log(`  Combined Root Hash: ${anchor.combined_root_hash}`);
    console.log(`  Issuers: ${anchor.issuer_count}`);
    console.log(`  WCAF Documents: ${anchor.wcaf_document_count}`);
    console.log("");

    // Publish
    console.log(`Publishing to: ${targetId}...`);
    const targets = await anchorService.getAnchorTargets();
    const target = targets.find(t => t.target_id === targetId);

    if (!target) {
      console.error(`Target not found: ${targetId}`);
      process.exit(1);
    }

    const result = await publishService.publishToTarget(anchor, target);

    if (result.success) {
      await anchorService.confirmAnchor(anchor.id, {
        anchor_target: targetId,
        anchor_ref: result.anchor_ref,
        anchor_proof: result.proof
      });

      console.log("\n✓ Anchor published successfully!");
      console.log(`  Reference: ${result.anchor_ref}`);
    } else {
      console.error(`\n✗ Publish failed: ${result.error}`);
      process.exit(1);
    }
  } catch (err) {
    console.error("Anchor failed:", err);
    process.exit(1);
  }

  process.exit(0);
}

main();
