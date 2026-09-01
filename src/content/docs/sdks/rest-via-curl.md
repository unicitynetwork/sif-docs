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

## Listing audit rows

The audit log is on the management API, which runs on its own port (default
`SEMANTICD_PORT + 1`) and takes a JWT, not an API key. Get one from
`POST /manage/auth/login`:

```bash
JWT=$(curl -sS -X POST https://manage.example.com/manage/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<your_password>"}' \
  | jq -r .token)

curl -sS "https://manage.example.com/manage/audit?action=block&page_size=50" \
  -H "Authorization: Bearer ${JWT}" \
  | jq '.data[] | {ts: .timestamp, action, score: .risk_score, det: .detections[0].category}'
```

The filters are listed in [Management endpoints → Audit](../api/management-endpoints.md#audit).
An unrecognised parameter is ignored rather than rejected, so a misspelt filter
returns rows that were never narrowed — check the name against that table before
trusting the result.

## Paging through the log

There is no cursor. The audit list is paged by `page` (1-indexed) and `page_size`
(default 50), and every response carries `total` and `has_more`:

```bash
page=1
while : ; do
  resp=$(curl -sS \
    "https://manage.example.com/manage/audit?start_date=2026-06-01T00:00:00Z&page_size=500&page=${page}" \
    -H "Authorization: Bearer ${JWT}")
  echo "$resp" | jq -c '.data[]'
  [ "$(echo "$resp" | jq -r .has_more)" = "true" ] || break
  page=$((page + 1))
done
```

## Related

- [HTTP API → Authentication](../api/authentication.md) — header forms.
- [HTTP API → Guard endpoint](../api/guard-endpoint.md) — full request and response shapes.
- [Python SDK](python.md) — the type-safe path.
