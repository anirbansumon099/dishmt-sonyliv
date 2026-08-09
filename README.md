# dishmt-sonyliv

Usage
-
This worker proxies streams but keeps the main server URLs out of source by reading them from environment variables / secrets.

Setup secrets (do NOT store secret URLs in the repository):

1. Install and login to Wrangler (Cloudflare Workers):

```
npm install -g wrangler
wrangler login
```

2. In your terminal, set the secrets (you will be prompted to paste the value):

```
wrangler secret put API_BASE
wrangler secret put PROXY_BASE
```

Replace the contents with your real base URL (for example `https://example.com/sony-new/playlists/`) and proxy base respectively.

Usage examples
-
- Query by channel: `https://<your-worker>/?channel=sony_ten4`
- Path-style hidden endpoint: `https://<your-worker>/hidden/sony_ten4`

The code reads `env.API_BASE` and `env.PROXY_BASE` at runtime, so the real server addresses are not stored in the repo.

Note: keep your secret values only in Cloudflare secrets or your deployment environment.