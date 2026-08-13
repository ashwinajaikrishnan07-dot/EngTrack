const axios = require('axios');

const getGithubClient = () => {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!token || !owner || !repo) {
    throw new Error('GitHub credentials not configured');
  }

  const client = axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  return { client, owner, repo };
};

// Map GitHub labels to priority
const getPriorityFromLabels = (labels) => {
  const labelNames = labels.map((l) => l.name.toLowerCase());
  if (labelNames.some((l) => l.includes('urgent') || l.includes('critical'))) return 'urgent';
  if (labelNames.some((l) => l.includes('high'))) return 'high';
  if (labelNames.some((l) => l.includes('low'))) return 'low';
  return 'normal';
};

// Fetch all issues from GitHub (uses env config)
const fetchGithubIssues = async (state = 'all') => {
  const { client, owner, repo } = getGithubClient();
  return _fetchIssues(client, owner, repo, state);
};

// Fetch all issues from a specific repo (owner/repo passed explicitly)
const fetchGithubIssuesForRepo = async (owner, repo, state = 'all') => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not configured');
  const client = axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  return _fetchIssues(client, owner, repo, state);
};

async function _fetchIssues(client, owner, repo, state) {
  const issues = [];
  let page = 1;
  while (true) {
    const { data } = await client.get(`/repos/${owner}/${repo}/issues`, {
      params: { state, per_page: 100, page },
    });
    if (data.length === 0) break;
    const filtered = data.filter((i) => !i.pull_request);
    issues.push(...filtered);
    if (data.length < 100) break;
    page++;
  }
  return issues;
}

// Create a new issue on GitHub
const createGithubIssue = async (title, body, labels = []) => {
  const { client, owner, repo } = getGithubClient();
  const { data } = await client.post(`/repos/${owner}/${repo}/issues`, {
    title,
    body,
    labels,
  });
  return data;
};

// Close an issue on GitHub
const closeGithubIssue = async (issueNumber) => {
  const { client, owner, repo } = getGithubClient();
  const { data } = await client.patch(
    `/repos/${owner}/${repo}/issues/${issueNumber}`,
    { state: 'closed' }
  );
  return data;
};

// Reopen an issue on GitHub
const reopenGithubIssue = async (issueNumber) => {
  const { client, owner, repo } = getGithubClient();
  const { data } = await client.patch(
    `/repos/${owner}/${repo}/issues/${issueNumber}`,
    { state: 'open' }
  );
  return data;
};

// Add a comment to a GitHub issue
const addGithubComment = async (issueNumber, body) => {
  const { client, owner, repo } = getGithubClient();
  const { data } = await client.post(
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    { body }
  );
  return data;
};

// Register a webhook on GitHub
const registerWebhook = async (webhookUrl) => {
  const { client, owner, repo } = getGithubClient();
  const { data } = await client.post(`/repos/${owner}/${repo}/hooks`, {
    name: 'web',
    active: true,
    events: ['issues', 'issue_comment'],
    config: {
      url: webhookUrl,
      content_type: 'json',
      secret: process.env.GITHUB_WEBHOOK_SECRET,
    },
  });
  return data;
};

module.exports = {
  fetchGithubIssues,
  fetchGithubIssuesForRepo,
  createGithubIssue,
  closeGithubIssue,
  reopenGithubIssue,
  addGithubComment,
  registerWebhook,
  getPriorityFromLabels,
};
