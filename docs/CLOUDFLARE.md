# Cloudflare Integration (Optional)

MapleSpike is self-hosted by default (homelab K3s). Cloudflare integration is optional for production.

## Installation

Dev dependencies already installed:
```bash
pnpm add -D wrangler cloudflare
```

## Cloudflare Free Tier Features

### DNS + SSL (maplespike.ca)
- Free SSL certificates via Cloudflare
- DNS management dashboard or API
- CDN caching for portal assets

### Cloudflare Pages (Optional Portal Deployment)
```bash
cd packages/portal
pnpm build
wrangler pages deploy dist --project-name=maplespike
```

### Cloudflare Tunnel (Homelab Access)
```bash
wrangler tunnel login
# Configure tunnel to expose maplespike.lan without port forwarding
```

### Cloudflare Email Routing
- Forward billing@maplespike.ca to personal email
- No mail server needed

### Cloudflare R2 (Object Storage - 10GB Free)
- Alternative to local storage for exports
- S3-compatible API

### Cloudflare D1 (SQLite - 5GB Free)
- Edge-hosted SQLite
- Alternative to NodeSqliteStorage

## Self-Host vs Cloudflare

| Feature | Self-Host (Default) | Cloudflare (Optional) |
|---------|-------------------|---------------------|
| API Server | K3s cluster | Workers (requires refactoring) |
| Portal | Caddy + Astro | Pages (static only) |
| Database | NodeSQLite/PostgreSQL | D1 (migration needed) |
| Storage | Local FS | R2 (optional) |
| DNS | Local/homelab | Cloudflare DNS |
| SSL | Let's Encrypt/Caddy | Cloudflare SSL |

## Wrangler Commands

```bash
# Login to Cloudflare
pnpm exec wrangler login

# List projects
pnpm exec wrangler pages project list

# Deploy portal to Pages
cd packages/portal && pnpm build
pnpm exec wrangler pages deploy dist --project-name=maplespike

# Create tunnel
pnpm exec wrangler tunnel create --name maplespike-homelab
```

## Programmatic Cloudflare API

```typescript
import Cloudflare from 'cloudflare';

const cf = new Cloudflare({ apiToken: process.env.CLOUDFLARE_API_TOKEN });

// Add DNS record for maplespike.ca
await cf.dns.records.create('YOUR_ZONE_ID', {
  type: 'A',
  name: '@',
  content: 'YOUR_CLUSTER_IP',
  ttl: 300,
  proxied: true,
});

// Upload portal to R2
const r2 = await cf.r2.buckets.list();
await cf.r2.objects.upload('YOUR_BUCKET_ID', 'index.html', body);
```

## Notes

- Cloudflare integration is **100% optional**
- Self-hosted deployment works without any Cloudflare account
- Use Cloudflare only for DNS/SSL convenience or CDN acceleration
- Production cluster can remain on homelab K3s with Cloudflare proxy in front