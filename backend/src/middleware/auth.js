const jwt = require('jsonwebtoken');
const User = require('../models/User');

const COOKIE_NAME = 'gitora_token';

const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Check httpOnly cookie first
    if (req.cookies && req.cookies[COOKIE_NAME]) {
      token = req.cookies[COOKIE_NAME];
    }

    // 2. Fall back to Authorization header (Bearer token)
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (!req.user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

// Team Lead or Lead role
const requireTL = (req, res, next) => {
  if (req.user && (req.user.role === 'tl' || req.user.role === 'lead')) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Team Lead only.' });
  }
};

// Same team check
const requireSameTeam = (req, res, next) => {
  if (!req.user.teamId) {
    return res.status(403).json({ message: 'You are not part of a team' });
  }
  next();
};

module.exports = { protect, requireTL, requireSameTeam };
