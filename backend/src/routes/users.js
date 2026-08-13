const express = require('express');
const router = express.Router();
const { getUsers, getUser, updateUser, deleteUser, updateMe } = require('../controllers/userController');
const { protect, requireTL } = require('../middleware/auth');

router.use(protect);

router.get('/', getUsers); // all authenticated users can list team members (needed for assignee dropdowns)
router.patch('/me', updateMe);
router.get('/:id', getUser);
router.patch('/:id', requireTL, updateUser);
router.delete('/:id', requireTL, deleteUser);

module.exports = router;
