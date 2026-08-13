const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Team = require('../models/Team');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COOKIE_NAME = 'gitora_token';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function sendTokenCookie(res, userId) {
  const token = signToken(userId);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
  return token;
}

// ─── POST /api/auth/register/lead ────────────────────────────────────────────
const registerLead = async (req, res) => {
  try {
    console.log('registerLead body:', req.body);
    const { name, email, password, whatsappNumber } = req.body;

    if (!name || !email || !password) {
      console.log('Missing fields:', { name: !!name, email: !!email, password: !!password });
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      console.log('Email already exists:', email);
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Create the lead user (no team yet — TL adds repos after login)
    const user = await User.create({
      name,
      email,
      password,
      role: 'lead',
      whatsappNumber: whatsappNumber || '',
    });

    sendTokenCookie(res, user._id);

    return res.status(201).json({
      message: 'Team Lead registered successfully',
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('registerLead error:', err.message);
    return res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/auth/register/member ──────────────────────────────────────────
const registerMember = async (req, res) => {
  try {
    const { name, email, password, whatsappNumber, roleTag, inviteCode } = req.body;

    if (!name || !email || !password || !inviteCode) {
      return res.status(400).json({ message: 'Name, email, password and inviteCode are required' });
    }

    // Find team by invite code (case-insensitive)
    const team = await Team.findOne({ inviteCode: inviteCode.toUpperCase() });
    if (!team) {
      return res.status(404).json({ message: 'Invalid invite code — team not found' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: 'member',
      teamId: team._id,
      whatsappNumber: whatsappNumber || '',
      roleTag: roleTag || '',
      inviteCodeUsed: inviteCode.toUpperCase(),
    });

    sendTokenCookie(res, user._id);

    return res.status(201).json({
      message: 'Member registered successfully',
      user: user.toJSON(),
      team: {
        id: team._id,
        name: team.name,
      },
    });
  } catch (err) {
    console.error('registerMember error:', err.message);
    return res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    sendTokenCookie(res, user._id);

    // Populate team info
    const userObj = user.toJSON();
    if (user.teamId) {
      const team = await Team.findById(user.teamId).select('name inviteCode githubRepo');
      userObj.team = team;
    }

    return res.json({
      message: 'Login successful',
      user: userObj,
    });
  } catch (err) {
    console.error('login error:', err.message);
    return res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('teamId', 'name inviteCode githubRepo leadUserId');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const userObj = user.toJSON();
    userObj.teamId = user.teamId; // populated team object

    // For leads: also return all teams they own
    if (user.role === 'lead' || user.role === 'tl') {
      const teams = await Team.find({ leadUserId: user._id }).select('name inviteCode githubRepo createdAt').lean();
      userObj.teams = teams;
    }

    return res.json({ user: userObj });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
const logout = (req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax' });
  return res.json({ message: 'Logged out successfully' });
};

module.exports = { registerLead, registerMember, login, getMe, logout };
