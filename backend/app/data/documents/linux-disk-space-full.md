---
title: Linux Disk Space Full
category: Platform Engineering
tags: linux, disk, space, df, du, logs, inode, docker, journal
---
# Linux Disk Space Full

Use this runbook for Linux hosts and container nodes with low filesystem capacity.

## Symptoms
- Applications report No space left on device or cannot write temporary files.
- `df -h` shows a filesystem at or near 100% usage.
- File creation fails even though `df -h` appears to show free space.

## Find what is using the space
1. Run `df -h` to identify the full mounted filesystem.
2. Run `du -xh --max-depth=1 /PATH` on the affected filesystem to find large directories.
3. Use approved access and avoid crossing filesystem boundaries during the initial scan.
4. Check recent deployment artifacts, rotated logs, temporary files, and container layers.
5. Record the mount, usage, host, and time before cleanup.

## Inodes exhausted
1. Run `df -i` and compare inode use with the full filesystem.
2. Locate directories with many small files using approved, bounded `find` commands.
3. Check application caches and temporary-file cleanup jobs rather than deleting files blindly.
4. Restore service by removing only known disposable files through the owning team's procedure.

## Deleted files still holding space
1. Run `lsof +L1` with suitable privileges to find deleted files still open by a process.
2. Identify the owning service and confirm whether it can safely reopen or rotate the file.
3. Restart or signal the process only through its service procedure; do not kill unrelated processes.

## Safe cleanups
1. Reduce systemd journal size with `journalctl --vacuum-size=500M` when policy permits.
2. On Debian-based hosts, run `apt clean` to remove downloaded package archives.
3. Developers may run `docker system prune` after checking stopped containers and unused images.
4. Truncate an active log only with the logging owner's procedure; prefer normal log rotation.
5. Set alerts at 80% usage and verify retention or rotation after recovery.

## What not to delete
Never remove database data directories, filesystem metadata, active application state, or unknown files.
Do not delete a log file still held open by a process; disk space may not be released.
Do not prune production container volumes or persistent data without an approved change.

## When to escalate
Page Platform Engineering if a production mount is full or service recovery is at risk.
Attach sanitized `df -h`, `df -i`, top-level `du`, and `lsof +L1` results with host and mount.
