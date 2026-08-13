const express = require('express');
const router = express.Router();
const { getAnalytics, triggerEODReport, triggerStandup } = require('../controllers/reportController');
const { protect, requireTL } = require('../middleware/auth');

router.use(protect);

router.get('/analytics', getAnalytics);
router.post('/eod', requireTL, triggerEODReport);
router.post('/standup', requireTL, triggerStandup);

module.exports = router;
