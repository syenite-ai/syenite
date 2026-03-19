# App-Level vs Component-Level Env Vars on DO

**Problem:** The app doesn't see values for `ALCHEMY_API_KEY`, `DASHBOARD_PASSWORD`, or `SEED_API_KEY` even though they're set under **App-Level Environment Variables**.

**Cause:** On App Platform, **component-level** env vars override **app-level** ones. If the **mcp-server** component has its own entries for those keys (e.g. from an earlier deploy or from the UI), the component gets those instead of the app-level values. When the component spec used literal `"${ALCHEMY_API_KEY}"` (or similar), the app receives the literal string, not the app-level value.

## Fix in the Control Panel

1. Open **DigitalOcean** → **Apps** → **syenite-mcp**.
2. Open the **mcp-server** component (click it).
3. Go to **Settings** (or **Environment Variables** for the component).
4. In **Component / Service Environment Variables**, find and **remove** any of:
   - `ALCHEMY_API_KEY`
   - `ADMIN_PASSWORD`
   - `DASHBOARD_PASSWORD`
   - `SEED_API_KEY`
5. Do **not** add them back at component level. Keep them only under **App-Level Environment Variables** (App → Settings → App-Level Environment Variables).
6. Save and **redeploy** the app.

After this, the component will have no override for those keys and will inherit the app-level values.

## Rule

- **Secrets and keys** that the app must read correctly: set **only** at **App-Level**. Do not set them on the mcp-server component.
- **Non-secret, static values** (e.g. `PORT`, `NODE_ENV`, `LIFI_INTEGRATOR`) are fine in the repo spec and at component level.
- **Bindable vars** (e.g. `DATABASE_URL` = `${postgres.DATABASE_URL}`) are set at component level in the spec and are resolved by DO.
