---
title: Python SDK
description: The semantic-firewall Python package — install, usage, and reference.
---

A thin httpx-based wrapper for the Semantic Firewall HTTP API. Targets Python 3.9+.

## Install

```bash
pip install semantic-firewall
```

## Quick use

```python
from semantic_firewall import SemanticFirewall

client = SemanticFirewall(
    base_url="https://sif.unicity.network",
    api_key="semd_your_key_here",
)

result = client.guard("Hello, how are you?")
if result.blocked:
    print("Blocked. Request id:", result.request_id)
elif result.is_flagged:
    print(f"Flagged at risk={result.risk_score:.2f}")
else:
    print("Safe")
```

## Client

```python
class SemanticFirewall:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        *,
        timeout: float = 10.0,
    ): ...

    def guard(
        self,
        prompt: str | list[dict],
        *,
        policy: str | None = None,
        return_detections: bool = True,
    ) -> GuardResponse: ...

    def close(self) -> None: ...
```

`prompt` accepts either a plain string (treated as a single user message) or a full messages array:

```python
# Shorthand
result = client.guard("What's the weather?")

# Full form — when you need system / assistant roles
result = client.guard([
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user",   "content": "What's the weather?"},
])
```

## Response

Matches the wire shape defined by [`GuardResponse`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semd-core/src/types/response.rs) on the server. Fields the server omits (`detections` when empty, `policy_applied` when null, etc.) are exposed as their type's default in Python.

```python
@dataclass
class GuardResponse:
    request_id: str
    action: str                          # "allow", "flag", "modify", "block"
    blocked: bool                        # action == "block"
    risk_score: float
    detections: list[Detection]          # may be empty
    processing_time_ms: int
    policy_applied: str | None
    degraded: bool | None
    timestamp: datetime | None
    versions: AnalysisVersions | None
    modified_content: str | None         # only when action == "modify"

    @property
    def is_flagged(self) -> bool: ...    # action in ("flag", "modify", "block")
```

## Detection

```python
@dataclass
class Detection:
    category: str
    confidence: float
    description: str
    rule_id: str | None
```

## Errors

```python
from semantic_firewall import (
    SemanticFirewallError,           # base class
    AuthenticationError,         # 401, 403
    ServerError,                 # 5xx
)

try:
    result = client.guard(prompt)
except AuthenticationError:
    # Re-issue or rotate the key
    raise
except ServerError:
    # Decide fail-open vs. fail-closed
    raise
except SemanticFirewallError:
    # Network errors, timeouts, malformed responses
    log.exception("guard call failed")
    raise
```

`SemanticFirewallError` is the parent of every SDK exception. Catch it at your application boundary; let everything else propagate.

## Async

```python
from semantic_firewall import AsyncSemanticFirewall

client = AsyncSemanticFirewall(base_url="...", api_key="semd_...")
result = await client.guard("hello")
```

Identical interface to the sync client; all I/O is non-blocking. Use this when calling from an async web framework (FastAPI, Quart, aiohttp).

## Context manager

Both client classes work as context managers; the underlying httpx connection is closed on exit:

```python
with SemanticFirewall(base_url="...", api_key="...") as client:
    result = client.guard(prompt)
```

## Retries

The SDK does **not** retry by default. Guard calls are typically in the user-visible request path; automatic retries would compound latency unpredictably. If you want retries (e.g. for batch jobs), wrap with `tenacity` or a retry library, and exclude `AuthenticationError` from the retry conditions.

## Related

- [HTTP API → Guard endpoint](../api/guard-endpoint.md) — what the SDK calls under the hood.
- [How-to → Integrate with an LLM app](../guides/integrate-with-an-llm-app.md) — real-world integration patterns.
- [How-to → Handle blocked requests](../guides/handle-blocked-requests.md) — what to do with the verdict.
