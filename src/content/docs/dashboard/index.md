---
title: Dashboard tour
description: A tour of the operator console, section by section.
sidebar:
  order: 1
---

The console is organised into six sections across the top. There is no sidebar:
you pick a section, then a screen within it from the tab strip under the section
heading.

Every screen is a URL, so any view you can reach you can also bookmark, share, or
link to from a runbook — including filtered ones.

## The sections

| Section | Screens | What it is for |
|---|---|---|
| [Home](home.md) | — | What needs your attention, and the last 24 hours at a glance |
| [Fleet](fleet-agents.md) | Agents, Keys, System | The machines calling the guard, and the credentials they hold |
| [Guardrails](guardrails-policies.md) | Policies, Rules, Rulesets, Detectors, Tester | What SIF checks, and what it does when a check fires |
| [Activity](activity-threats.md) | Threats, Audit | Every decision the firewall made, and the audit trail behind it |
| [Access](access-users.md) | Users, Identity, Tenants | Who can use this console, how they sign in, and the tenants on the platform |
| [Reports](reports.md) | — | Not yet designed; the audit log does this work today |

## Screens

| Screen | Route | Page |
|---|---|---|
| Home | `/` | [Home](home.md) |
| Fleet › Agents | `/fleet/agents` | [Agents](fleet-agents.md) |
| Fleet › Keys | `/fleet/keys` | [Keys](fleet-keys.md) |
| Fleet › System | `/fleet/system` | [System](fleet-system.md) |
| Guardrails › Policies | `/guardrails/policies` | [Policies](guardrails-policies.md) |
| Guardrails › Rules | `/guardrails/rules` | [Rules](guardrails-rules.md) |
| — a single rule | `/guardrails/rules/{ruleset}/{rule}` | [Rule detail](guardrails-rule-detail.md) |
| Guardrails › Rulesets | `/guardrails/rulesets` | [Rulesets](guardrails-rulesets.md) |
| — a single ruleset | `/guardrails/rulesets?id={ruleset}` | [Rulesets](guardrails-rulesets.md) |
| Guardrails › Detectors | `/guardrails/detectors` | [Detectors](guardrails-detectors.md) |
| Guardrails › Tester | `/guardrails/tester` | [Tester](guardrails-tester.md) |
| Activity › Threats | `/activity/threats` | [Threats](activity-threats.md) |
| Activity › Audit | `/activity/audit` | [Audit](activity-audit.md) |
| Access › Users | `/access/users` | [Users](access-users.md) |
| Access › Identity | `/access/identity` | [Identity](access-identity.md) |
| Access › Tenants | `/access/tenants` | [Tenants](access-tenants.md) |
| Reports | `/reports` | [Reports](reports.md) |

## What you can see is what you can do

Controls you lack the capability for stay visible and disabled, with a tooltip
naming the capability you would need. Nothing silently disappears, so a screen
reads the same to everyone and you can tell the difference between "this cannot
be done" and "you cannot do this".

The console's gating is a convenience. Every action is independently re-checked
by the server, and a refusal is written to the audit log as an `authz.denied`
event. See [Access › Users](access-users.md) and
[Access control](../operations/access-control.md).

## A refused read is not an empty result

Where a screen cannot read something — because your role lacks the capability, or
the request failed — it says so, naming the capability. It does not report zero.
"No keys configured" and "the key list could not be read" are different claims,
and the console is careful to make the right one.

## Older links still work

The console was reorganised into these six sections. The routes it used before
(`/threats`, `/rules`, `/policies`, `/detectors`, `/settings`, `/identity`,
`/admin`, `/developers`, `/platform`) all still resolve, and keep any query
string you sent them with. A bookmark from the older layout will land in the
right place.
