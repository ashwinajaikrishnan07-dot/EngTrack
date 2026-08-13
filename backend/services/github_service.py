import requests
from django.conf import settings


def _headers(token=None):
    t = token or settings.GITHUB_TOKEN
    headers = {'Accept': 'application/vnd.github.v3+json'}
    if t:  # only add Authorization if token exists
        headers['Authorization'] = f'token {t}'
    return headers


def _base(owner_repo):
    return f'https://api.github.com/repos/{owner_repo}'


def get_priority_from_labels(labels):
    names = [l.get('name', '').lower() if isinstance(l, dict) else str(l).lower() for l in labels]
    if any('urgent' in n or 'critical' in n for n in names):
        return 'urgent'
    if any('high' in n for n in names):
        return 'high'
    if any('low' in n for n in names):
        return 'low'
    return 'normal'


def fetch_github_issues(owner_repo, state='all'):
    issues, page = [], 1
    while True:
        resp = requests.get(f'{_base(owner_repo)}/issues', headers=_headers(),
                            params={'state': state, 'per_page': 100, 'page': page})
        resp.raise_for_status()
        data = resp.json()
        if not data:
            break
        issues.extend([i for i in data if 'pull_request' not in i])
        if len(data) < 100:
            break
        page += 1
    return issues


def create_github_issue(owner_repo, title, body, labels=None, token=None):
    resp = requests.post(f'{_base(owner_repo)}/issues', headers=_headers(token),
                         json={'title': title, 'body': body or '', 'labels': labels or []})
    resp.raise_for_status()
    return resp.json()


def close_github_issue(owner_repo, issue_number, token=None):
    resp = requests.patch(f'{_base(owner_repo)}/issues/{issue_number}', headers=_headers(token),
                          json={'state': 'closed'})
    resp.raise_for_status()
    return resp.json()


def reopen_github_issue(owner_repo, issue_number, token=None):
    resp = requests.patch(f'{_base(owner_repo)}/issues/{issue_number}', headers=_headers(token),
                          json={'state': 'open'})
    resp.raise_for_status()
    return resp.json()


def add_github_comment(owner_repo, issue_number, body, token=None):
    resp = requests.post(f'{_base(owner_repo)}/issues/{issue_number}/comments',
                         headers=_headers(token), json={'body': body})
    resp.raise_for_status()
    return resp.json()