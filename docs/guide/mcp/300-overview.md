---
title: The MCP server
summary: What connecting an assistant to a shop means, what it can and cannot do, and how to decide before you do it.
who: Integrators
icon: bot
related: overview
---

:::danger Read this before you connect anything
An MCP token lets an assistant act **as you, in one shop**. It can read your catalogue, your
orders and your customers, and — if you grant write scopes — change them.

Give it the narrowest scopes that do the job, give it an expiry, and revoke it when the work is
done. A token in a config file that syncs between machines is a token on every machine you have
ever signed into.
:::

The MCP server exposes the [REST API](/guide/api/overview) as tools an assistant can call. It
is the same API, with the same scopes, the same role checks and the same rate limits — the
server holds no authority of its own, and every call it makes is an ordinary authenticated
request.

That is deliberate. A tool that reached into the database directly would need every one of
those checks reimplemented, and the first mistake in the copy would be a hole in the wall
between two shops.

## What it will not do

- **Mint or revoke tokens.** Not exposed, at any scope. A token that can make tokens is one you
  cannot safely put anywhere.
- **Change your plan, your staff or your domains.** Account administration stays somewhere a
  person is present.
- **Take a payment.**
- **Run a query you wrote.** There is no escape hatch tool, and there should never be one.

## Scopes are enforced, not just filtered

An assistant is offered the tools its token can use. It is also **refused** any other tool by
name — because a client can ask for any name it can name, including one it saw yesterday under
a wider token.

The refusal says which scope was missing rather than "no such tool", so the answer is "mint a
better token" instead of half an hour hunting for a typo.

:::note
Deleting a product through the API archives it rather than destroying it, which is why it is
allowed to be a tool at all. Nothing that cannot be recovered is exposed as one.
:::
