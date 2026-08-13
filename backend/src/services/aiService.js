const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

let client = null;

const getClient = () => {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
      return null;
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
};

// ─── Feature 1: AI Issue Triage ──────────────────────────────────────────────
const triageIssue = async (issue, teamMembers = []) => {
  const ai = getClient();
  if (!ai) {
    console.log('AI triage skipped: ANTHROPIC_API_KEY not configured');
    return getDefaultTriage(issue);
  }

  const teamList = teamMembers.map((m) => `${m.name} (${m.role})`).join(', ') || 'No team members yet';

  const prompt = `You are a senior software engineering lead triaging a GitHub issue.

Issue Title: ${issue.title}
Issue Description: ${issue.description || 'No description provided'}
Current Labels: ${(issue.labels || []).join(', ') || 'none'}
Team Members: ${teamList}

Analyze this issue and respond with ONLY a valid JSON object (no markdown, no explanation):
{
  "severity": "Critical|High|Normal|Low",
  "likelyCause": "one sentence describing the likely root cause",
  "suggestedAssignee": "name of best team member or role (e.g. Backend Team)",
  "estimatedResolution": "e.g. 2 hours, 1 day, 3 days",
  "impactedModules": ["module1", "module2"],
  "debuggingSteps": ["step 1", "step 2", "step 3", "step 4"]
}

Rules:
- severity Critical = production down / data loss / security breach
- severity High = major feature broken, many users affected
- severity Normal = feature partially broken, workaround exists
- severity Low = cosmetic, minor inconvenience
- suggestedAssignee must be one of the team member names if available, otherwise a role
- debuggingSteps should be specific and actionable (4-6 steps)`;

  try {
    const message = await ai.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text.trim();
    // Strip markdown code fences if present
    const jsonStr = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    const result = JSON.parse(jsonStr);

    return {
      severity: result.severity || 'Normal',
      likelyCause: result.likelyCause || '',
      suggestedAssignee: result.suggestedAssignee || '',
      estimatedResolution: result.estimatedResolution || '',
      impactedModules: Array.isArray(result.impactedModules) ? result.impactedModules : [],
      debuggingSteps: Array.isArray(result.debuggingSteps) ? result.debuggingSteps : [],
      triageAt: new Date(),
    };
  } catch (err) {
    console.error('AI triage error:', err.message);
    return getDefaultTriage(issue);
  }
};

const getDefaultTriage = (issue) => ({
  severity: 'Normal',
  likelyCause: 'Requires manual investigation',
  suggestedAssignee: 'Unassigned',
  estimatedResolution: 'Unknown',
  impactedModules: [],
  debuggingSteps: [
    'Reproduce the issue locally',
    'Check recent commits for related changes',
    'Review error logs',
    'Test fix in staging before deploying',
  ],
  triageAt: new Date(),
});

// ─── Feature 3: AI Daily Standup Generator ───────────────────────────────────
const generateStandup = async (data) => {
  const ai = getClient();

  const { resolvedToday, pendingCritical, openIssues, teamStats, date } = data;

  if (!ai) {
    return generateFallbackStandup(data);
  }

  const prompt = `You are an engineering manager generating a daily standup report.

Date: ${date}
Issues resolved today: ${resolvedToday.length}
${resolvedToday.map((i) => `  - #${i.issueId}: ${i.title}`).join('\n')}

Critical/High pending issues: ${pendingCritical.length}
${pendingCritical.map((i) => `  - #${i.issueId}: ${i.title} (${i.priority}) - Assignee: ${i.assignee?.name || 'Unassigned'}`).join('\n')}

Team workload:
${teamStats.map((t) => `  - ${t.name}: ${t.openCount} open issues`).join('\n')}

Total open issues: ${openIssues.length}

Generate a concise, professional daily standup email report in HTML format. Include:
1. Summary section (what was accomplished)
2. Critical items needing attention
3. Team blockers (anyone with >5 open issues is potentially blocked)
4. Module stability insights based on issue titles
5. Recommended focus for tomorrow

Keep it professional, scannable, and under 400 words. Use simple HTML with inline styles (no external CSS). Use a clean table for team workload.`;

  try {
    const message = await ai.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });

    return message.content[0].text;
  } catch (err) {
    console.error('AI standup generation error:', err.message);
    return generateFallbackStandup(data);
  }
};

const generateFallbackStandup = (data) => {
  const { resolvedToday, pendingCritical, openIssues, teamStats, date } = data;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 700px;">
      <h2 style="color: #1e40af;">📋 Daily Standup — ${date}</h2>
      <h3>✅ Resolved Today (${resolvedToday.length})</h3>
      ${resolvedToday.length > 0
        ? `<ul>${resolvedToday.map((i) => `<li>#${i.issueId}: ${i.title}</li>`).join('')}</ul>`
        : '<p>No issues resolved today.</p>'}
      <h3>🔴 Critical/High Pending (${pendingCritical.length})</h3>
      ${pendingCritical.length > 0
        ? `<ul>${pendingCritical.map((i) => `<li>#${i.issueId}: ${i.title} — ${i.assignee?.name || 'Unassigned'}</li>`).join('')}</ul>`
        : '<p>No critical issues pending.</p>'}
      <h3>👥 Team Workload</h3>
      <table border="1" cellpadding="6" style="border-collapse:collapse; width:100%;">
        <tr style="background:#f3f4f6;"><th>Developer</th><th>Open Issues</th></tr>
        ${teamStats.map((t) => `<tr><td>${t.name}</td><td>${t.openCount}</td></tr>`).join('')}
      </table>
      <p style="color:#6b7280; font-size:12px; margin-top:20px;">Total open: ${openIssues.length} issues</p>
    </div>`;
};

