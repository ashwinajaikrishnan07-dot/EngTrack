const express = require('express');
const router = express.Router();
const {
  registerLead,
  registerMember,
  login,
  getMe,
  logout,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/register/lead', registerLead);
router.post('/register/member', registerMember);
router.post('/login', login);
router.post('/logout', logout);

// Protected routes
router.get('/me', protect, getMe);

module.exports = router;
