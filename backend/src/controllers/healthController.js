const Issue = require('../models/Issue');
const User = require('../models/User');

/**
 * GET /api/health/dashboard
 * Engineering Health Dashboard data:
 * - Developer workload (open issues per dev)
 * - Overdue tasks (open > 24h with assignee)
 * - Average resolution time per developer
 * - Most unstable modules (from AI triage impactedModules)
 * - Escalated issues count
 * - Sprint bottleneck data
 */
const getHealthDashboard = async (req, res) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    // ── Developer workload ─────────────────────────────────────────────────
    const allUsers = await User.find({ isActive: true }).select('name email role _id').lean();

    const developerStats = await Promise.all(
      allUsers.map(async (user) => {
        const [activeCount, overdueCount, resolvedIssues] = await Promise.all([
          Issue.countDocuments({ assignee: user._id, status: { $ne: 'closed' } }),
          Issue.countDocuments({
            assignee: user._id,
            status: { $ne: 'closed' },
            createdAt: { $lte: oneDayAgo },
          }),
          Issue.find({
            assignee: user._id,
            status: 'closed',
            resolutionTimeHours: { $ne: null },
            closedAt: { $gte: sevenDaysAgo },
          })
            .select('resolutionTimeHours')
            .lean(),
        ]);

        const avgResolutionHours =
          resolvedIssues.length > 0
            ? Math.round(
                (resolvedIssues.reduce((sum, i) => sum + i.resolutionTimeHours, 0) /
                  resolvedIssues.length) *
                  10
              ) / 10
            : null;

        return {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          activeCount,
          overdueCount,
          avgResolutionHours,
          isOverloaded: activeCount >= 5,
          resolvedThisWeek: resolvedIssues.length,
        };
      })
    );

    // ── Unresolved bugs count ──────────────────────────────────────────────
    const [totalOpen, totalInProgress, totalEscalated, totalCritical] = await Promise.all([
      Issue.countDocuments({ status: 'open' }),
      Issue.countDocuments({ status: 'in-progress' }),
      Issue.countDocuments({ escalated: true, status: { $ne: 'closed' } }),
      Issue.countDocuments({ 'aiTriage.severity': 'Critical', status: { $ne: 'closed' } }),
    ]);

    // ── Overdue tasks (open > 24h) ─────────────────────────────────────────
    const overdueTasks = await Issue.find({
      status: { $ne: 'closed' },
      createdAt: { $lte: oneDayAgo },
    })
      .populate('assignee', 'name email')
      .select('issueId title priority assignee createdAt escalated aiTriage')
      .sort({ createdAt: 1 })
      .limit(20)
      .lean();

    // ── Most unstable modules (from AI triage) ────────────────────────────
    const moduleAgg = await Issue.aggregate([
      { $match: { 'aiTriage.impactedModules': { $exists: true, $ne: [] } } },
      { $unwind: '$aiTriage.impactedModules' },
      {
        $group: {
          _id: '$aiTriage.impactedModules',
          count: { $sum: 1 },
          openCount: {
            $sum: { $cond: [{ $ne: ['$status', 'closed'] }, 1, 0] },
          },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // ── Sprint bottleneck: issues with no activity for 48h ────────────────
    const twoDaysAgo = new Date(now - 48 * 60 * 60 * 1000);
    const bottlenecks = await Issue.find({
      status: 'in-progress',
      updatedAt: { $lte: twoDaysAgo },
    })
      .populate('assignee', 'name')
      .select('issueId title assignee updatedAt priority')
      .limit(10)
      .lean();

    // ── Average resolution time overall (last 30 days) ────────────────────
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const recentResolved = await Issue.find({
      status: 'closed',
      resolutionTimeHours: { $ne: null },
      closedAt: { $gte: thirtyDaysAgo },
    })
      .select('resolutionTimeHours priority')
      .lean();

    const avgResolutionOverall =
      recentResolved.length > 0
        ? Math.round(
            (recentResolved.reduce((s, i) => s + i.resolutionTimeHours, 0) /
              recentResolved.length) *
              10
          ) / 10
        : null;

    // ── Escalated issues ──────────────────────────────────────────────────
    const escalatedIssues = await Issue.find({
      escalated: true,
      status: { $ne: 'closed' },
    })
      .populate('assignee', 'name')
      .select('issueId title priority assignee escalatedAt escalationReason aiTriage')
      .sort({ escalatedAt: -1 })
      .limit(10)
      .lean();

    res.json({
      summary: {
        totalOpen,
        totalInProgress,
        totalEscalated,
        totalCritical,
        avgResolutionOverall,
        overloadedDevs: developerStats.filter((d) => d.isOverloaded).length,
      },
      developerStats,
      overdueTasks,
      unstableModules: moduleAgg,
      bottlenecks,
      escalatedIssues,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getHealthDashboard };
