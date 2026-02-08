// src/server.js — WINDI Transparency Anchor API
const express = require("express");
const cron = require("node-cron");
const anchorRoutes = require("./routes/anchor");
const anchorService = require("./services/anchorService");
const publishService = require("./services/publishService");

const app = express();
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "transparency-anchor",
    version: "0.1.0"
  });
});

// Anchor routes
app.use("/anchor", anchorRoutes);

// Error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "INTERNAL_ERROR",
    message: process.env.NODE_ENV === "development" ? err.message : "Internal server error"
  });
});

// =============================================================================
// Scheduled Anchoring (optional)
// =============================================================================

const ANCHOR_CRON = process.env.ANCHOR_CRON || ""; // e.g., "0 * * * *" for hourly
const ANCHOR_AUTO_TARGET = process.env.ANCHOR_AUTO_TARGET || "local-log";

if (ANCHOR_CRON) {
  console.log(`Scheduled anchoring enabled: ${ANCHOR_CRON}`);

  cron.schedule(ANCHOR_CRON, async () => {
    console.log("Running scheduled anchor...");

    try {
      const anchor = await anchorService.createAnchor();
      console.log(`Anchor created: ${anchor.id} (${anchor.combined_root_hash})`);

      // Auto-publish to default target
      const targets = await anchorService.getAnchorTargets();
      const target = targets.find(t => t.target_id === ANCHOR_AUTO_TARGET);

      if (target) {
        const result = await publishService.publishToTarget(anchor, target);
        if (result.success) {
          await anchorService.confirmAnchor(anchor.id, {
            anchor_target: ANCHOR_AUTO_TARGET,
            anchor_ref: result.anchor_ref,
            anchor_proof: result.proof
          });
          console.log(`Anchor published to ${ANCHOR_AUTO_TARGET}`);
        } else {
          console.error(`Anchor publish failed: ${result.error}`);
        }
      }
    } catch (err) {
      console.error("Scheduled anchor failed:", err);
    }
  });
}

// Start server
const port = process.env.PORT || 4040;
app.listen(port, () => {
  console.log(`transparency-anchor listening on :${port}`);
  if (ANCHOR_CRON) {
    console.log(`Auto-anchoring: ${ANCHOR_CRON} → ${ANCHOR_AUTO_TARGET}`);
  }
});

module.exports = app;
