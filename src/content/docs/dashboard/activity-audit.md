---
title: Activity › Audit
description: The full event record — filterable, linkable, and exportable as evidence.
sidebar:
  order: 13
---

Activity › Audit (`/activity/audit`) is the complete record: every decision the
guard made, every configuration change, and every control-plane event including
refusals.

This is the compliance surface. If a question starts "can you show me…", it is
answered here.

## Three kinds of event

The Event Type filter groups them:

| Group | What it covers |
|---|---|
| **Data plane** | Guard decisions — every request, including the ones that were allowed |
| **Configuration** | Changes to policies, rules, keys |
| **Control plane (RBAC)** | Sign-ins, role changes, and refusals (`authz.denied`) |

A refused action is a recorded event. Someone attempting something they lack the
capability for leaves a trail, which is usually the point.

## Filters

| Filter | Notes |
|---|---|
| Action | `allow`, `flag`, `modify`, `block` |
| Start / End | Time bounds |
| Degraded only | Requests served while the engine was degraded |
| API Key | A specific key |
| App ID | Free text the operator set on the key |
| **Agent class** | The class the key was bound to — *not* the same as App ID |
| Policy | Which policy decided |
| User ID / Session ID | Who, and which session |

**App ID and Agent class are different attributes.** App ID is free text set per
key; agent class is the class the key was assigned on
[Fleet › Agents](fleet-agents.md). Filtering by class answers "what has this kind of
agent been doing?" across every key it ever held.

Active filters appear as chips. Every filter is in the URL, so a filtered view is
shareable:

```
/activity/audit?agent_class=payments-bot&action=block
```

Links from elsewhere in the console — the per-class lens on Fleet › Agents, the
per-user trail on Access › Users — land here with the filters already set.

## An entry is a URL

As with Threats, selecting a row puts `?id=` in the address bar.

## Exports

| Export | What you get |
|---|---|
| **Export JSON** | The current page of entries, structured |
| **Export CSV** | The same, flattened — detections become a count |
| **Export evidence…** | A package for an auditor or an incident record |

JSON and CSV export **what is on screen**, filters included. Use CSV for a
spreadsheet; use JSON when you need the nested detection data.

## Retention

Captured payloads are kept for a bounded window, shorter than the event records
themselves. The events persist; the payloads age out. Export evidence while the
payload is still there if you will need it later.

## Capabilities

Reading needs `audit:read`; payloads need `payload:read`. Without them the screen
names the capability rather than showing an empty trail.

See also: [Access control](../operations/access-control.md),
[Monitor production traffic](../guides/monitor-production-traffic.md),
[Backups and restore](../operations/backups-and-restore.md).
