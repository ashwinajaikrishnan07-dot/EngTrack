const express = require('express');
const router = express.Router();
const { getHealthDashboard } = require('../controllers/healthController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/dashboard', getHealthDashboard);

module.exports = router;
