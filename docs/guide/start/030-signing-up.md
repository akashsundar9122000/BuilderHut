---
title: Making an account
summary: An email address, a password, and a six-digit code — and what to do when the code does not arrive.
who: Everyone
icon: user-plus
related: what-you-need
---

![The sign-up form: name, email address and password, with the BuilderHut wordmark and a miniature shopfront beside it.](shot:signup "Nothing here is a trial. There is no card to enter and nothing expires.")

An email address and a password of at least ten characters. No card, and no sales call.

:::steps
### Enter your details

Your name is what appears on your own account, not on the shop — the shop gets its own name in
a moment.

### Read the code we send you

Six digits, to an inbox you can actually reach. It is good for ten minutes.

### Type it in

And you are through to the setup questions.
:::

## Why the code

An address nobody can reach is an account nobody can recover. If you lose the password to a
shop with orders in it and the address on file is a typo, there is no way back in — so the
address gets checked before there is anything to lose.

![The verification screen, showing six single-character boxes and the masked email address the code was sent to.](shot:verify-code "The address is masked rather than shown in full, so a screenshot of this screen gives nothing away.")

:::warning When the code does not arrive
Check the spam folder first — it is where most of them are. If it is genuinely not there, ask
for another; there is a short wait between sends, which is there to stop the form being used to
send mail to somebody else.

If the address itself is wrong, go back and sign up again with the right one. The half-made
account does not get in the way.
:::

## Choosing a password

Ten characters minimum, and that is the only rule. No required symbol, no forced capital — those
rules reliably produce `Password1!` and nothing safer.

Three or four unrelated words are both easier to remember and harder to guess than a short
password with punctuation in it. If you use a password manager, let it do what it wants.

:::note
Passwords are stored hashed with Argon2, which means nobody here can read yours, including us.
The consequence: if you forget it, it is reset, never looked up.
:::

## Signing in afterwards

The same email address and password, at [the sign-in page](/login). If you have forgotten the
password, ask for a reset link — it arrives by email and lasts an hour.

:::faq
### Can I use a Google or GitHub account instead?

If those are configured for this deployment, the buttons appear on the sign-up page. If they
are not, they are not shown at all rather than shown and broken.

### Can two people share one login?

They can, but they should not. Invite the other person instead — they get their own account,
their own password, and you can see who did what.

### Can I change the email address later?

Yes, from settings. The new address gets its own six-digit code, for the same reason the first
one did.
:::
