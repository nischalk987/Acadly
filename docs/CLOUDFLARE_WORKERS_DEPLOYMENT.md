# Cloudflare Workers deployment

Acadly is deployed as a Cloudflare Worker with static assets. This is different from a static-assets-only upload: the Worker entry point allows Cloudflare runtime bindings and secrets to be configured while Vite serves the React application from the `dist` asset directory.

## Git-connected build settings

In Cloudflare Dashboard → Workers & Pages → `acadly` → Settings → Builds, configure:

- Root directory: `frontend`
- Build command: `npm run build`
- Deploy command: `npm run deploy`
- Production branch: `main`

The deploy command uses the pinned Wrangler CLI version in `frontend/package.json` and reads `frontend/wrangler.jsonc`.

## Frontend build variable

Add this under the Cloudflare **Build variables** (not Runtime variables):

- Name: `VITE_WEB_PUSH_VAPID_PUBLIC_KEY`
- Value: the VAPID public key generated for Acadly

Vite embeds `VITE_*` values during the build. Trigger a new deployment after adding or changing this variable.

The VAPID public key is intended to be browser-visible. Never put the VAPID private key or `ACADLY_CRON_SECRET` in a frontend build variable. Those remain Supabase Edge Function secrets.

## Worker runtime configuration

`frontend/wrangler.jsonc` declares `frontend/worker.js` as the Worker entry point and serves the Vite `dist` directory through the `ASSETS` binding. This makes the deployment a Worker with assets rather than an assets-only upload. Runtime secrets, if ever needed by Worker code, belong in Cloudflare Runtime variables/secrets; the Web Push sender's private keys remain in Supabase.
