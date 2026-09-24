---
title: Authentication
summary: Personal access tokens — what they stand for, how to scope them, and why the role is read live.
who: Integrators
icon: key
related: overview
---

Every request carries a personal access token as a bearer credential.

```http
GET /api/v1/products HTTP/1.1
Authorization: Bearer bh_pat_…
```

There is no cookie path and no session path. A browser session with no `Authorization` header
gets `401`, even when the session is valid — this API accepts the token and only the token,
which is what removes CSRF from the picture entirely.

## What a token is

A scoped stand-in for **one person, in one shop**.

There are no service accounts. Nothing may act with an authority no person holds, which means
every action a token takes is attributable to somebody who could have taken it themselves.

## The role is read live

This is the part worth understanding, because it is what makes revocation instant.

The token row records which shop and which user. It does **not** record the role. On every
request, the user's membership of that shop is looked up fresh — so if the owner demotes
somebody or removes them, their token loses that authority on the very next call. There is no
second thing to remember to revoke.

The same applies to the shop itself: a token for a suspended shop resolves to nothing.

:::warning
A token is a password that skips the login screen. Treat it as one.

Give it the narrowest scopes that do the job. Give it an expiry — the form offers 30, 90 or 365
days and does not offer "never", because a credential that outlives the laptop it was made on
outlives the person who would have revoked it. And keep it out of anything that syncs between
machines unless you meant it to be on all of them.
:::

## Scopes

Named for a capability rather than a table: `products:read`, `orders:write`, `site:publish`.

`site:publish` is separate from `site:write` on purpose. Editing a draft and making it public
are different levels of trust, and plenty of integrations want the first without the second.

## Three checks, narrowest wins

| Order | Check | Refusal |
|---|---|---|
| 1 | Scope, from the token | `403 INSUFFICIENT_SCOPE` |
| 2 | Role, read live from membership | `403 FORBIDDEN` |
| 3 | Plan entitlement | `402 PLAN_LIMIT` |

There is no override. A staff-role token carrying `products:write` is still refused, because a
staff member cannot change prices — a token is never wider than the person it belongs to.

## Losing one

Revoke it. The list shows each token's prefix, when it was last used, and when it expires;
revoking takes effect immediately.

:::note
A token cannot mint or revoke another token, at any scope. That is why token management lives
only in the browser — a token that could make tokens would be one you could never safely put in
a config file.
:::
