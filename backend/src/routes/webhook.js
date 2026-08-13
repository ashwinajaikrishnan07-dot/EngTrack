const express = require('express');
const router = express.Router();
const { handleGithubWebhook } = require('../controllers/webhookController');

// Raw body needed for signature verification
router.post('/github', express.json(), handleGithubWebhook);

module.exports = router;
