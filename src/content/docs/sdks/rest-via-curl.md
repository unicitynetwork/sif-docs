---
title: REST via curl
description: Using the HTTP API directly from any language.
---

The SDK is optional. Any HTTP client works against the REST API. This page shows the most common patterns in shell, JavaScript, Go, and Ruby.

## Single guard call

### curl

```bash
curl -X POST https://gateway.example.com/api/v1/guard \
  -H "Authorization: Bearer semd_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

One-liner that prints the action only:

```bash
curl -sS -X POST https://gateway.example.com/api/v1/guard \
  -H "Authorization: Bearer semd_your_key" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}' \
  | jq -r .action
```

### JavaScript (fetch)

```javascript
const result = await fetch("https://gateway.example.com/api/v1/guard", {
  method: "POST",
  headers: {
    "Authorization": "Bearer semd_your_key",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    messages: [{ role: "user", content: userText }],
  }),
}).then((r) => r.json());

if (result.action === "block") { /* ... */ }
```

### Go (net/http)

```go
body := strings.NewReader(`{"messages":[{"role":"user","content":"Hello"}]}`)
req, _ := http.NewRequest("POST", "https://gateway.example.com/api/v1/guard", body)
req.Header.Set("Authorization", "Bearer semd_your_key")
req.Header.Set("Content-Type", "application/json")
resp, err := http.DefaultClient.Do(req)
// decode resp.Body…
```

### Ruby (net/http)

```ruby
require "net/http"; require "json"
uri = URI("https://gateway.example.com/api/v1/guard")
req = Net::HTTP::Post.new(uri,
  "Authorization" => "Bearer semd_your_key",
  "Content-Type"  => "application/json")
req.body = { messages: [{ role: "user", content: "Hello" }] }.to_json
res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |h| h.request(req) }
verdict = JSON.parse(res.body)
```

## Streaming events (WebSocket)

### wscat

```bash
wscat -c "wss://gateway.example.com/ws/events?types=verdict&actions=block,modify" \
  -H "Authorization: Bearer semd_your_key"
```

Each line of output is one event.

### JavaScript (browser)

```javascript
const ws = new WebSocket(
  "wss://gateway.example.com/ws/events?api_key=semd_your_key&types=verdict&actions=block",
);
ws.onmessage = (msg) => {
  const event = JSON.parse(msg.data);
  if (event.action === "block") sendToSiem(event);
};
ws.onclose = (e) => {
  if (e.code === 1009) console.warn("backpressure — reconnecting");
  setTimeout(connect, 3000);
};
```

Browsers cannot set custom headers on a WebSocket upgrade; use the `api_key` query parameter. See [Authentication](../api/authentication.md).

## Listing audit entries

```bash
curl -sS "https://gateway.example.com/manage/audit/entries?action=block&page_size=50" \
  -H "Authorization: Bearer semd_admin_key" \
  | jq '.entries[] | {ts: .timestamp, action, score: .risk_score, det: .detections[0].category}'
```

## Cursor pagination

The audit list returns an opaque `next_cursor`:

```bash
cursor=""
while : ; do
  resp=$(curl -sS \
    "https://gateway.example.com/manage/audit/entries?since=2026-06-01&page_size=500&cursor=${cursor}" \
    -H "Authorization: Bearer semd_admin_key")
  echo "$resp" | jq -c '.entries[]'
  cursor=$(echo "$resp" | jq -r '.next_cursor // empty')
  [ -z "$cursor" ] && break
done
```

## Related

- [HTTP API → Authentication](../api/authentication.md) — header forms.
- [HTTP API → Guard endpoint](../api/guard-endpoint.md) — full request and response shapes.
- [Python SDK](python.md) — the type-safe path.