// ─── Feature 7: Natural Language Search ──────────────────────────────────────
const parseNaturalLanguageQuery = async (query, issues, users) => {
  const ai = getClient();

  if (!ai) {
    return parseQueryFallback(query);
  }

  const userNames = users.map((u) => u.name).join(', ');

  const prompt = `You are a query parser for a GitHub issue management system.

User query: "${query}"

Available team members: ${userNames}
Available statuses: open, in-progress, closed
Available priorities: urgent, high, normal, low

Parse the user's natural language query and return ONLY a valid JSON filter object:
{
  "status": "open|in-progress|closed|null",
  "priority": "urgent|high|normal|low|null",
  "assigneeName": "exact name from team or null",
  "search": "keyword to search in title/description or null",
  "sortBy": "newest|oldest|priority|null",
  "insight": "one sentence answering the user's question if it's analytical (e.g. 'Developer X has N open issues')"
}

Use null for fields not mentioned. Only set insight if the query is asking for a specific answer.`;

  try {
    const message = await ai.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text.trim();
    const jsonStr = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('NL query parse error:', err.message);
    return parseQueryFallback(query);
  }
};

const parseQueryFallback = (query) => {
  const q = query.toLowerCase();
  const filter = { status: null, priority: null, assigneeName: null, search: null, sortBy: null, insight: null };

  if (q.includes('critical') || q.includes('urgent')) filter.priority = 'urgent';
  else if (q.includes('high')) filter.priority = 'high';
  else if (q.includes('low')) filter.priority = 'low';

  if (q.includes('open')) filter.status = 'open';
  else if (q.includes('closed')) filter.status = 'closed';
  else if (q.includes('progress')) filter.status = 'in-progress';

  if (q.includes('frontend') || q.includes('backend') || q.includes('auth') || q.includes('payment')) {
    const keywords = ['frontend', 'backend', 'auth', 'payment', 'login', 'api', 'database'];
    for (const kw of keywords) {
      if (q.includes(kw)) { filter.search = kw; break; }
    }
  }

  return filter;
};

// ─── Groq Issue Classifier ────────────────────────────────────────────────────
const GROQ_FALLBACK = {
  team: 'fullstack',
  severity: 'moderate',
  severityReason: 'Auto-classified',
  suggestedAction: 'Review manually',
  estimatedComplexity: 'medium',
  aiExplanation: '',
};

const classifyIssueWithGroq = async (title, body) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    console.log('Groq classification skipped: GROQ_API_KEY not configured');
    return GROQ_FALLBACK;
  }

  const systemPrompt =
    "You are a software team issue classifier. Return only valid JSON with:\n" +
    "- team: one of ['frontend', 'backend', 'devops', 'fullstack']\n" +
    "- severity: one of ['critical', 'moderate', 'low']\n" +
    "- severityReason: one sentence explaining why this severity level\n" +
    "- aiExplanation: 2-3 sentences explaining what the problem is and its potential impact\n" +
    "- suggestedAction: one sentence describing the first step to fix this\n" +
    "- estimatedComplexity: one of ['quick-fix', 'medium', 'complex']";

  const userMessage = `Issue Title: ${title}\n\nIssue Body:\n${body || 'No description provided'}`;

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.2,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const text = response.data.choices[0].message.content.trim();
    const jsonStr = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    const result = JSON.parse(jsonStr);

    const validTeams = ['frontend', 'backend', 'devops', 'fullstack'];
    const validSeverities = ['critical', 'moderate', 'low'];
    const validComplexities = ['quick-fix', 'medium', 'complex'];

    return {
      team: validTeams.includes(result.team) ? result.team : GROQ_FALLBACK.team,
      severity: validSeverities.includes(result.severity) ? result.severity : GROQ_FALLBACK.severity,
      severityReason: result.severityReason || GROQ_FALLBACK.severityReason,
      aiExplanation: result.aiExplanation || '',
      suggestedAction: result.suggestedAction || GROQ_FALLBACK.suggestedAction,
      estimatedComplexity: validComplexities.includes(result.estimatedComplexity)
        ? result.estimatedComplexity
        : GROQ_FALLBACK.estimatedComplexity,
    };
  } catch (err) {
    console.error('Groq classification error:', err.response?.data?.error?.message || err.message);
    return GROQ_FALLBACK;
  }
};

// ─── Chat with AI ─────────────────────────────────────────────────────────────
const chatWithAI = async (message, history = [], systemPrompt = '') => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    return { message: 'AI Chat is not configured. Please set the GROQ_API_KEY in your environment.' };
  }

  const defaultSystemPrompt = `You are Gitora AI, a helpful assistant for an engineering issue management platform. 
You help team leads and developers understand their issues, provide insights on issue statuses, 
suggest debugging steps, and answer questions about the team's workload.
Be concise, professional, and helpful.`;

  const messages = [
    { role: 'system', content: systemPrompt || defaultSystemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const reply = response.data.choices[0].message.content.trim();
    return { message: reply };
  } catch (err) {
    console.error('Groq chat error:', err.response?.data?.error?.message || err.message);
    throw new Error(err.response?.data?.error?.message || 'AI chat failed');
  }
};

module.exports = {
  triageIssue,
  generateStandup,
  parseNaturalLanguageQuery,
  classifyIssueWithGroq,
  chatWithAI,
};
