---
title: Slow Laptop Performance
category: Workplace
tags: laptop, slow, performance, cpu, memory, disk, startup, windows
---
# Slow Laptop Performance

This runbook helps identify common causes on managed Windows laptops.

## Symptoms
- Applications take a long time to launch or freeze during normal work.
- Boot and sign-in are unusually slow or the fan runs continuously.
- Low-storage warnings appear or the device becomes slow after waking.

## Quick checks
1. Save work and restart; Fast Startup may preserve a problematic driver state across shutdown.
2. Check whether a managed update, backup, or antivirus scan is still running.
3. Confirm at least 10% of the system disk is free.
4. Note whether the slowness affects one app, one network, or the whole device.

## Identify the culprit
1. Open Task Manager with Ctrl+Shift+Esc and sort Processes by CPU, Memory, then Disk.
2. Wait two minutes before concluding a brief startup spike is persistent.
3. Record the application name and approximate usage; do not force-stop security processes.
4. Check Startup apps and disable only software you recognize and do not need at sign-in.

## Fix: high memory usage
1. Save work, close unused browser tabs, and exit applications with unusually high memory use.
2. Restart the application and install its managed update if usage rises continuously.
3. If using local WSL workloads, set a reasonable limit such as `memory=4GB` in `.wslconfig`.
4. Stop unused local containers before starting another workload.

## Fix: disk full
1. Open Storage settings and identify large personal files before removing anything.
2. Empty the Recycle Bin and clear approved temporary files.
3. Developers may run `docker system prune` after reviewing which stopped images and caches it removes.
4. Keep at least 10% free; do not delete managed recovery or security folders.

## Fix: slow boot and login
1. Restart instead of repeatedly selecting Shut down when Fast Startup is enabled.
2. Review Startup apps and remove unneeded user-installed launchers.
3. Let pending managed updates finish while connected to power and the corporate network.
4. Disconnect unused USB devices and compare a clean restart.

## When to escalate
Contact Workplace Support if the device remains slow after restart and storage cleanup.
Attach the device asset tag, Windows build, Task Manager observations, and time of occurrence.
Managed laptops are normally considered for replacement after four years, subject to diagnostics.
