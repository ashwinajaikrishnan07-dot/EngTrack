const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
};

// Send email to whole team when new issue is raised
const sendNewIssueNotification = async (issue, teamEmails) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email not configured, skipping notification');
    return;
  }

  const priorityColors = {
    urgent: '#ef4444',
    high: '#f97316',
    normal: '#3b82f6',
    low: '#6b7280',
  };

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">🐛 New Issue Raised</h1>
      </div>
      <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
        <h2 style="color: #111827; margin-top: 0;">#${issue.issueId} - ${issue.title}</h2>
        <p style="color: #6b7280;">${issue.description || 'No description provided.'}</p>
        <div style="display: flex; gap: 12px; margin: 16px 0;">
          <span style="background: ${priorityColors[issue.priority] || '#3b82f6'}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold;">
            ${issue.priority.toUpperCase()}
          </span>
          <span style="background: #e5e7eb; color: #374151; padding: 4px 12px; border-radius: 20px; font-size: 13px;">
            ${issue.status}
          </span>
        </div>
        ${issue.githubUrl ? `<a href="${issue.githubUrl}" style="color: #3b82f6;">View on GitHub →</a>` : ''}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #9ca3af; font-size: 12px;">GitHub Issue Manager • Auto-notification</p>
      </div>
    </div>
  `;

  try {
    await getTransporter().sendMail({
      from: `"GitHub Issue Manager" <${process.env.EMAIL_FROM}>`,
      to: teamEmails.join(', '),
      subject: `[New Issue] #${issue.issueId}: ${issue.title}`,
      html,
    });
    console.log(`New issue notification sent to ${teamEmails.length} members`);
  } catch (err) {
    console.error('Failed to send new issue notification:', err.message);
  }
};

// Send email to TL when issue is closed
const sendIssueClosedNotification = async (issue, tlEmail) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email not configured, skipping notification');
    return;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #065f46; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">✅ Issue Closed</h1>
      </div>
      <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
        <h2 style="color: #111827; margin-top: 0;">#${issue.issueId} - ${issue.title}</h2>
        <p style="color: #6b7280;">This issue has been marked as closed.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; color: #6b7280; font-size: 14px;">Closed At:</td>
            <td style="padding: 8px; color: #111827; font-size: 14px;">${new Date(issue.closedAt).toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #6b7280; font-size: 14px;">Priority:</td>
            <td style="padding: 8px; color: #111827; font-size: 14px;">${issue.priority}</td>
          </tr>
        </table>
        ${issue.githubUrl ? `<a href="${issue.githubUrl}" style="color: #3b82f6;">View on GitHub →</a>` : ''}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #9ca3af; font-size: 12px;">GitHub Issue Manager • TL Notification</p>
      </div>
    </div>
  `;

  try {
    await getTransporter().sendMail({
      from: `"GitHub Issue Manager" <${process.env.EMAIL_FROM}>`,
      to: tlEmail,
      subject: `[Issue Closed] #${issue.issueId}: ${issue.title}`,
      html,
    });
    console.log(`Issue closed notification sent to TL: ${tlEmail}`);
  } catch (err) {
    console.error('Failed to send issue closed notification:', err.message);
  }
};

