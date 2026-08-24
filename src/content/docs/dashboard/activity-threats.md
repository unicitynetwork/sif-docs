---
title: Activity › Threats
description: The detections the guard acted on, and the payload behind each one.
sidebar:
  order: 12
---

Activity › Threats (`/activity/threats`) is the detection feed: what the guard
caught, what it did about it, and what was in the request.

It leads with a sentence saying how many requests were acted on in the last 24
hours and how that splits — blocked, flagged, modified, and how many passed
straight through.

## The table

One row per detection event: when, which policy, the action taken, the risk score,
and the categories that fired.

Filter chips narrow to `block`, `modify` or `flag`. The active filter is shown as a
chip you can clear, so you always know what you are and are not looking at.

## A detection is a URL

Selecting a row puts its id in the address bar:

```
/activity/threats?id={event-id}
```

Copy that and you have sent a colleague the exact detection, not "the third row
when I looked".

## The payload

Where the policy captured one, the detail panel shows the redacted content with the
matched spans highlighted — so you can see what actually tripped the detector.

Capture depends on the policy: a capture-off policy stores nothing, and a request
with no detection has nothing to capture. Reading a payload needs `payload:read`;
without it the panel says so.

## Feedback

You can mark a detection as a false positive, a false negative, or an expected
change. This is gated on `feedback:submit`.

## When a read is refused

If the counters or the table cannot be read, the screen says so and says the
figures are missing — **not** zero. "0 blocked, 0 passed straight through" is a
claim about your traffic, and the screen will not make it unless it knows.

## Where this differs from Audit

Threats shows **detections**. [Activity › Audit](activity-audit.md) shows
**everything** — every decision including the allows, plus configuration changes
and control-plane events. Use Threats to review what fired; use Audit to answer
"what happened at 14:32?"

See also: [Threats and verdicts](../concepts/threats-and-verdicts.md),
[Handle blocked requests](../guides/handle-blocked-requests.md),
[Monitor production traffic](../guides/monitor-production-traffic.md).
