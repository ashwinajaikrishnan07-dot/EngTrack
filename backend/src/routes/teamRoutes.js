const express = require('express');
const router = express.Router();
const { protect, requireTL } = require('../middleware/auth');
const {
  getInviteLink,
  sendInvite,
  getTeamMembers,
  getTeamStats,
  updateIssueStatus,
  createRepo,
  listRepos,
  updateRepo,
  getRepoInviteLink,
} = require('../controllers/teamController');

// All routes require authentication
router.use(protect);

// ── Repo management (TL only) ─────────────────────────────────────────────────
router.post('/repos', requireTL, createRepo);
router.get('/repos', requireTL, listRepos);
router.patch('/repos/:id', requireTL, updateRepo);
router.get('/repos/:id/invite', requireTL, getRepoInviteLink);

// ── Legacy invite (uses TL's primary teamId) ──────────────────────────────────
router.get('/invite-link', requireTL, getInviteLink);
router.post('/send-invite', requireTL, sendInvite);

// All authenticated team members
router.get('/members', getTeamMembers);
router.get('/stats', getTeamStats);

// Issue status update — any authenticated team member
router.patch('/issues/:id/status', updateIssueStatus);

module.exports = router;
