const express = require('express');
const router = express.Router();
const {
  getIssues,
  getIssue,
  createIssue,
  updateIssue,
  deleteIssue,
  syncIssues,
  getStats,
  retriageIssue,
  naturalLanguageSearch,
  chat,
  getAnalytics,
} = require('../controllers/issueController');
const { protect, requireTL } = require('../middleware/auth');

router.use(protect);

router.get('/stats', getStats);
router.get('/analytics', getAnalytics);
router.post('/sync', syncIssues);
router.post('/search/nl', naturalLanguageSearch);
router.post('/chat', chat);
router.get('/', getIssues);
router.post('/', createIssue);
router.get('/:id', getIssue);
router.patch('/:id', updateIssue);
router.patch('/:id/status', updateIssue);  // Alias for status updates
router.delete('/:id', requireTL, deleteIssue);
router.post('/:id/retriage', retriageIssue);

module.exports = router;
