---
title: Password Reset and Account Lockout
category: Identity & Access
tags: password, lockout, mfa, active directory, sso, login
---
# Password Reset and Account Lockout

Use this runbook for corporate directory, SSO, and MFA sign-in problems.

## Symptoms
- Sign-in reports an incorrect password even when the current password is known.
- The account is locked after repeated failed attempts.
- MFA prompts do not arrive or a service keeps prompting after a reset.

## Password policy
- Passwords must contain at least 14 characters.
- Passwords expire every 90 days and the previous 12 passwords cannot be reused.
- Five failed attempts within 15 minutes lock the account for 30 minutes.
- Help desk staff will never ask for your current password or an MFA code.

## Reset your password (self-service)
1. Open `https://password.corp.example.com` from a trusted network.
2. Choose Reset password and complete the registered MFA verification.
3. Create a unique password of at least 14 characters that is not among the last 12.
4. Wait two minutes for directory synchronization, then sign in to one service.
5. Update saved credentials on other devices only after the first sign-in succeeds.

## Unlock a locked account
1. Stop sign-in attempts and wait 30 minutes for the automatic lockout to expire.
2. If work is blocked, contact the Service Desk with your username and the time of the last attempt.
3. After unlock, enter the password once in the corporate sign-in page and complete MFA.
4. If the account locks again, look for a saved old password before retrying.

## Repeated lockouts: find the stale password
1. Update the password stored in the mail app on each phone and tablet.
2. Open Windows Credential Manager and remove obsolete corporate entries.
3. Update mapped drive, VPN, remote desktop, scheduled task, and service credentials you own.
4. Sign out of old browser profiles and remove stale SSO sessions.
5. Change one saved location at a time so the source of new failures is identifiable.

## MFA problems
1. Confirm the phone has network coverage and automatic date and time enabled.
2. Check that the prompt is for the expected corporate sign-in before approving it.
3. Use the registered alternate verification method if the primary device is unavailable.
4. Never approve a prompt you did not initiate; report unexpected prompts immediately.

## When to escalate
Contact Identity Support if self-service fails, the account relocks, or MFA enrollment is lost.
Provide username, service name, approximate time, and the displayed error or correlation ID.
Do not send passwords, recovery codes, MFA numbers, or screenshots containing personal data.
