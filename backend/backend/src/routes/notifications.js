const express = require("express");
const { Notification } = require("../models");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler, HttpError } = require("../utils/helpers");

const router = express.Router();
router.use(requireAuth);

router.get("/", asyncHandler(async (req, res) => {
  res.json(await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(200));
}));

router.patch("/read-all", asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
  res.json({ ok: true });
}));

router.patch("/:id/read", asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { read: true }, { new: true });
  if (!n) throw new HttpError(404, "Not found");
  res.json(n);
}));

module.exports = router;
