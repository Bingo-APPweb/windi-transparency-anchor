// src/routes/anchor.js — Anchoring API endpoints
const express = require("express");
const router = express.Router();
const anchorService = require("../services/anchorService");
const publishService = require("../services/publishService");

/**
 * POST /anchor/run
 * Create a new anchor snapshot
 */
router.post("/run", async (req, res) => {
  try {
    const { auto_publish, target_id } = req.body;

    // Create anchor record
    const anchor = await anchorService.createAnchor();

    // Auto-publish if requested
    if (auto_publish && target_id) {
      const targets = await anchorService.getAnchorTargets();
      const target = targets.find(t => t.target_id === target_id);

      if (target) {
        const result = await publishService.publishToTarget(anchor, target);

        if (result.success) {
          const confirmed = await anchorService.confirmAnchor(anchor.id, {
            anchor_target: target_id,
            anchor_ref: result.anchor_ref,
            anchor_proof: result.proof
          });
          return res.status(201).json(confirmed);
        } else {
          await anchorService.failAnchor(anchor.id, result.error);
          return res.status(201).json({
            ...anchor,
            publish_error: result.error
          });
        }
      }
    }

    res.status(201).json(anchor);
  } catch (err) {
    console.error("Create anchor error:", err);
    res.status(500).json({ error: "ANCHOR_ERROR", message: err.message });
  }
});

/**
 * POST /anchor/:id/confirm
 * Confirm anchor publication
 */
router.post("/:id/confirm", async (req, res) => {
  try {
    const { id } = req.params;
    const { anchor_target, anchor_ref, anchor_proof } = req.body;

    if (!anchor_target || !anchor_ref) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "anchor_target and anchor_ref are required"
      });
    }

    const anchor = await anchorService.confirmAnchor(parseInt(id), {
      anchor_target,
      anchor_ref,
      anchor_proof
    });

    if (!anchor) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Anchor not found" });
    }

    res.json(anchor);
  } catch (err) {
    console.error("Confirm anchor error:", err);
    res.status(500).json({ error: "CONFIRM_ERROR", message: err.message });
  }
});

/**
 * POST /anchor/:id/publish
 * Publish anchor to a target
 */
router.post("/:id/publish", async (req, res) => {
  try {
    const { id } = req.params;
    const { target_id } = req.body;

    if (!target_id) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "target_id is required"
      });
    }

    const anchor = await anchorService.getAnchor(parseInt(id));
    if (!anchor) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Anchor not found" });
    }

    const targets = await anchorService.getAnchorTargets();
    const target = targets.find(t => t.target_id === target_id);

    if (!target) {
      return res.status(400).json({ error: "INVALID_TARGET", message: "Unknown target" });
    }

    const result = await publishService.publishToTarget(anchor, target);

    if (result.success) {
      const confirmed = await anchorService.confirmAnchor(anchor.id, {
        anchor_target: target_id,
        anchor_ref: result.anchor_ref,
        anchor_proof: result.proof
      });
      res.json(confirmed);
    } else {
      await anchorService.failAnchor(anchor.id, result.error);
      res.status(500).json({ error: "PUBLISH_FAILED", message: result.error });
    }
  } catch (err) {
    console.error("Publish anchor error:", err);
    res.status(500).json({ error: "PUBLISH_ERROR", message: err.message });
  }
});

/**
 * GET /anchor/:id
 * Get anchor by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const anchor = await anchorService.getAnchor(parseInt(req.params.id));
    if (!anchor) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Anchor not found" });
    }
    res.json(anchor);
  } catch (err) {
    console.error("Get anchor error:", err);
    res.status(500).json({ error: "FETCH_ERROR", message: err.message });
  }
});

/**
 * GET /anchor/history
 * Get anchor history
 */
router.get("/", async (req, res) => {
  try {
    const { limit, offset, status } = req.query;
    const history = await anchorService.getAnchorHistory({
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
      status
    });
    res.json({
      count: history.length,
      anchors: history
    });
  } catch (err) {
    console.error("Get history error:", err);
    res.status(500).json({ error: "FETCH_ERROR", message: err.message });
  }
});

/**
 * GET /anchor/latest
 * Get latest anchor
 */
router.get("/latest", async (req, res) => {
  try {
    const anchor = await anchorService.getLatestAnchor();
    if (!anchor) {
      return res.status(404).json({ error: "NOT_FOUND", message: "No anchors yet" });
    }
    res.json(anchor);
  } catch (err) {
    console.error("Get latest error:", err);
    res.status(500).json({ error: "FETCH_ERROR", message: err.message });
  }
});

/**
 * GET /anchor/verify/:hash
 * Verify a combined root hash
 */
router.get("/verify/:hash", async (req, res) => {
  try {
    const result = await anchorService.verifyHash(req.params.hash);
    res.json(result);
  } catch (err) {
    console.error("Verify hash error:", err);
    res.status(500).json({ error: "VERIFY_ERROR", message: err.message });
  }
});

/**
 * GET /anchor/targets
 * Get available anchor targets
 */
router.get("/targets", async (req, res) => {
  try {
    const targets = await anchorService.getAnchorTargets();
    res.json({ targets });
  } catch (err) {
    console.error("Get targets error:", err);
    res.status(500).json({ error: "FETCH_ERROR", message: err.message });
  }
});

module.exports = router;
