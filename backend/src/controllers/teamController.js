const Team = require('../models/Team');
const User = require('../models/User');
const Issue = require('../models/Issue');
const nodemailer = require('nodemailer');
const { closeGithubIssue, reopenGithubIssue } = require('../services/githubService');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

function canEmail() {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS &&
    process.env.EMAIL_USER !== 'your_email@gmail.com');
}

async function getLeadTeam(req, res) {
  const team = await Team.findById(req.user.teamId);
  if (!team) {
    res.status(404).json({ message: 'Team not found' });
    return null;
  }
  if (team.leadUserId.toString() !== req.user._id.toString()) {
    res.status(403).json({ message: 'Only the team lead can perform this action' });
    return null;
  }
  return team;
}

// ─── GET /api/team/invite-link ────────────────────────────────────────────────
const getInviteLink = async (req, res) => {
  try {
    const team = await getLeadTeam(req, res);
    if (!team) return;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const signupUrl = `${frontendUrl}/register/member?invite=${team.inviteCode}`;

    return res.json({
      inviteCode: team.inviteCode,
      signupUrl,
      teamName: team.name,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/team/send-invite ───────────────────────────────────────────────
const sendInvite = async (req, res) => {
  try {
    const team = await getLeadTeam(req, res);
    if (!team) return;

    const { emails } = req.body;
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ message: 'emails array is required' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const signupUrl = `${frontendUrl}/register/member?invite=${team.inviteCode}`;
    const leadName = req.user.name;

    if (!canEmail()) {
      return res.json({
        message: 'Email not configured — invite details returned instead',
        inviteCode: team.inviteCode,
        signupUrl,
        emailsSent: 0,
      });
    }

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#4f46e5;padding:28px 36px;border-radius:12px 12px 0 0">
          <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">You have been invited to join Gitora</h1>
        </div>
        <div style="background:#fff;padding:28px 36px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <p style="color:#374151;font-size:15px"><strong>${leadName}</strong> has invited you to join <strong>${team.name}</strong> on Gitora — an AI-powered engineering issue management platform.</p>

          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin:20px 0;text-align:center">
            <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600">Your Invite Code</p>
            <p style="margin:0;font-size:32px;font-weight:700;color:#4f46e5;letter-spacing:4px;font-family:monospace">${team.inviteCode}</p>
          </div>

          <p style="color:#374151;font-size:14px">To join the team:</p>
          <ol style="color:#374151;font-size:14px;line-height:1.8">
            <li>Click the button below to open the registration page</li>
            <li>Fill in your name, email, and password</li>
            <li>Enter the invite code above when prompted</li>
            <li>Select your role tag (frontend / backend / devops / fullstack)</li>
          </ol>

          <div style="text-align:center;margin:28px 0">
            <a href="${signupUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:13px 32px;border-radius:10px;font-weight:700;font-size:14px">Join the Team</a>
          </div>

          <p style="color:#9ca3af;font-size:12px;margin-top:20px">Or copy this link: <a href="${signupUrl}" style="color:#4f46e5">${signupUrl}</a></p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
          <p style="color:#9ca3af;font-size:12px;margin:0">Gitora &middot; AI-Powered Engineering Issue Management</p>
        </div>
      </div>`;

    const transporter = getTransporter();
    let sent = 0;
    const failed = [];

    for (const email of emails) {
      try {
        await transporter.sendMail({
          from: `"Gitora" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
          to: email,
          subject: `${leadName} invited you to join ${team.name} on Gitora`,
          html,
        });
        sent++;
      } catch (e) {
        console.warn(`Failed to send invite to ${email}:`, e.message);
        failed.push(email);
      }
    }

    return res.json({
      message: `Invites sent: ${sent} of ${emails.length}`,
      emailsSent: sent,
      failed,
      inviteCode: team.inviteCode,
      signupUrl,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/team/members ────────────────────────────────────────────────────
const getTeamMembers = async (req, res) => {
  try {
    if (!req.user.teamId) {
      return res.status(400).json({ message: 'You are not part of a team' });
    }

    const members = await User.find({ teamId: req.user.teamId, isActive: true })
      .select('name email role roleTag whatsappNumber createdAt')
      .lean();

    // Attach per-member issue stats
    const membersWithStats = await Promise.all(
      members.map(async (member) => {
        const [totalAssigned, resolved, inProgress] = await Promise.all([
          Issue.countDocuments({ assignee: member._id }),
          Issue.countDocuments({ resolvedByUserId: member._id, workflowStatus: 'resolved' }),
          Issue.countDocuments({ assignee: member._id, workflowStatus: 'in_progress' }),
        ]);

        // Average resolution time
        const resolvedIssues = await Issue.find({
          resolvedByUserId: member._id,
          workflowStatus: 'resolved',
          resolvedAt: { $ne: null },
          openedAt: { $ne: null },
        }).select('openedAt resolvedAt').lean();

        let avgResolutionHours = null;
        if (resolvedIssues.length > 0) {
          const totalMs = resolvedIssues.reduce((sum, i) => {
            return sum + (new Date(i.resolvedAt) - new Date(i.openedAt));
          }, 0);
          avgResolutionHours = Math.round((totalMs / resolvedIssues.length) / 36000) / 100;
        }

        return {
          ...member,
          stats: { totalAssigned, resolved, inProgress, avgResolutionHours },
        };
      })
    );

    return res.json({ members: membersWithStats, total: membersWithStats.length });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/team/stats ──────────────────────────────────────────────────────
const getTeamStats = async (req, res) => {
  try {
    // Use repository query param if provided, otherwise fall back to user's teamId
    const teamId = req.query.repository || req.user.teamId;
    
    if (!teamId) {
      return res.status(400).json({ message: 'You are not part of a team' });
    }

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // Total issues for this team
    const [
      totalIssues,
      criticalCount, moderateCount, lowCount,
      openCount, inProgressCount, resolvedCount,
      unresolvedAlerts,
    ] = await Promise.all([
      Issue.countDocuments({ teamId }),
      Issue.countDocuments({ teamId, severity: 'critical' }),
      Issue.countDocuments({ teamId, severity: 'moderate' }),
      Issue.countDocuments({ teamId, severity: 'low' }),
      Issue.countDocuments({ teamId, workflowStatus: 'open' }),
      Issue.countDocuments({ teamId, workflowStatus: 'in_progress' }),
      Issue.countDocuments({ teamId, workflowStatus: 'resolved' }),
      Issue.find({
        teamId,
        workflowStatus: { $in: ['open', 'in_progress'] },
        openedAt: { $lte: threeDaysAgo },
      }).select('issueId title openedAt workflowStatus severity assignee').populate('assignee', 'name').lean(),
    ]);

    // Per-member stats
    const members = await User.find({ teamId, isActive: true }).select('name _id').lean();
    const memberStats = await Promise.all(
      members.map(async (m) => {
        const resolvedIssues = await Issue.find({
          resolvedByUserId: m._id,
          workflowStatus: 'resolved',
          resolvedAt: { $ne: null },
          openedAt: { $ne: null },
        }).select('openedAt resolvedAt').lean();

        const issuesResolved = resolvedIssues.length;
        let avgResolutionTime = null;
        if (issuesResolved > 0) {
          const totalMs = resolvedIssues.reduce(
            (sum, i) => sum + (new Date(i.resolvedAt) - new Date(i.openedAt)), 0
          );
          avgResolutionTime = Math.round((totalMs / issuesResolved) / 36000) / 100; // hours
        }

        return { name: m.name, issuesResolved, avgResolutionTime };
      })
    );

    return res.json({
      totalIssues,
      bySeverity: { critical: criticalCount, moderate: moderateCount, low: lowCount },
      byStatus: { open: openCount, in_progress: inProgressCount, resolved: resolvedCount },
      memberStats,
      unresolvedAlerts: unresolvedAlerts.map((i) => ({
        issueId: i.issueId,
        title: i.title,
        openedAt: i.openedAt,
        workflowStatus: i.workflowStatus,
        severity: i.severity,
        assignee: i.assignee?.name || 'Unassigned',
        daysOpen: Math.floor((Date.now() - new Date(i.openedAt)) / 86400000),
      })),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─── PATCH /api/issues/:id/status ────────────────────────────────────────────
const updateIssueStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['open', 'in_progress', 'resolved'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    // Ensure user belongs to the same team as the issue
    if (issue.teamId && req.user.teamId) {
      if (issue.teamId.toString() !== req.user.teamId.toString()) {
        return res.status(403).json({ message: 'You do not have access to this issue' });
      }
    }

    const updates = { workflowStatus: status };

    if (status === 'resolved') {
      updates.resolvedByUserId = req.user._id;
      updates.resolvedAt = new Date();
      updates.status = 'closed'; // keep legacy status field in sync
      updates.closedAt = new Date();

      // Calculate resolution time
      if (issue.openedAt) {
        updates.resolutionTimeHours =
          Math.round((Date.now() - new Date(issue.openedAt)) / 36000) / 100;
      }

      // Close issue on GitHub too
      try {
        if (issue.issueId) {
          await closeGithubIssue(issue.issueId);
          console.log(`[GitHub] Closed issue #${issue.issueId} on GitHub successfully`);
        }
      } catch (ghErr) {
        console.warn(`[GitHub] Failed to close issue #${issue.issueId} on GitHub:`, ghErr.message);
      }
    } else if (status === 'in_progress') {
      updates.status = 'in-progress';
    } else if (status === 'open') {
      updates.status = 'open';
      updates.resolvedByUserId = null;
      updates.resolvedAt = null;

      // Reopen issue on GitHub too
      try {
        if (issue.issueId) {
          await reopenGithubIssue(issue.issueId);
          console.log(`[GitHub] Reopened issue #${issue.issueId} on GitHub successfully`);
        }
      } catch (ghErr) {
        console.warn(`[GitHub] Failed to reopen issue #${issue.issueId} on GitHub:`, ghErr.message);
      }
    }

    const updated = await Issue.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('assignee', 'name email')
      .populate('resolvedByUserId', 'name email');

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getInviteLink,
  sendInvite,
  getTeamMembers,
  getTeamStats,
  updateIssueStatus,
  createRepo,
  listRepos,
  updateRepo,
  getRepoInviteLink,
};

// ─── POST /api/team/repos — TL creates a new repo/team ───────────────────────
async function createRepo(req, res) {
  try {
    const { name, githubRepo } = req.body;
    if (!githubRepo) {
      return res.status(400).json({ message: 'githubRepo (owner/repo) is required' });
    }
    // Validate format
    if (!githubRepo.includes('/')) {
      return res.status(400).json({ message: 'githubRepo must be in "owner/repo" format' });
    }

    const teamName = name || githubRepo.split('/')[1];
    const team = await Team.create({
      name: teamName,
      leadUserId: req.user._id,
      githubRepo: githubRepo.trim(),
    });

    // If TL has no primary team yet, set this as their teamId
    if (!req.user.teamId) {
      await require('../models/User').findByIdAndUpdate(req.user._id, { teamId: team._id });
    }

    return res.status(201).json({
      message: 'Repo added successfully',
      team: {
        id: team._id,
        name: team.name,
        githubRepo: team.githubRepo,
        inviteCode: team.inviteCode,
        createdAt: team.createdAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// ─── GET /api/team/repos — list all repos/teams owned by TL ──────────────────
async function listRepos(req, res) {
  try {
    const teams = await Team.find({ leadUserId: req.user._id })
      .select('name githubRepo inviteCode createdAt')
      .lean();

    // Attach member count and issue count per team
    const teamsWithStats = await Promise.all(
      teams.map(async (t) => {
        const [memberCount, issueCount] = await Promise.all([
          require('../models/User').countDocuments({ teamId: t._id }),
          Issue.countDocuments({ teamId: t._id }),
        ]);
        return { ...t, memberCount, issueCount };
      })
    );

    return res.json({ teams: teamsWithStats });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// ─── PATCH /api/team/repos/:id — update repo name or githubRepo ──────────────
async function updateRepo(req, res) {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    if (team.leadUserId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the team lead can update this repo' });
    }

    const { name, githubRepo } = req.body;
    if (name) team.name = name;
    if (githubRepo) {
      if (!githubRepo.includes('/')) {
        return res.status(400).json({ message: 'githubRepo must be in "owner/repo" format' });
      }
      team.githubRepo = githubRepo.trim();
    }
    await team.save();

    return res.json({
      message: 'Repo updated',
      team: { id: team._id, name: team.name, githubRepo: team.githubRepo, inviteCode: team.inviteCode },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// ─── GET /api/team/repos/:id/invite — get invite link for a specific team ────
async function getRepoInviteLink(req, res) {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    if (team.leadUserId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the team lead can get this invite link' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const signupUrl = `${frontendUrl}/register/member?invite=${team.inviteCode}`;

    return res.json({
      inviteCode: team.inviteCode,
      signupUrl,
      teamName: team.name,
      githubRepo: team.githubRepo,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}
