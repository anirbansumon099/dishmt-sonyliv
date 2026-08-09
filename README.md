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
- Root landing page: `https://<your-worker>/` (served from `index.html`)
- Channel HTML page: `https://<your-worker>/sony_ten4/index.m3u8`
- Path-style hidden endpoint: `https://<your-worker>/hidden/sony_ten4`
- Query by channel: `https://<your-worker>/?channel=sony_ten4`

The code loads `index.html` from the repository for the root page, and reads `env.API_BASE` and `env.PROXY_BASE` at runtime so the real server addresses are not stored in the repo.

Note: keep your secret values only in Cloudflare secrets or your deployment environment.