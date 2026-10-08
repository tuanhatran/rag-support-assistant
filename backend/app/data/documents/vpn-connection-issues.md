---
title: VPN Connection Issues
category: Network
tags: vpn, globalprotect, remote access, tunnel, authentication
---
# VPN Connection Issues

Use this runbook for the GlobalProtect client on managed laptops.

## Symptoms
- GlobalProtect remains on Connecting or repeatedly asks to sign in.
- The client says Connected, but internal sites do not open.
- A VPN tunnel drops when the laptop sleeps or changes networks.

## Quick checks
1. Confirm the laptop has ordinary internet access before opening the tunnel.
2. Verify the portal is `vpn.corp.example.com` and the signed-in account is your corporate account.
3. Check the operating-system clock and time zone; drift greater than five minutes can break certificates.
4. Record the exact client error and connection time before changing settings.

## Fix: stuck on "Connecting"
1. Disconnect, quit GlobalProtect from the tray, then reopen it.
2. Select the portal field and enter `vpn.corp.example.com` exactly.
3. Restart the laptop if the client still shows an old tunnel state.
4. Confirm outbound UDP 4501 and TCP 443 are allowed on the current network.
5. If UDP is blocked, the client should fall back to TCP 443; captive Wi-Fi portals must be completed first.

## Fix: authentication failures
1. Check that the system clock is synchronized; certificate validation fails with more than five minutes of drift.
2. Complete the corporate SSO and MFA prompt in the browser window opened by GlobalProtect.
3. Remove a stale saved corporate password from Credential Manager, then reconnect.
4. Do not repeatedly retry a rejected password; use the password reset runbook if the account may be locked.

## Fix: connected but internal sites do not load
1. Confirm the PANGP virtual adapter is present and enabled in Network Connections.
2. Run `ipconfig /flushdns` in an elevated Command Prompt, then retry the internal hostname.
3. Run `nslookup intranet.corp.example.com` and note the DNS server and response.
4. Disconnect other VPN clients and disable any manually configured proxy for a comparison test.

## Frequent disconnections
1. Install pending managed GlobalProtect and operating-system updates.
2. Disable Wi-Fi power saving for the active adapter while troubleshooting.
3. Compare behavior on wired Ethernet or another trusted network.
4. Keep the laptop awake during a long transfer and test whether sleep causes the drop.
5. Reconnect once after changing networks; do not repeatedly toggle the adapter.

## When to escalate
Open a Network Support ticket if the tunnel still fails after these checks or several users are affected.
Attach the GlobalProtect version, operating system, timestamp and time zone, portal name, and exact error text.
Include sanitized `nslookup` output and whether UDP 4501 or TCP 443 was reachable.
Never attach passwords, MFA codes, private keys, or an unredacted packet capture.
