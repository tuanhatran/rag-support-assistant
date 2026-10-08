---
title: Printer Not Responding
category: Workplace
tags: printer, printing, print queue, spooler, follow-me printing, badge
---
# Printer Not Responding

Use this guide for the managed Follow-Me-Secure printing service.

## Symptoms
- The printer queue is missing, offline, or does not release a job.
- A job remains in the queue or prints blank or garbled pages.
- The printer asks for a badge that has not been enrolled.

## Quick checks
1. Verify that the computer is on CORP-WIFI or the corporate wired network.
2. Print a small test page and check the printer display for paper or toner errors.
3. Confirm the selected queue is `FollowMe-Secure` rather than a nearby device queue.
4. Follow-Me jobs are retained for 24 hours and then removed automatically.

## Fix: queue missing or offline
1. Sign out and back in to refresh managed printer assignments.
2. Open Settings, Printers & scanners, and confirm `FollowMe-Secure` is installed.
3. Remove and re-add only the managed Follow-Me queue if it remains offline.
4. Check that the device can reach the corporate network; do not install a public driver.

## Fix: jobs stuck in the queue
1. Cancel your own pending job from the queue and wait for its status to clear.
2. Restart the computer and submit a one-page test document.
3. If authorized IT staff confirm the local spooler is stuck, run `net stop spooler` followed by `net start spooler` in an elevated prompt.
4. Do not clear shared print-server queues; other users' jobs may be affected.

## Fix: wrong output (blank pages, garbled text)
1. Download the document locally and print a fresh PDF copy.
2. In the PDF print dialog, enable Print as image for a garbled complex page.
3. Print one page first and verify orientation, color, and paper size.
4. If only one application fails, update that application before changing printer settings.

## Paper jams and hardware errors
1. Read the printer display and follow the marked access-panel instructions.
2. Remove paper gently in the feed direction; do not use tools inside the printer.
3. Stop if paper tears or the panel does not open normally and report the device asset label.
4. For badge release, enroll the badge through the approved workplace portal first.

## When to escalate
Contact Workplace Support with the queue name, printer asset label, error code, and job time.
Mention whether a test page and another managed computer work.
Do not include printed confidential pages or another employee's job details.
