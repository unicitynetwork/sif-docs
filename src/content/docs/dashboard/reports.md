---
title: Reports
description: Not yet designed — the audit log does this work today.
sidebar:
  order: 16
---

Reports (`/reports`) is a section that exists in the navigation and has no screen
behind it yet. It has not been designed.

The screen says so. It does not present an empty chart or a placeholder that
implies something is coming next week.

## What does the job today

Everything Reports would carry is on [Activity › Audit](activity-audit.md):

- the full event record, filterable by time, action, key, agent class, policy and
  user
- **Export JSON** and **Export CSV** for whatever the filters currently select
- **Export evidence…** for an auditor or an incident record

A filtered audit view is a URL, so a report you produce regularly can be a
bookmark:

```
/activity/audit?action=block&start_date=…
```

Scheduled and recurring reporting does not exist yet. If you need one on a
cadence, drive it from the management API rather than waiting on this screen — see
[Management endpoints](../api/management-endpoints.md).
