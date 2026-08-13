const Issue = require('../models/Issue');
const User = require('../models/User');
const {
  fetchGithubIssues,
  createGithubIssue,
  closeGithubIssue,
  reopenGithubIssue,
  getPriorityFromLabels,
} = require('../services/githubService');
const {
  sendNewIssueNotification,
  sendIssueClosedNotification,
} = require('../services/emailService');
const { triageIssue } = require('../services/aiService');
const { checkDuplicates } = require('../services/duplicateService');
const { chatWithAI } = require('../services/aiService');

// GET /api/issues — list with filters
const getIssues = async (req, res) => {
  try {
    const { status, priority, assignee, search, page = 1, limit = 20, repository } = req.query;
    const filter = {};

    // Filter by repository/teamId - use query param or fall back to user's teamId
    const teamId = repository || req.user?.teamId;
    if (teamId) {
      filter.teamId = teamId;
    }

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignee) filter.assignee = assignee;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Issue.countDocuments(filter);
    const issues = await Issue.find(filter)
      .populate('assignee', 'name email avatar')
      .populate('closedBy', 'name email')
      .populate('resolvedByUserId', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    res.json({ issues, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/issues/:id
const getIssue = async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('assignee', 'name email avatar')
      .populate('closedBy', 'name email')
      .populate('resolvedByUserId', 'name email');

    if (!issue) return res.status(404).json({ message: 'Issue not found' });
    res.json(issue);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/issues — create issue (also creates on GitHub)
const createIssue = async (req, res) => {
  try {
    const { title, description, priority, assigneeId, labels } = req.body;

    // ── Duplicate detection (before creating) ──────────────────────────────
    const duplicates = await checkDuplicates(title, description || '');

    // Create on GitHub first
    let githubData = null;
    try {
      const ghLabels = labels || [];
      if (priority && priority !== 'normal') ghLabels.push(priority);
      githubData = await createGithubIssue(title, description, ghLabels);
    } catch (ghErr) {
      console.warn('GitHub issue creation failed:', ghErr.message);
    }

    const issue = await Issue.create({
      issueId: githubData ? githubData.number : Date.now(),
      title,
      description,
      priority: priority || 'normal',
      assignee: assigneeId || null,
      labels: labels || [],
      githubUrl: githubData ? githubData.html_url : '',
      status: 'open',
      similarIssues: duplicates,
    });

    await issue.populate('assignee', 'name email avatar');

    // ── AI Triage (async, don't block response) ────────────────────────────
    const teamMembers = await User.find({ isActive: true }).select('name role email');
    triageIssue(issue, teamMembers).then(async (triage) => {
      await Issue.findByIdAndUpdate(issue._id, { aiTriage: triage });
    }).catch((e) => console.warn('AI triage failed:', e.message));

    // ── Notify whole team ──────────────────────────────────────────────────
    try {
      const emails = teamMembers.map((m) => m.email);
      if (emails.length > 0) await sendNewIssueNotification(issue, emails);
    } catch (emailErr) {
      console.warn('Email notification failed:', emailErr.message);
    }

    // Return issue + duplicate warnings
    res.status(201).json({ issue, duplicates });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/issues/:id — update issue
const updateIssue = async (req, res) => {
  try {
    const { title, description, priority, assigneeId, status, labels } = req.body;
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    const wasOpen = issue.status !== 'closed';

    if (title !== undefined) issue.title = title;
    if (description !== undefined) issue.description = description;
    if (priority !== undefined) issue.priority = priority;
    if (assigneeId !== undefined) issue.assignee = assigneeId || null;
    if (labels !== undefined) issue.labels = labels;

    if (status !== undefined) {
      // Handle both legacy status (open/closed) and workflow status (open/in_progress/resolved)
      if (status === 'resolved' || status === 'closed') {
        issue.status = 'closed';
        issue.workflowStatus = 'resolved';
        if (wasOpen) {
          issue.closedAt = new Date();
          issue.closedBy = req.user._id;
          issue.resolvedAt = new Date();
          issue.resolvedByUserId = req.user._id;
          // Calculate resolution time in hours
          const createdAt = new Date(issue.createdAt || issue.openedAt);
          issue.resolutionTimeHours = Math.round(
            (issue.resolvedAt - createdAt) / (1000 * 60 * 60) * 10
          ) / 10;

          // Close on GitHub
          try {
            await closeGithubIssue(issue.issueId);
          } catch (ghErr) {
            console.warn('GitHub close failed:', ghErr.message);
          }

          // Notify TL
          try {
            const tlEmail = process.env.TL_EMAIL;
            if (tlEmail) await sendIssueClosedNotification(issue, tlEmail);
          } catch (emailErr) {
            console.warn('TL email notification failed:', emailErr.message);
          }
        }
      } else if (status === 'in_progress') {
        issue.status = 'in-progress';
        issue.workflowStatus = 'in_progress';
      } else if (status === 'open') {
        issue.status = 'open';
        issue.workflowStatus = 'open';
        issue.closedAt = null;
        issue.closedBy = null;
        issue.resolvedAt = null;
        issue.resolvedByUserId = null;
        try {
          await reopenGithubIssue(issue.issueId);
        } catch (ghErr) {
          console.warn('GitHub reopen failed:', ghErr.message);
        }
      } else {
        // Fallback for any other status value
        issue.status = status;
      }
    }

    await issue.save();
    await issue.populate('assignee', 'name email avatar');
    await issue.populate('closedBy', 'name email');
    await issue.populate('resolvedByUserId', 'name email');

    res.json(issue);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/issues/:id (TL only)
const deleteIssue = async (req, res) => {
  try {
    const issue = await Issue.findByIdAndDelete(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });
    res.json({ message: 'Issue deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/issues/sync — sync from GitHub
const syncIssues = async (req, res) => {
  try {
    const { classifyIssueWithGroq } = require('../services/aiService');
    const { fetchGithubIssuesForRepo } = require('../services/githubService');
    const Team = require('../models/Team');

    // teamId can be passed in body as "teamId" or "repository", or fall back to user's primary teamId
    const teamId = req.body.teamId || req.body.repository || req.user.teamId || null;

    // If no team, try to sync directly from env config (legacy single-repo mode)
    if (!teamId) {
      const owner = process.env.GITHUB_OWNER;
      const repo = process.env.GITHUB_REPO;
      if (!owner || !repo) {
        return res.status(400).json({ message: 'No team selected and no GitHub repo in env config.' });
      }

      const githubIssues = await fetchGithubIssuesForRepo(owner, repo, 'all');
      let created = 0;
      let updated = 0;

      for (const gi of githubIssues) {
        const priority = getPriorityFromLabels(gi.labels);
        const status = gi.state === 'closed' ? 'closed' : 'open';

        const existing = await Issue.findOne({ issueId: gi.number, teamId: null });
        if (existing) {
          existing.title = gi.title;
          existing.description = gi.body || '';
          existing.status = status;
          existing.labels = gi.labels.map((l) => l.name);
          existing.githubUrl = gi.html_url;
          existing.syncedAt = new Date();
          if (status === 'closed' && !existing.closedAt) {
            existing.closedAt = gi.closed_at ? new Date(gi.closed_at) : new Date();
            existing.resolvedAt = existing.closedAt;
          }
          await existing.save();
          updated++;
        } else {
          let classification = { team: '', severity: 'moderate', severityReason: '', suggestedAction: '', estimatedComplexity: 'medium' };
          try {
            classification = await classifyIssueWithGroq(gi.title, gi.body || '');
          } catch (e) {
            console.warn('Groq classification failed for issue #' + gi.number + ':', e.message);
          }

          await Issue.create({
            issueId: gi.number,
            title: gi.title,
            description: gi.body || '',
            priority,
            status,
            labels: gi.labels.map((l) => l.name),
            githubUrl: gi.html_url,
            assigneeGithubLogin: gi.assignee ? gi.assignee.login : null,
            closedAt: gi.closed_at ? new Date(gi.closed_at) : null,
            resolvedAt: gi.closed_at ? new Date(gi.closed_at) : null,
            openedAt: gi.created_at ? new Date(gi.created_at) : new Date(),
            syncedAt: new Date(),
            teamId: null,
            classifiedTeam: classification.team || '',
            severity: classification.severity || 'moderate',
            severityReason: classification.severityReason || '',
            aiExplanation: classification.aiExplanation || '',
            suggestedAction: classification.suggestedAction || '',
            estimatedComplexity: classification.estimatedComplexity || 'medium',
          });
          created++;
        }
      }

      return res.json({
        message: `Sync complete for ${owner}/${repo}: ${created} created, ${updated} updated`,
        created,
        updated,
        repo: `${owner}/${repo}`,
      });
    }

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    if (!team.githubRepo) {
      return res.status(400).json({ message: 'This team has no GitHub repo configured.' });
    }

    const parts = team.githubRepo.split('/');
    const owner = parts[0].trim();
    const repo = parts[1].trim();

    const githubIssues = await fetchGithubIssuesForRepo(owner, repo, 'all');
    let created = 0;
    let updated = 0;

    for (const gi of githubIssues) {
      const priority = getPriorityFromLabels(gi.labels);
      const status = gi.state === 'closed' ? 'closed' : 'open';
      const workflowStatus = gi.state === 'closed' ? 'resolved' : 'open';

      // Scope lookup to this team to avoid cross-team collisions
      const existing = await Issue.findOne({ issueId: gi.number, teamId });
      if (existing) {
        existing.title = gi.title;
        existing.description = gi.body || '';
        existing.status = status;
        existing.workflowStatus = workflowStatus;
        existing.labels = gi.labels.map((l) => l.name);
        existing.githubUrl = gi.html_url;
        existing.syncedAt = new Date();
        if (status === 'closed' && !existing.closedAt) {
          existing.closedAt = gi.closed_at ? new Date(gi.closed_at) : new Date();
          existing.resolvedAt = existing.closedAt;
        }
        await existing.save();
        updated++;
      } else {
        let classification = { team: '', severity: 'moderate', severityReason: '', suggestedAction: '', estimatedComplexity: 'medium' };
        try {
          classification = await classifyIssueWithGroq(gi.title, gi.body || '');
        } catch (e) {
          console.warn('Groq classification failed for issue #' + gi.number + ':', e.message);
        }

        await Issue.create({
          issueId: gi.number,
          title: gi.title,
          description: gi.body || '',
          priority,
          status,
          workflowStatus,
          labels: gi.labels.map((l) => l.name),
          githubUrl: gi.html_url,
          assigneeGithubLogin: gi.assignee ? gi.assignee.login : null,
          closedAt: gi.closed_at ? new Date(gi.closed_at) : null,
          resolvedAt: gi.closed_at ? new Date(gi.closed_at) : null,
          openedAt: gi.created_at ? new Date(gi.created_at) : new Date(),
          syncedAt: new Date(),
          teamId,
          classifiedTeam: classification.team || '',
          severity: classification.severity || 'moderate',
          severityReason: classification.severityReason || '',
          aiExplanation: classification.aiExplanation || '',
          suggestedAction: classification.suggestedAction || '',
          estimatedComplexity: classification.estimatedComplexity || 'medium',
        });
        created++;
      }
    }

    res.json({
      message: `Sync complete for ${team.githubRepo}: ${created} created, ${updated} updated`,
      created,
      updated,
      repo: team.githubRepo,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/issues/stats — dashboard stats
const getStats = async (req, res) => {
  try {
    // Filter by repository/teamId - use query param or fall back to user's teamId
    const teamId = req.query.repository || req.user?.teamId;
    const filter = teamId ? { teamId } : {};

    const [open, inProgress, closed, urgent, high] = await Promise.all([
      Issue.countDocuments({ ...filter, status: 'open' }),
      Issue.countDocuments({ ...filter, status: 'in-progress' }),
      Issue.countDocuments({ ...filter, status: 'closed' }),
      Issue.countDocuments({ ...filter, priority: 'urgent', status: { $ne: 'closed' } }),
      Issue.countDocuments({ ...filter, priority: 'high', status: { $ne: 'closed' } }),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const raisedToday = await Issue.countDocuments({ ...filter, createdAt: { $gte: today } });
    const closedToday = await Issue.countDocuments({ ...filter, closedAt: { $gte: today } });

    res.json({ open, inProgress, closed, urgent, high, raisedToday, closedToday });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getIssues,
  getIssue,
  createIssue,
  updateIssue,
  deleteIssue,
  syncIssues,
  getStats,
  retriageIssue,
  naturalLanguageSearch,
  chat,
  getAnalytics,
};

// GET /api/issues/analytics — analytics data for dashboard
async function getAnalytics(req, res) {
  try {
    const teamId = req.query.repository || req.user?.teamId;
    const filter = teamId ? { teamId } : {};

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get all issues
    const allIssues = await Issue.find(filter)
      .populate('assignee', 'name roleTag')
      .populate('resolvedByUserId', 'name roleTag')
      .lean();

    // 1. Average time to close (in hours)
    const resolvedIssues = allIssues.filter(i => 
      i.workflowStatus === 'resolved' && i.resolvedAt && i.openedAt
    );
    
    let avgTimeToClose = null;
    if (resolvedIssues.length > 0) {
      const totalHours = resolvedIssues.reduce((sum, i) => {
        const hours = (new Date(i.resolvedAt) - new Date(i.openedAt)) / (1000 * 60 * 60);
        return sum + hours;
      }, 0);
      avgTimeToClose = Math.round(totalHours / resolvedIssues.length * 10) / 10;
    }

    // 2. Fastest resolved issues (top 5)
    const fastestResolved = resolvedIssues
      .map(i => ({
        issue_id: i.issueId,
        title: i.title,
        resolution_time_hours: Math.round((new Date(i.resolvedAt) - new Date(i.openedAt)) / (1000 * 60 * 60) * 10) / 10,
        assignee: i.resolvedByUserId?.name || i.assignee?.name || 'Unknown'
      }))
      .sort((a, b) => a.resolution_time_hours - b.resolution_time_hours)
      .slice(0, 5);

    // 3. Slowest/Overdue issues (open > 3 days)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    const slowestOverdue = allIssues
      .filter(i => 
        i.workflowStatus !== 'resolved' && 
        i.openedAt && 
        new Date(i.openedAt) < threeDaysAgo
      )
      .map(i => ({
        issue_id: i.issueId,
        title: i.title,
        days_open: Math.floor((Date.now() - new Date(i.openedAt)) / (1000 * 60 * 60 * 24)),
        assignee: i.assignee?.name || 'Unassigned'
      }))
      .sort((a, b) => b.days_open - a.days_open)
      .slice(0, 10);

    // 4. Issues over time (last 30 days)
    const issuesOverTime = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const count = allIssues.filter(issue => {
        if (!issue.openedAt && !issue.createdAt) return false;
        const issueDate = new Date(issue.openedAt || issue.createdAt);
        return issueDate.toISOString().split('T')[0] === dateStr;
      }).length;
      
      issuesOverTime.push({ date: dateStr, count });
    }

    // 5. Member stats
    const members = await User.find({ teamId: teamId || req.user?.teamId, isActive: true })
      .select('name roleTag')
      .lean();

    const memberStats = await Promise.all(members.map(async (member) => {
      const memberIssues = allIssues.filter(i => 
        i.assignee?._id?.toString() === member._id.toString() ||
        i.resolvedByUserId?._id?.toString() === member._id.toString()
      );

      const totalAssigned = allIssues.filter(i => 
        i.assignee?._id?.toString() === member._id.toString()
      ).length;

      const resolved = allIssues.filter(i => 
        i.resolvedByUserId?._id?.toString() === member._id.toString() &&
        i.workflowStatus === 'resolved'
      ).length;

      const inProgress = allIssues.filter(i => 
        i.assignee?._id?.toString() === member._id.toString() &&
        i.workflowStatus === 'in_progress'
      ).length;

      // Avg resolution time for this member
      const memberResolved = allIssues.filter(i => 
        i.resolvedByUserId?._id?.toString() === member._id.toString() &&
        i.workflowStatus === 'resolved' &&
        i.resolvedAt && i.openedAt
      );

      let avgResolutionTime = null;
      if (memberResolved.length > 0) {
        const totalMs = memberResolved.reduce((sum, i) => 
          sum + (new Date(i.resolvedAt) - new Date(i.openedAt)), 0
        );
        avgResolutionTime = Math.round((totalMs / memberResolved.length) / (1000 * 60 * 60) * 10) / 10;
      }

      return {
        name: member.name,
        role_tag: member.roleTag || '',
        total_assigned: totalAssigned,
        resolved,
        in_progress: inProgress,
        avg_resolution_time: avgResolutionTime,
        last_active: 'N/A'
      };
    }));

    // 6. Team/Department stats (by classifiedTeam)
    const teams = ['frontend', 'backend', 'devops', 'fullstack'];
    const teamStats = teams.map(team => {
      const teamIssues = allIssues.filter(i => i.classifiedTeam === team);
      const resolvedTeam = teamIssues.filter(i => i.workflowStatus === 'resolved');
      const openTeam = teamIssues.filter(i => i.workflowStatus !== 'resolved');

      let avgCloseTime = null;
      const resolvedWithTime = resolvedTeam.filter(i => i.resolvedAt && i.openedAt);
      if (resolvedWithTime.length > 0) {
        const totalMs = resolvedWithTime.reduce((sum, i) => 
          sum + (new Date(i.resolvedAt) - new Date(i.openedAt)), 0
        );
        avgCloseTime = Math.round((totalMs / resolvedWithTime.length) / (1000 * 60 * 60) * 10) / 10;
      }

      return {
        team,
        total: teamIssues.length,
        resolved: resolvedTeam.length,
        open: openTeam.length,
        avg_close_time: avgCloseTime
      };
    });

    res.json({
      avg_time_to_close: avgTimeToClose,
      fastest_resolved: fastestResolved,
      slowest_overdue: slowestOverdue,
      issues_over_time: issuesOverTime,
      member_stats: memberStats,
      team_stats: teamStats
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ message: err.message });
  }
}

// POST /api/issues/chat — AI chat endpoint
async function chat(req, res) {
  try {
    const { message, history, system_prompt } = req.body;
    
    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const result = await chatWithAI(message, history || [], system_prompt || '');
    res.json(result);
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ message: err.message });
  }
}

// POST /api/issues/:id/retriage — manually re-run AI triage
async function retriageIssue(req, res) {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    const teamMembers = await User.find({ isActive: true }).select('name role email');
    const triage = await triageIssue(issue, teamMembers);
    issue.aiTriage = triage;
    await issue.save();

    res.json({ triage });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/issues/search/nl — natural language search
async function naturalLanguageSearch(req, res) {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ message: 'Query required' });

    const { parseNaturalLanguageQuery } = require('../services/aiService');
    const users = await User.find({ isActive: true }).select('name _id').lean();
    const parsed = await parseNaturalLanguageQuery(query, [], users);

    // Build MongoDB filter from parsed result
    const filter = {};
    if (parsed.status) filter.status = parsed.status;
    if (parsed.priority) filter.priority = parsed.priority;
    if (parsed.search) {
      filter.$or = [
        { title: { $regex: parsed.search, $options: 'i' } },
        { description: { $regex: parsed.search, $options: 'i' } },
      ];
    }
    if (parsed.assigneeName) {
      const user = users.find((u) =>
        u.name.toLowerCase().includes(parsed.assigneeName.toLowerCase())
      );
      if (user) filter.assignee = user._id;
    }

    let query_db = Issue.find(filter)
      .populate('assignee', 'name email avatar')
      .limit(50);

    if (parsed.sortBy === 'oldest') query_db = query_db.sort({ createdAt: 1 });
    else if (parsed.sortBy === 'priority') query_db = query_db.sort({ priority: 1 });
    else query_db = query_db.sort({ createdAt: -1 });

    const issues = await query_db.lean();

    res.json({ issues, parsed, insight: parsed.insight || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