// Send EOD summary report to TL
const sendEODReport = async (report, tlEmail) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email not configured, skipping EOD report');
    return;
  }

  const openIssuesRows = report.openIssues
    .map(
      (issue) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px; color: #374151;">#${issue.issueId}</td>
        <td style="padding: 10px; color: #374151;">${issue.title}</td>
        <td style="padding: 10px;">
          <span style="background: ${
            issue.priority === 'urgent'
              ? '#fef2f2'
              : issue.priority === 'high'
              ? '#fff7ed'
              : '#eff6ff'
          }; color: ${
        issue.priority === 'urgent'
          ? '#ef4444'
          : issue.priority === 'high'
          ? '#f97316'
          : '#3b82f6'
      }; padding: 2px 8px; border-radius: 12px; font-size: 12px;">${issue.priority}</span>
        </td>
        <td style="padding: 10px; color: #374151;">${
          issue.assignee ? issue.assignee.name : 'Unassigned'
        }</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <div style="background: #1e40af; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">📊 EOD Summary Report</h1>
        <p style="color: #bfdbfe; margin: 8px 0 0;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb;">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
          <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center;">
            <div style="font-size: 32px; font-weight: bold; color: #3b82f6;">${report.raisedToday}</div>
            <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Raised Today</div>
          </div>
          <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center;">
            <div style="font-size: 32px; font-weight: bold; color: #10b981;">${report.closedToday}</div>
            <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Closed Today</div>
          </div>
          <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center;">
            <div style="font-size: 32px; font-weight: bold; color: #f59e0b;">${report.totalPending}</div>
            <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Total Pending</div>
          </div>
        </div>

        <h3 style="color: #111827; margin-bottom: 12px;">Open Issues</h3>
        ${
          report.openIssues.length > 0
            ? `
          <table style="width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 10px; text-align: left; color: #6b7280; font-size: 13px;">#</th>
                <th style="padding: 10px; text-align: left; color: #6b7280; font-size: 13px;">Title</th>
                <th style="padding: 10px; text-align: left; color: #6b7280; font-size: 13px;">Priority</th>
                <th style="padding: 10px; text-align: left; color: #6b7280; font-size: 13px;">Assignee</th>
              </tr>
            </thead>
            <tbody>${openIssuesRows}</tbody>
          </table>
        `
            : '<p style="color: #6b7280;">No open issues. Great work! 🎉</p>'
        }
      </div>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">GitHub Issue Manager • Daily EOD Report • Sent at 6:00 PM</p>
      </div>
    </div>
  `;

  try {
    await getTransporter().sendMail({
      from: `"GitHub Issue Manager" <${process.env.EMAIL_FROM}>`,
      to: tlEmail,
      subject: `[EOD Report] ${new Date().toLocaleDateString()} - ${report.raisedToday} raised, ${report.closedToday} closed`,
      html,
    });
    console.log(`EOD report sent to TL: ${tlEmail}`);
  } catch (err) {
    console.error('Failed to send EOD report:', err.message);
  }
};

// ─── Escalation Email ─────────────────────────────────────────────────────────
async function sendEscalationEmail(escalatedIssues, tlEmail, managerEmail) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;

  const rows = escalatedIssues
    .map(
      (issue) => `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:10px;color:#374151;">#${issue.issueId}</td>
        <td style="padding:10px;color:#374151;">${issue.title}</td>
        <td style="padding:10px;">
          <span style="background:#fef2f2;color:#ef4444;padding:2px 8px;border-radius:12px;font-size:12px;">${issue.priority}</span>
        </td>
        <td style="padding:10px;color:#374151;">${issue.assignee ? issue.assignee.name : 'Unassigned'}</td>
        <td style="padding:10px;color:#dc2626;font-size:13px;">${issue.reason}</td>
      </tr>`
    )
    .join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
      <div style="background:#dc2626;padding:20px;border-radius:8px 8px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:20px;">🚨 Issue Escalation Alert</h1>
        <p style="color:#fecaca;margin:6px 0 0;">${new Date().toLocaleString()}</p>
      </div>
      <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px;">
        <p style="color:#374151;">${escalatedIssues.length} issue(s) require immediate attention:</p>
        <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:10px;text-align:left;color:#6b7280;font-size:13px;">#</th>
              <th style="padding:10px;text-align:left;color:#6b7280;font-size:13px;">Title</th>
              <th style="padding:10px;text-align:left;color:#6b7280;font-size:13px;">Priority</th>
              <th style="padding:10px;text-align:left;color:#6b7280;font-size:13px;">Assignee</th>
              <th style="padding:10px;text-align:left;color:#6b7280;font-size:13px;">Reason</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="color:#9ca3af;font-size:12px;margin-top:20px;">GitHub Issue Manager • Auto-Escalation</p>
      </div>
    </div>`;

  const recipients = [tlEmail, managerEmail].filter(Boolean).join(', ');
  await getTransporter().sendMail({
    from: `"GitHub Issue Manager" <${process.env.EMAIL_FROM}>`,
    to: recipients,
    subject: `[ESCALATION] ${escalatedIssues.length} issue(s) need immediate attention`,
    html,
  });
  console.log(`Escalation email sent to: ${recipients}`);
}

// ─── AI Standup Report Email ──────────────────────────────────────────────────
async function sendStandupReport(htmlContent, tlEmail) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;

  const wrapper = `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
      <div style="background:#1e40af;padding:20px;border-radius:8px 8px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:20px;">🤖 AI Daily Standup Report</h1>
        <p style="color:#bfdbfe;margin:6px 0 0;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px;">
        ${htmlContent}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
        <p style="color:#9ca3af;font-size:12px;">GitHub Issue Manager • AI-Generated Standup • Sent at 6:00 PM</p>
      </div>
    </div>`;

  await getTransporter().sendMail({
    from: `"GitHub Issue Manager" <${process.env.EMAIL_FROM}>`,
    to: tlEmail,
    subject: `[AI Standup] ${new Date().toLocaleDateString()} Engineering Report`,
    html: wrapper,
  });
  console.log(`AI standup report sent to: ${tlEmail}`);
}

module.exports = {
  sendNewIssueNotification,
  sendIssueClosedNotification,
  sendEODReport,
  sendEscalationEmail,
  sendStandupReport,
};
