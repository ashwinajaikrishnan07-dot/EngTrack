import json
import requests
from django.conf import settings

GROQ_FALLBACK = {
    'team': 'fullstack',
    'severity': 'moderate',
    'is_urgent': False,
    'severity_reason': 'Auto-classified — needs manual review.',
    'ai_explanation': 'This issue needs manual review to determine its impact and the best solution.',
    'suggested_action': 'Assign to the relevant team member and review the issue details.',
    'estimated_complexity': 'medium',
}

DEFAULT_TRIAGE = {
    'severity': 'Normal',
    'likely_cause': 'Requires manual investigation',
    'suggested_assignee': 'Unassigned',
    'estimated_resolution': 'Unknown',
    'impacted_modules': [],
    'debugging_steps': [
        'Reproduce the issue locally',
        'Check recent commits for related changes',
        'Review error logs',
        'Test fix in staging before deploying',
    ],
}


def classify_issue_with_groq(title, body=''):
    """
    Classify a GitHub issue using Groq llama-3.3-70b-versatile.
    Returns urgency flag, plain-English explanation, and action steps.
    """
    api_key = getattr(settings, 'GROQ_API_KEY', '')
    if not api_key or api_key == 'your_groq_api_key_here':
        print('[Groq] GROQ_API_KEY not configured — using fallback')
        return GROQ_FALLBACK

    system_prompt = (
        "You are a helpful software engineering assistant. Analyze the GitHub issue and return ONLY valid JSON.\n\n"
        "Fields to return:\n"
        "- team: one of ['frontend', 'backend', 'devops', 'fullstack'] — which team should handle this\n"
        "- severity: one of ['critical', 'moderate', 'low']\n"
        "- is_urgent: true if this blocks users or production right now, false otherwise\n"
        "- severity_reason: one short sentence explaining the severity level\n"
        "- ai_explanation: 2-3 plain English sentences explaining what the problem is and why it matters. "
        "Write as if explaining to a junior developer. No jargon. Be specific about what is broken.\n"
        "- suggested_action: one clear, actionable sentence — the very first thing the developer should do\n"
        "- estimated_complexity: one of ['quick-fix', 'medium', 'complex']\n\n"
        "Return ONLY the JSON object. No markdown, no text outside the JSON."
    )
    user_message = f"Issue Title: {title}\n\nIssue Description:\n{body or 'No description provided'}"

    try:
        resp = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json={
                'model': 'llama-3.3-70b-versatile',
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_message},
                ],
                'temperature': 0.2,
                'max_tokens': 400,
            },
            timeout=15,
        )
        resp.raise_for_status()
        text = resp.json()['choices'][0]['message']['content'].strip()

        # Strip markdown fences if present
        if text.startswith('```'):
            parts = text.split('```')
            text = parts[1] if len(parts) > 1 else text
            if text.startswith('json'):
                text = text[4:]
        text = text.strip()

        result = json.loads(text)

        valid_teams        = ['frontend', 'backend', 'devops', 'fullstack']
        valid_severities   = ['critical', 'moderate', 'low']
        valid_complexities = ['quick-fix', 'medium', 'complex']

        severity = result.get('severity', 'moderate')
        if severity not in valid_severities:
            severity = 'moderate'

        is_urgent = result.get('is_urgent', severity == 'critical')
        if isinstance(is_urgent, str):
            is_urgent = is_urgent.lower() == 'true'

        return {
            'team': result.get('team') if result.get('team') in valid_teams else GROQ_FALLBACK['team'],
            'severity': severity,
            'is_urgent': bool(is_urgent),
            'severity_reason': result.get('severity_reason') or GROQ_FALLBACK['severity_reason'],
            'ai_explanation': result.get('ai_explanation') or GROQ_FALLBACK['ai_explanation'],
            'suggested_action': result.get('suggested_action') or GROQ_FALLBACK['suggested_action'],
            'estimated_complexity': (
                result.get('estimated_complexity')
                if result.get('estimated_complexity') in valid_complexities
                else GROQ_FALLBACK['estimated_complexity']
            ),
        }
    except Exception as e:
        print(f'[Groq] Classification error: {e}')
        return GROQ_FALLBACK


