require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const { startCronJobs } = require('./services/cronService');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));   // new team-based auth
app.use('/api/auth', require('./routes/auth'));          // legacy auth (kept for compatibility)
app.use('/api/issues', require('./routes/issues'));
app.use('/api/users', require('./routes/users'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/webhook', require('./routes/webhook'));
app.use('/api/health', require('./routes/health'));
app.use('/api/team', require('./routes/teamRoutes'));    // team management + issue status

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

// Start cron jobs
startCronJobs();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // ── GitHub config debug ──────────────────────────────────────────────────
  const token = process.env.GITHUB_TOKEN || '';
  if (!token || token === 'your_github_personal_access_token') {
    console.warn('[GitHub] WARNING: GITHUB_TOKEN is not set or is still the placeholder value.');
    console.warn('[GitHub] GitHub sync and issue creation will fail with 401 Unauthorized.');
    console.warn('[GitHub] Set a valid token in backend/.env');
  } else {
    console.log(`[GitHub] Token loaded: ${token.slice(0, 8)}... (${token.length} chars)`);
    console.log(`[GitHub] Repo: ${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}`);
  }
});

module.exports = app;
