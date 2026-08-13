const Issue = require('../models/Issue');
const { sendEscalationEmail } = require('./emailService');

const NO_ASSIGNEE_HOURS = parseInt(process.env.ESCALATION_NO_ASSIGNEE_HOURS) || 2;
const UNRESOLVED_HOURS = parseInt(process.env.ESCALATION_UNRESOLVED_HOURS) || 24;

/**
 * Run escalation checks — called by cron every hour.
 * Escalates issues that:
 *   1. Have no assignee after NO_ASSIGNEE_HOURS
 *   2. Are unresolved after UNRESOLVED_HOURS
 *   3. Are Critical severity and still open
 */
const runEscalationChecks = async () => {
  const tlEmail = process.env.TL_EMAIL;
  const managerEmail = process.env.MANAGER_EMAIL;

  if (!tlEmail) {
    console.log('Escalation skipped: TL_EMAIL not configured');
    return;
  }

  const now = new Date();
  const noAssigneeCutoff = new Date(now - NO_ASSIGNEE_HOURS * 60 * 60 * 1000);
  const unresolvedCutoff = new Date(now - UNRESOLVED_HOURS * 60 * 60 * 1000);

  const escalated = [];

  // ── Rule 1: No assignee after threshold ──────────────────────────────────
  const noAssigneeIssues = await Issue.find({
    status: { $ne: 'closed' },
    assignee: null,
    escalated: false,
    createdAt: { $lte: noAssigneeCutoff },
  }).lean();

  for (const issue of noAssigneeIssues) {
    await Issue.findByIdAndUpdate(issue._id, {
      escalated: true,
      escalatedAt: now,
      escalationReason: `No assignee for over ${NO_ASSIGNEE_HOURS} hours`,
    });
    escalated.push({ ...issue, reason: `No assignee for ${NO_ASSIGNEE_HOURS}+ hours` });
  }

  // ── Rule 2: Unresolved after threshold ───────────────────────────────────
  const unresolvedIssues = await Issue.find({
    status: { $ne: 'closed' },
    assignee: { $ne: null },
    escalated: false,
    createdAt: { $lte: unresolvedCutoff },
  })
    .populate('assignee', 'name email')
    .lean();

  for (const issue of unresolvedIssues) {
    await Issue.findByIdAndUpdate(issue._id, {
      escalated: true,
      escalatedAt: now,
      escalationReason: `Unresolved for over ${UNRESOLVED_HOURS} hours`,
    });
    escalated.push({ ...issue, reason: `Unresolved for ${UNRESOLVED_HOURS}+ hours` });
  }

  // ── Rule 3: Critical severity still open (re-escalate every 6h) ──────────
  const sixHoursAgo = new Date(now - 6 * 60 * 60 * 1000);
  const criticalIssues = await Issue.find({
    status: { $ne: 'closed' },
    'aiTriage.severity': 'Critical',
    $or: [
      { escalatedAt: null },
      { escalatedAt: { $lte: sixHoursAgo } },
    ],
  })
    .populate('assignee', 'name email')
    .lean();

  for (const issue of criticalIssues) {
    await Issue.findByIdAndUpdate(issue._id, {
      escalated: true,
      escalatedAt: now,
      escalationReason: 'Critical severity issue still open',
    });
    escalated.push({ ...issue, reason: 'Critical severity — needs immediate attention' });
  }

  if (escalated.length > 0) {
    console.log(`Escalating ${escalated.length} issues to TL`);
    try {
      await sendEscalationEmail(escalated, tlEmail, managerEmail);
    } catch (err) {
      console.error('Escalation email failed:', err.message);
    }
  } else {
    console.log('Escalation check: no issues to escalate');
  }

  return escalated;
};

module.exports = { runEscalationChecks };
