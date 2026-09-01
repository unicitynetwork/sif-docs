---
title: TLS and reverse proxy
description: Putting the gateway behind nginx, Caddy, or a managed load balancer.
---

The gateway listens on plain HTTP by default — it does not terminate TLS itself. For any deployment beyond localhost, run a TLS-terminating reverse proxy in front.

## What the proxy needs to do

| Need | Why |
|---|---|
| Terminate TLS | The gateway speaks HTTP/1.1 internally |
| Forward `Authorization` header | Required for auth |
| Forward `X-Forwarded-For` | The audit log records caller IPs |
| Upgrade WebSocket | The `/ws/events` endpoint is WebSocket; the proxy must support `Upgrade: websocket` |
| Distribute across replicas | If running multiple gateway processes |

## nginx

```nginx
upstream semanticd {
    server gateway-1:8080;
    server gateway-2:8080;
    server gateway-3:8080;
}

server {
    listen 443 ssl http2;
    server_name gateway.example.com;

    ssl_certificate     /etc/letsencrypt/live/gateway.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gateway.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location /ws/events {
        proxy_pass http://semanticd;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass http://semanticd;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

The dashboard listens on its own port (`8081`). Put it on a separate `server { listen 443 }` block or a sub-path with another `location`.

## Caddy

```caddyfile
gateway.example.com {
    reverse_proxy gateway-1:8080 gateway-2:8080 gateway-3:8080
}

dashboard.example.com {
    reverse_proxy gateway-1:8081 gateway-2:8081 gateway-3:8081
}
```

Caddy handles TLS automatically, including WebSocket upgrades. The simplest option for low-touch deployments.

## Cloud load balancers

| Provider | Service |
|---|---|
| AWS | Application Load Balancer — supports WebSocket. Target-group health-check path `/healthz` |
| GCP | Cloud Load Balancing (External HTTPS) — enable WebSocket support |
| Azure | Application Gateway |
| Cloudflare | Cloudflare Tunnel or Proxied — WebSocket works on Pro plans and above |

In all cases:

- Health check at `/healthz` (not `/readyz` — the LB doesn't need to evict a replica that is healthy-but-not-ready).
- Idle timeout ≥ 60 s. WebSocket connections need long timeouts; some defaults are 30 s, which causes pointless reconnects.
- Pass `X-Forwarded-For` through.

## Internal mTLS

For deployments inside a service mesh (Istio, Linkerd), the gateway accepts mTLS via the sidecar — no application-layer changes needed. Configure the sidecar to terminate mTLS and forward plain HTTP to port 8080. The gateway treats the connection as trusted and reads the `Authorization` header normally.

## Related

- [Docker Compose](docker-compose.md) — the dev path uses no proxy.
- [Production checklist](production-checklist.md) — TLS verification items.
- [HTTP API → Health and status](../api/health-and-status.md) — the endpoints your proxy should check.
