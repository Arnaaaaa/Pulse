const express = require("express");
const { Activity, Project } = require("../models");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/helpers");
const { visibleProjectFilter, loadProject } = require("../utils/access");

const router = express.Router();

// ?projectId= for one project, otherwise everything the user can see. ?limit= up to 500 (default 100).
router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  let projectIds;
  if (req.query.projectId) projectIds = [(await loadProject(req.query.projectId, req.user))._id];
  else projectIds = (await Project.find(visibleProjectFilter(req.user), "_id")).map((p) => p._id);
  res.json(await Activity.find({ projectId: { $in: projectIds } }).sort({ createdAt: -1 }).limit(limit));
}));

module.exports = router;
