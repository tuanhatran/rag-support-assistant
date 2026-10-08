---
title: Outlook Email Not Syncing
category: Collaboration
tags: outlook, email, exchange, ost, mailbox, calendar
---
# Outlook Email Not Syncing

This runbook covers managed Outlook desktop and calendar synchronization.

## Symptoms
- Outlook remains Disconnected or Working Offline.
- New email appears in webmail but not in the desktop inbox.
- Messages remain in the Outbox or calendar updates are delayed.

## Quick checks
1. Open corporate webmail and confirm whether the message exists on the server.
2. Check the Outlook status bar and make sure Work Offline is not selected.
3. Confirm the laptop is online and the mailbox has not reached its quota.
4. Check whether a Microsoft 365 service notice reports an outage.

## Fix: Outlook stays disconnected
1. In Send/Receive, toggle Work Offline off and wait one minute.
2. Close Outlook, verify connectivity, then reopen Outlook normally.
3. Run `outlook.exe /safe` to check whether an add-in prevents connection.
4. Disable only recently added add-ins, restart Outlook, and retest synchronization.
5. Recreate the Outlook profile only after verifying the account works in webmail.

## Fix: corrupted offline cache (OST)
1. Quit Outlook and confirm OUTLOOK.EXE has exited in Task Manager.
2. Locate the `.ost` file under the Outlook profile and rename it with Outlook closed.
3. Restart Outlook and allow a full mailbox synchronization to finish.
4. Never delete a `.pst` file; it may contain the only copy of locally archived mail.
5. If synchronization is incomplete, keep the renamed cache until support confirms recovery.

## Fix: emails stuck in the Outbox
1. Open the Outbox and inspect the message for a large attachment or invalid recipient.
2. Messages larger than the 25 MB attachment limit must use the approved file-sharing service.
3. Move the message to Drafts, reduce the attachment, and send a small test message.
4. Verify webmail delivery before sending the original again to avoid duplicates.

## Calendar issues
1. Compare the event in webmail and desktop Outlook; note which copy is current.
2. Check the calendar's selected time zone and confirm the laptop clock is correct.
3. Send/Receive all folders once and wait for the status to return to Connected.
4. For shared calendars, confirm access still exists with the calendar owner.

## When to escalate
Open a Collaboration Support ticket if webmail and Outlook continue to disagree.
Include Outlook version, connection status, affected folder, message time, and sanitized error text.
Do not attach mailbox exports, `.pst` files, or message content unless support provides an approved method.
