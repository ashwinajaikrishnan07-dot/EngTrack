# Gitora — Navigation & Routing Guide

This document explains how Gitora handles routing, authentication guards, and role-based access from the moment a user opens the app.

---

## 1. App Load — What happens when you visit `/`

Every visit to the root URL hits the **`RootRedirect`** component which checks your auth state:

| Condition | What happens |
|---|---|
| Not logged in | Redirected to `/login` |
| Logged in as `lead` or `tl` | Redirected to `/lead` |
| Logged in as `member` | Redirected to `/member` |

Any unknown URL (`*`) also falls back to `/`, which then applies the same logic above.

---

## 2. Route Map

| Path | Component | Access |
|---|---|---|
| `/login` | `Login` | Public |
| `/register/lead` | `RegisterLead` | Public |
| `/register/member` | `RegisterMember` | Public |
| `/onboarding` | `ConnectRepos` | Logged in (any role) |
| `/lead` | `LeadDashboard` | Lead / TL only |
| `/member` | `MemberDashboard` | Members only |
| `/issues/:id` | `IssueDetail` | Logged in (any role) |
| `/` | `RootRedirect` | Redirects based on role |
| `*` | — | Redirects to `/` |

---

## 3. Route Guards

### `PrivateRoute`
Wraps routes that require any logged-in user.
- Not logged in → `/login`
- Logged in → renders the page

Used on: `/onboarding`, `/issues/:id`

### `LeadRoute`
Wraps routes that only Team Leads can access.
- Not logged in → `/login`
- Wrong role (member) → `/member`
- Lead but **no repos connected yet** → `/onboarding` (forced to connect GitHub repos first)
- Lead with repos → renders the page

Used on: `/lead`

### `MemberRoute`
Wraps routes that only Members can access.
- Not logged in → `/login`
- Wrong role (lead/tl) → `/lead`
- Valid member → renders the page

Used on: `/member`

---

## 4. Onboarding Flow

After a **Team Lead** registers, they must connect at least one GitHub repository before accessing their dashboard:

1. Lead registers at `/register/lead` → redirected to `/onboarding`
2. `/onboarding` renders `ConnectRepos` where they connect their GitHub repos
3. Once repos are connected, `LeadRoute` lets them through to `/lead`

> If a lead tries to access `/lead` without repos connected, `LeadRoute` automatically bounces them back to `/onboarding`.

**Members** register at `/register/member` and go straight to `/member` — no onboarding step required.

---

## 5. Loading State

All three route guards (`PrivateRoute`, `LeadRoute`, `MemberRoute`) and `RootRedirect` show a **loading spinner** while the auth context is resolving. This prevents a flash of the wrong page before the user's session is confirmed.

---

## 6. Summary

```
Open app /
  └── RootRedirect
        ├── Not logged in → /login
        │     ├── Register as Lead → /register/lead → /onboarding → /lead
        │     └── Register as Member → /register/member → /member
        └── Logged in
              ├── Lead / TL → /lead (needs repos connected)
              │     └── No repos → /onboarding first
              └── Member → /member
```
