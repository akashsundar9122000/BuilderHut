---
title: The API, in outline
summary: What the REST API covers, what it deliberately does not, and how a request is authorised.
who: Integrators
icon: plug
---

The BuilderHut API gives a program the same view of one shop that its owner has in the
dashboard: its products, its orders, its customers, its settings and the document its pages are
built from.

Every request is authorised by a **personal access token**, which stands in for one person in
one shop. There are no service accounts: nothing may act with an authority no person holds.

:::endpoint GET /api/v1/me
The call to make first. It answers with the user the token belongs to, the shop it is bound to,
that person's role, and the scopes the token carries — which is everything you need to work out
why a later call was refused.
:::

## The shape of every response

JSON, always. A list is an object with `data`, `nextCursor` and `hasMore`; a single resource is
the object itself; a failure is an object with one `error` key.

```json
{
  "error": {
    "code": "INSUFFICIENT_SCOPE",
    "message": "products_create needs the products:write scope; this token has products:read.",
    "requestId": "01936f2c-…"
  }
}
```

:::warning A resource in another shop is 404, not 403
Absence and non-ownership are deliberately indistinguishable. Every query is scoped to the
token's shop before it reaches the database, and the database refuses it a second time, so a
resource belonging to somebody else does not exist as far as your token is concerned. A 403
would confirm that the id you guessed is real somewhere.
:::

## What a token can be allowed to do

Scopes are named for a capability rather than a table — `products:read`, `orders:write`,
`site:publish` — and you pick them when you mint the token. Three checks run on every request,
cheapest first, and **the narrowest wins**:

| Check | Comes from | Refusal |
|---|---|---|
| Scope | the token | `403 INSUFFICIENT_SCOPE` |
| Role | your membership of the shop, read live | `403 FORBIDDEN` |
| Plan | the shop's current plan | `402 PLAN_LIMIT` |

Reading the role live matters: if the shop's owner changes your role, your token's authority
changes with it on the very next call. There is no separate step to remember.

## What the API does not do

:::danger
Some things are absent on purpose, and no scope grants them.
:::

- **A token cannot mint or revoke a token.** One that could is one you could not safely put in
  a config file that syncs between machines.
- **A token cannot change the shop's plan**, add or remove staff, or repoint a domain. Those
  are account administration, and they stay in the browser where a person is present.
- **A token cannot take a payment.** The basket and the checkout belong to the shopper's own
  session.

:::tip
If you are connecting an assistant rather than writing a client, you probably want the MCP
server instead — it exposes these same operations as tools, with the same scopes, and you do
not have to write any HTTP at all.
:::
