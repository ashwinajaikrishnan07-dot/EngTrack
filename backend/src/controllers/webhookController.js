const crypto = require('crypto');
const Issue = require('../models/Issue');
const User = require('../models/User');
const { getPriorityFromLabels } = require('../services/githubService');
const { sendNewIssueNotification } = require('../services/emailService');
const { classifyIssueWithGroq } = require('../services/aiService');

// POST /api/webhook/github
const handleGithubWebhook = async (req, res) => {
  // ── Verify webhook signature ──────────────────────────────────────────────
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (secret) {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
      return res.status(401).json({ message: 'No signature' });
    }
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
    if (signature !== digest) {
      return res.status(401).json({ message: 'Invalid signature' });
    }
  }

  const event = req.headers['x-github-event'];
  const payload = req.body;

  try {
    if (event === 'issues') {
      const { action, issue } = payload;

      if (action === 'opened') {
        const priority = getPriorityFromLabels(issue.labels || []);

        // ── Step 1: Create issue in DB ──────────────────────────────────────
        const newIssue = await Issue.create({
          issueId: issue.number,
          title: issue.title,
          description: issue.body || '',
          priority,
          status: 'open',
          workflowStatus: 'open',
          openedAt: new Date(),
          labels: (issue.labels || []).map((l) => l.name),
          githubUrl: issue.html_url,
          assigneeGithubLogin: issue.assignee ? issue.assignee.login : null,
        });

        // ── Step 2: Classify with Groq (async, don't block response) ────────
        classifyIssueWithGroq(issue.title, issue.body || '').then(async (classification) => {
          try {
            // Save classification fields to the issue
            await Issue.findByIdAndUpdate(newIssue._id, {
              classifiedTeam: classification.team,
              severity: classification.severity,
              severityReason: classification.severityReason,
              suggestedAction: classification.suggestedAction,
              estimatedComplexity: classification.estimatedComplexity,
            });

            console.log(
              `[Groq] Issue #${issue.number} classified → team:${classification.team} severity:${classification.severity}`
            );

            // ── Step 3: Find members whose roleTag matches classifiedTeam ───
            const matchedMembers = await User.find({
              isActive: true,
              roleTag: classification.team,
            }).select('email whatsappNumber name');

            // ── Step 4: Send email only to matched members ──────────────────
            // (Existing sendNewIssueNotification logic unchanged — just filtered recipients)
            if (matchedMembers.length > 0) {
              const emails = matchedMembers.map((m) => m.email).filter(Boolean);
              if (emails.length > 0) {
                await sendNewIssueNotification(
                  { ...newIssue.toObject(), classifiedTeam: classification.team },
                  emails
                );
                console.log(
                  `[Webhook] Email sent to ${emails.length} ${classification.team} member(s)`
                );
              }

              // ── Step 5: WhatsApp to matched members ─────────────────────
              const whatsappNumbers = matchedMembers
                .map((m) => m.whatsappNumber)
                .filter(Boolean);

              if (whatsappNumbers.length > 0) {
                sendWhatsAppToMembers(newIssue, classification, whatsappNumbers).catch(
                  (e) => console.warn('[Webhook] WhatsApp failed:', e.message)
                );
              }
            } else {
              // No matched members — fall back to all active users (existing behaviour)
              console.log(
                `[Webhook] No ${classification.team} members found, notifying all team`
              );
              const allMembers = await User.find({ isActive: true }).select('email');
              const emails = allMembers.map((m) => m.email).filter(Boolean);
              if (emails.length > 0) {
                await sendNewIssueNotification(newIssue, emails);
              }
            }
          } catch (classifyErr) {
            console.error('[Webhook] Post-classification error:', classifyErr.message);
          }
        }).catch((e) => console.warn('[Webhook] Groq classification failed:', e.message));

      } else if (action === 'closed') {
        await Issue.findOneAndUpdate(
          { issueId: issue.number },
          {
            status: 'closed',
            workflowStatus: 'resolved',
            closedAt: new Date(),
            resolvedAt: new Date(),
          }
        );
      } else if (action === 'reopened') {
        await Issue.findOneAndUpdate(
          { issueId: issue.number },
          { status: 'open', workflowStatus: 'open', closedAt: null, resolvedAt: null }
        );
      } else if (action === 'edited') {
        await Issue.findOneAndUpdate(
          { issueId: issue.number },
          { title: issue.title, description: issue.body || '' }
        );
      } else if (action === 'labeled' || action === 'unlabeled') {
        const priority = getPriorityFromLabels(issue.labels || []);
        await Issue.findOneAndUpdate(
          { issueId: issue.number },
          {
            labels: (issue.labels || []).map((l) => l.name),
            priority,
          }
        );
      } else if (action === 'assigned') {
        await Issue.findOneAndUpdate(
          { issueId: issue.number },
          { assigneeGithubLogin: issue.assignee ? issue.assignee.login : null }
        );
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ─── Helper: send WhatsApp to matched team members ────────────────────────────
async function sendWhatsAppToMembers(issue, classification, phoneNumbers) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!sid || !token || !from || sid === 'your_twilio_account_sid') return;

  const twilio = require('twilio')(sid, token);
  const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  const body =
    `*Gitora — New Issue for ${classification.team.toUpperCase()} Team*\n\n` +
    `*${issue.title}*\n` +
    `Severity: ${classification.severity.toUpperCase()}\n` +
    `Reason: ${classification.severityReason}\n` +
    `Action: ${classification.suggestedAction}\n` +
    `Complexity: ${classification.estimatedComplexity}\n` +
    `\nView: ${appUrl}/dashboard/issues`;

  for (const phone of phoneNumbers) {
    try {
      await twilio.messages.create({
        from: `whatsapp:${from}`,
        to: `whatsapp:${phone}`,
        body,
      });
      console.log(`[WhatsApp] Sent to ${phone}`);
    } catch (e) {
      console.warn(`[WhatsApp] Failed to ${phone}:`, e.message);
    }
  }
}

module.exports = { handleGithubWebhook };
