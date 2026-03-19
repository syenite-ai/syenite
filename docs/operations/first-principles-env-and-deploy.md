# First Principles: Why App-Level Env Vars "Don't Work"

## 1. What actually runs

The **running** app is not the one you just configured. The dashboard says:

- **"Deployment failed during deploy phase"** → DO **rolled back** to the **previous** deployment.
- **"Undeployed changes: live and app spec are out of sync"** → The spec you see (and any edits) **have not been deployed** yet.

So:

- **Live deployment** = last **successful** deploy (the rollback). That deploy was built from whatever spec and code existed **then**.
- **Current spec** (app-level only for secrets, postgres link, etc.) has **never** been successfully deployed.

So the process that’s running was started with the **old** deployment’s env, not with the current app-level settings.

## 2. Why the app “doesn’t read” app-level settings

- The **process** reads `process.env.ALCHEMY_API_KEY` (and others) from the **environment of the container** that runs the Node app.
- That environment is **fixed at deploy time** by App Platform from the **spec that was used for that deploy**.
- The **currently running** container was started from the **rollback** deploy. That deploy used an **older spec** that almost certainly had **component-level** env vars for `ALCHEMY_API_KEY`, `ADMIN_PASSWORD`, etc. (often with literal values like `"${ALCHEMY_API_KEY}"` or encrypted placeholders that don’t resolve to app-level).
- So the app **does** “read” env — it reads exactly what that old deploy put in the container. What was put in was the **old component-level** values, which override app-level. So you don’t see app-level values in the running app.

So:

- **App-level not “read”** = the **running** deployment was never updated to a spec that relies on app-level only; the deployment that would have used that spec **failed**, so we’re still on the old deploy with old (component-level) env.

## 3. Why the new deployment failed

Until we see the **failed deployment’s logs**, we’re inferring. Plausible causes:

1. **Startup crash**  
   New code requires `DATABASE_URL`. If it was missing or wrong (e.g. postgres not linked, or bindable var not resolved), `getPool()` throws → `initSchema()` throws → we `process.exit(1)` → container exits → deploy fails.

2. **Build failure**  
   e.g. `npm install` or `npm run build` failed (less likely if the same code builds locally).

3. **Health check**  
   We return 200 for both "healthy" and "degraded", and 503 only for "unhealthy". So a single failing RPC check (e.g. Alchemy) alone shouldn’t fail the health check from DO’s point of view, unless DO treats non-200 as failure.

So the most likely chain is: **new deploy starts → new code runs → needs DATABASE_URL → if that’s missing or Postgres unreachable, startup throws → container exits → deploy phase fails → rollback to previous (old code + old spec).**

## 4. What to do (order of operations)

1. **Fix the deployment failure**  
   - Open the **failed** deployment (e.g. “Go to Build Logs” / “View and redeploy changes” and then check the deploy that failed).  
   - Check **build logs** and **runtime / deploy logs** for the first error (e.g. “DATABASE_URL is required”, “connect ECONNREFUSED”, “process.exit(1)”).  
   - That tells you why the new code never stayed up.

2. **Ensure the new deploy gets the right spec**  
   - In the spec that **will** be used for the next deploy, the **mcp-server** component must **not** define `ALCHEMY_API_KEY`, `ADMIN_PASSWORD`, `DASHBOARD_PASSWORD`, `SEED_API_KEY` (so they come only from app-level).  
   - And it **must** have `DATABASE_URL` from the postgres component (e.g. `value: ${postgres.DATABASE_URL}`) so the new code can connect to Postgres.

3. **Redeploy**  
   - After fixing the cause of the failure (e.g. postgres link, timeouts, or build), trigger a new deploy.  
   - When that deploy **succeeds**, the running app will be **new** code + **new** spec. Then the app will get app-level env vars (and DATABASE_URL) as intended.

## 5. Short summary

- **First principle:** The running process only sees env vars that were **injected into its container at deploy time** by the **spec used for that deploy**.
- **What’s wrong:** The **current** running deploy is the **rollback** (old spec + old code). The deploy that would use the **current** spec (app-level only for secrets, Postgres for DB) **failed**, so it never ran.
- **Fix:** Find why that deploy failed (logs), fix it (usually DATABASE_URL / Postgres or build), then redeploy so a **successful** deploy runs with the current spec and code. After that, “app-level settings” will be read correctly because they’ll be the only source for those keys in the new deploy.
