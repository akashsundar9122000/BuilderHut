---
title: Errors
summary: The envelope every failure uses, what each code means, and why a resource in another shop is a 404.
who: Integrators
icon: triangle-alert
---

Every failure is one object with one `error` key.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "priceMinor must be a positive integer.",
    "requestId": "01936f2c-8f4a-7c31-9a55-1d2e3f4a5b6c",
    "fields": { "priceMinor": ["must be a positive integer"] }
  }
}
```

`fields` is present only for validation failures. `requestId` is always present and is echoed in
the `X-Request-Id` header — quote it when asking about a specific failure.

## The codes

| Code | Status | Means |
|---|---|---|
| `VALIDATION_ERROR` | 400 | The request did not match the schema |
| `UNAUTHENTICATED` | 401 | No token, or one that is unknown, expired or revoked |
| `INSUFFICIENT_SCOPE` | 403 | The token lacks the scope this operation needs |
| `FORBIDDEN` | 403 | The scope was there; the person's role was not |
| `PLAN_LIMIT` | 402 | The shop's plan does not include this |
| `NOT_FOUND` | 404 | No such resource — see below |
| `CONFLICT` | 409 | Optimistic concurrency: somebody else changed it first |
| `RATE_LIMITED` | 429 | Too many requests; see `Retry-After` |
| `INTERNAL_ERROR` | 500 | Our fault. `requestId` is how we find it |

## Unknown, expired and revoked are the same answer

All three are `UNAUTHENTICATED` with the same message. Distinguishing them would tell somebody
holding a string whether it was ever a real token, which is information they should not get.

## A resource in another shop is 404, not 403

:::note
This is not obfuscation, it is how the query works. Every read is scoped to the token's shop
before it reaches the database, and the database refuses it again underneath — so a product
belonging to somebody else does not exist as far as your token is concerned. There is no code
path that could return 403 here.

A 403 would confirm that an id you guessed is real somewhere, which is exactly the thing worth
not confirming.
:::

## Errors never leak internals

`INTERNAL_ERROR` carries no detail in production. A database error string names columns and
occasionally contains data; `requestId` is what connects your failure to our log without
handing you either.

## Retrying

`429` and `500` are worth retrying with backoff. `4xx` other than `429` will fail the same way
every time — retrying a `VALIDATION_ERROR` is a loop.

:::tip
Use `Idempotency-Key` on anything that moves money. A refund that timed out may or may not have
happened; replaying it with the same key returns the first result instead of refunding twice.
:::
