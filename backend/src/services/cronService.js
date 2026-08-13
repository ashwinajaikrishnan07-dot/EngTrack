const cron = require('node-cron');
const Issue = require('../models/Issue');
const User = require('../models/User');
const { sendEODReport, sendStandupReport } = require('./emailService');
const { runEscalationChecks } = require('./escalationService');
const { generateStandup } = require('./aiService');

const startCronJobs = () => {
  // ── EOD Summary Report — every day at 6:00 PM ──────────────────────────
  cron.schedule('0 18 * * *', async () => {
    console.log('[CRON] Running EOD summary report...');
    await generateAndSendEODReport();
  });

  // ── AI Daily Standup — every day at 6:05 PM ────────────────────────────
  cron.schedule('5 18 * * *', async () => {
    console.log('[CRON] Generating AI standup report...');
    await generateAndSendStandup();
  });

  // ── Escalation checks — every hour ────────────────────────────────────
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Running escalation checks...');
    await runEscalationChecks();
  });

  console.log('Cron jobs started:');
  console.log('  • EOD report         → 6:00 PM daily');
  console.log('  • AI standup report  → 6:05 PM daily');
  console.log('  • Escalation checks  → every hour');
};

// ─── EOD Report ───────────────────────────────────────────────────────────────
const generateAndSendEODReport = async () => {
  try {
    const tlEmail = process.env.TL_EMAIL;
    if (!tlEmail) {
      console.log('TL_EMAIL not configured, skipping EOD report');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const raisedToday = await Issue.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } });
    const closedToday = await Issue.countDocuments({ closedAt: { $gte: today, $lt: tomorrow } });
    const totalPending = await Issue.countDocuments({ status: { $in: ['open', 'in-progress'] } });

    const openIssues = await Issue.find({ status: { $in: ['open', 'in-progress'] } })
      .populate('assignee', 'name email')
      .sort({ priority: 1, createdAt: -1 })
      .lean();

    await sendEODReport({ raisedToday, closedToday, totalPending, openIssues }, tlEmail);
  } catch (err) {
    console.error('EOD report cron error:', err.message);
  }
};

// ─── AI Standup ───────────────────────────────────────────────────────────────
const generateAndSendStandup = async () => {
  try {
    const tlEmail = process.env.TL_EMAIL;
    if (!tlEmail) {
      console.log('TL_EMAIL not configured, skipping standup');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Issues resolved today
    const resolvedToday = await Issue.find({ closedAt: { $gte: today, $lt: tomorrow } })
      .select('issueId title')
      .lean();

    // Critical/High pending
    const pendingCritical = await Issue.find({
      status: { $ne: 'closed' },
      priority: { $in: ['urgent', 'high'] },
    })
      .populate('assignee', 'name')
      .select('issueId title priority assignee')
      .lean();

    // All open issues
    const openIssues = await Issue.find({ status: { $ne: 'closed' } }).lean();

    // Team workload stats
    const allUsers = await User.find({ isActive: true }).select('name _id').lean();
    const teamStats = await Promise.all(
      allUsers.map(async (u) => {
        const openCount = await Issue.countDocuments({
          assignee: u._id,
          status: { $ne: 'closed' },
        });
        return { name: u.name, openCount };
      })
    );

    const date = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const htmlContent = await generateStandup({
      resolvedToday,
      pendingCritical,
      openIssues,
      teamStats,
      date,
    });

    await sendStandupReport(htmlContent, tlEmail);
  } catch (err) {
    console.error('AI standup cron error:', err.message);
  }
};

module.exports = { startCronJobs, generateAndSendEODReport, generateAndSendStandup };
