const express = require('express');
const router = express.Router();
const { registerLead, registerMember, login, getMe, logout } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Legacy register route — maps to registerLead for backwards compatibility
router.post('/register', registerLead);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', protect, getMe);

module.exports = router;
