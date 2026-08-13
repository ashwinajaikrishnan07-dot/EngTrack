const Issue = require('../models/Issue');
const { generateAndSendEODReport, generateAndSendStandup } = require('../services/cronService');

// GET /api/reports/analytics
const getAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    // Issues by status
    const byStatus = await Issue.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Issues by priority
    const byPriority = await Issue.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]);

    // Issues created per day (last N days)
    const createdPerDay = await Issue.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Issues closed per day (last N days)
    const closedPerDay = await Issue.aggregate([
      { $match: { closedAt: { $gte: since, $ne: null } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$closedAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Top assignees by open issues
    const topAssignees = await Issue.aggregate([
      { $match: { status: { $ne: 'closed' }, assignee: { $ne: null } } },
      { $group: { _id: '$assignee', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      { $project: { name: '$user.name', email: '$user.email', count: 1 } },
    ]);

    res.json({ byStatus, byPriority, createdPerDay, closedPerDay, topAssignees });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/reports/eod — manually trigger EOD report
const triggerEODReport = async (req, res) => {
  try {
    await generateAndSendEODReport();
    res.json({ message: 'EOD report sent successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/reports/standup — manually trigger AI standup
const triggerStandup = async (req, res) => {
  try {
    await generateAndSendStandup();
    res.json({ message: 'AI standup report sent successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getAnalytics, triggerEODReport, triggerStandup };
