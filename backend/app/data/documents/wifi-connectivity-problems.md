---
title: Wi-Fi Connectivity Problems
category: Network
tags: wifi, wireless, eduroam, corp-wifi, 802.1x, certificate, network
---
# Wi-Fi Connectivity Problems

Use this runbook for corporate and guest wireless access.

## Symptoms
- CORP-WIFI rejects the managed laptop or repeatedly requests credentials.
- Wi-Fi is connected but pages do not load or the connection is unstable.
- The device receives an address beginning with 169.254.

## Quick checks
1. Check whether a nearby managed device can connect to the same network.
2. Confirm the selected network is CORP-WIFI for managed devices or GUEST-WIFI for visitors.
3. A `169.254.` address means DHCP did not assign a usable address.
4. Forget only the affected corporate network profile; do not change domain proxy settings.

## Fix: "Can't connect to this network" on CORP-WIFI
1. Confirm the device certificate named Corp Device CA is present in Local Computer certificates.
2. Run `certlm.msc`, then inspect Personal > Certificates for a valid device certificate.
3. Connect by wired network or VPN and run `gpupdate /force` to refresh policy and certificates.
4. Restart Windows and select CORP-WIFI; 802.1X authenticates the managed device certificate.
5. Do not use a personal username/password prompt to bypass certificate enrollment.

## Fix: connected but no internet
1. Disconnect and reconnect once, then run `ipconfig /renew` in Command Prompt.
2. Check that the assigned address is not in the `169.254.` link-local range.
3. Run `ipconfig /flushdns` and test a known public site and an internal site separately.
4. If only DNS fails, record `nslookup` output and the configured DNS server.

## Fix: slow or unstable Wi-Fi
1. Move closer to an approved access point and compare on another floor.
2. Disable Wi-Fi adapter power saving during troubleshooting.
3. Install managed wireless adapter updates and restart the laptop.
4. If TCP connections fail broadly, authorized support may ask you to run `netsh winsock reset`, then restart.
5. Do not install third-party wireless drivers or connect corporate devices to an untrusted hotspot.

## When to escalate
Open a Network Support ticket with network name, location, device asset tag, and timestamps.
Include IP configuration with hostnames and MAC addresses removed where policy requires.
Mention whether the device certificate is present and whether other devices are affected.
