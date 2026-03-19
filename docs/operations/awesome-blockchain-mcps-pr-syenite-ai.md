# awesome-blockchain-mcps PR — from syenite-ai only

**Important:** The PR must be opened from **syenite-ai**, not from a personal account. The current `gh` CLI is not authorized to create repos in the syenite-ai org, so use one of the methods below.

---

## Option A: GitHub web (recommended)

1. **Log in to GitHub** as an account that is an **owner or admin of the syenite-ai org**.

2. **Fork the repo into syenite-ai:**  
   Go to https://github.com/royyannick/awesome-blockchain-mcps → click **Fork** → choose **Owner: syenite-ai** (not your personal account) → **Create fork**.

3. **Edit README:**  
   In the fork (syenite-ai/awesome-blockchain-mcps), open **README.md**, find the **On-Chain Integration MCPs** section, and add this line **after** the WAIaaS line (the one ending with "Keys never leave the daemon."):

   ```
   - **[Syenite](https://github.com/syenite-ai/syenite)** – DeFi interface for AI agents. **Swap routing, cross-chain bridge execution, yield intelligence, and lending rates** across 30+ chains (Aave v3, Morpho Blue, Spark, Li.Fi aggregation). No API key required. Remote server at [syenite.ai/mcp](https://syenite.ai/mcp).
   ```

4. **Commit:**  
   Commit the change (e.g. message: `Add Syenite to On-Chain Integration MCPs`). You can do this in the GitHub web editor: **Edit** (pencil) → paste the line in the right place → **Commit changes** (use "Create a new branch" and name it e.g. `add-syenite`).

5. **Open PR:**  
   GitHub will show **Compare & pull request**. Base: `royyannick/awesome-blockchain-mcps:main`, head: `syenite-ai:add-syenite`. Create the PR. Title: "Add Syenite to On-Chain Integration MCPs". Body optional.

---

## Option B: gh CLI with syenite-ai auth

If you have `gh` authenticated as (or with a token that can act on behalf of) **syenite-ai**:

```bash
# Fork into syenite-ai (must have org admin rights)
gh repo fork royyannick/awesome-blockchain-mcps --org syenite-ai --clone
cd awesome-blockchain-mcps

# Add the line to README (after WAIaaS line, before "---")
# Then:
git checkout -b add-syenite
git add README.md
git commit -m "Add Syenite to On-Chain Integration MCPs"
git push -u origin add-syenite

# Open PR (head = syenite-ai:add-syenite)
gh pr create --repo royyannick/awesome-blockchain-mcps --base main --head syenite-ai:add-syenite --title "Add Syenite to On-Chain Integration MCPs"
```

---

## Exact line to add

Copy this exactly (one line in the list, after WAIaaS):

```
- **[Syenite](https://github.com/syenite-ai/syenite)** – DeFi interface for AI agents. **Swap routing, cross-chain bridge execution, yield intelligence, and lending rates** across 30+ chains (Aave v3, Morpho Blue, Spark, Li.Fi aggregation). No API key required. Remote server at [syenite.ai/mcp](https://syenite.ai/mcp).
```

---

## Checklist

- [ ] Fork is under **syenite-ai** (not a personal account).
- [ ] Branch name e.g. `add-syenite`.
- [ ] PR is from **syenite-ai:add-syenite** to **royyannick:main**.
- [ ] No reference to personal accounts; use syenite-ai only.