def triage_issue_with_claude(issue, team_members=None):
    """Triage issue using Anthropic Claude."""
    api_key = getattr(settings, 'ANTHROPIC_API_KEY', '')
    if not api_key or api_key == 'your_anthropic_api_key':
        return DEFAULT_TRIAGE

    team_list = ', '.join([f"{m['name']} ({m['role']})" for m in (team_members or [])]) or 'No team members yet'
    labels = ', '.join(issue.labels or []) or 'none'

    prompt = f"""You are a senior software engineering lead triaging a GitHub issue.

Issue Title: {issue.title}
Issue Description: {issue.description or 'No description provided'}
Current Labels: {labels}
Team Members: {team_list}

Respond with ONLY a valid JSON object:
{{
  "severity": "Critical|High|Normal|Low",
  "likelyCause": "one sentence root cause",
  "suggestedAssignee": "team member name or role",
  "estimatedResolution": "e.g. 2 hours",
  "impactedModules": ["module1"],
  "debuggingSteps": ["step 1", "step 2", "step 3", "step 4"]
}}"""

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model='claude-3-5-haiku-20241022',
            max_tokens=600,
            messages=[{'role': 'user', 'content': prompt}],
        )
        text = message.content[0].text.strip()
        if text.startswith('```'):
            text = text.split('```')[1]
            if text.startswith('json'):
                text = text[4:]
        return json.loads(text.strip())
    except Exception as e:
        print(f'[Claude] Triage error: {e}')
        return DEFAULT_TRIAGE


def generate_standup_with_claude(data):
    """Generate AI standup report."""
    api_key = getattr(settings, 'ANTHROPIC_API_KEY', '')
    if not api_key or api_key == 'your_anthropic_api_key':
        return _fallback_standup(data)

    resolved    = data.get('resolved_today', [])
    critical    = data.get('pending_critical', [])
    team_stats  = data.get('team_stats', [])
    date        = data.get('date', '')

    prompt = f"""Generate a concise daily standup HTML report.
Date: {date}
Resolved today: {len(resolved)} issues
{chr(10).join(f'  - #{i["issue_id"]}: {i["title"]}' for i in resolved)}
Critical pending: {len(critical)}
{chr(10).join(f'  - #{i["issue_id"]}: {i["title"]}' for i in critical)}
Team: {', '.join(f'{t["name"]}:{t["open_count"]}' for t in team_stats)}
Write professional HTML with inline styles. Under 350 words."""

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model='claude-3-5-haiku-20241022',
            max_tokens=1200,
            messages=[{'role': 'user', 'content': prompt}],
        )
        return message.content[0].text
    except Exception as e:
        print(f'[Claude] Standup error: {e}')
        return _fallback_standup(data)


def _fallback_standup(data):
    resolved    = data.get('resolved_today', [])
    critical    = data.get('pending_critical', [])
    team_stats  = data.get('team_stats', [])
    date        = data.get('date', '')
    rows = ''.join(f'<tr><td>{t["name"]}</td><td>{t["open_count"]}</td></tr>' for t in team_stats)
    return f"""<div style="font-family:Arial,sans-serif">
<h2>Daily Standup — {date}</h2>
<h3>Resolved Today ({len(resolved)})</h3>
{'<ul>' + ''.join(f'<li>#{i["issue_id"]}: {i["title"]}</li>' for i in resolved) + '</ul>' if resolved else '<p>None</p>'}
<h3>Critical Pending ({len(critical)})</h3>
{'<ul>' + ''.join(f'<li>#{i["issue_id"]}: {i["title"]}</li>' for i in critical) + '</ul>' if critical else '<p>None</p>'}
<h3>Team Workload</h3>
<table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">
<tr><th>Developer</th><th>Open Issues</th></tr>{rows}
</table></div>"""
