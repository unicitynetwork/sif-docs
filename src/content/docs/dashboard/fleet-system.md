---
title: Fleet › System
description: Health, build version, uptime, the policy in force, and the statistics reset.
sidebar:
  order: 5
---

Fleet › System (`/fleet/system`) is the engine's own status: is it healthy, what
build is running, how long has it been up, and which policy is in force by default.

It is the system half of the older Settings screen, moved rather than rewritten.
Keys moved to [Fleet › Keys](fleet-keys.md); access control to
[Access › Users](access-users.md).

## This engine

| Row | What it tells you |
|---|---|
| Health | Whether the gateway is answering |
| Version | The build currently running |
| Uptime | How long since the process started |
| Default policy | The policy applied when a key names none |

The health reading comes from the management API, not the guard data plane. A
healthy reading here means the control plane is up; it does not by itself prove the
guard is serving traffic. For that, look at whether requests are arriving on
[Home](home.md) or [Activity › Threats](activity-threats.md).

## Statistics

**Reset all statistics** zeroes the counters the console reports. It does not touch
the audit log — the event record is the durable one, and resetting counters does not
erase what happened.

The control asks for confirmation, and is gated on `stats:manage`. Use it when a
load test or a demo has left counters that no longer describe production.

If you want the numbers *and* the history, do not reset — filter
[Activity › Audit](activity-audit.md) by time instead.

## Capabilities

Reading needs no special capability beyond a session. Resetting statistics needs
`stats:manage`.

See also: [First boot](../operations/first-boot.md),
[Troubleshooting](../operations/troubleshooting.md).
