# Legacy-project extraction / migration boundary

Scope: only the six AI-related repositories discussed with the owner, not unrelated business projects. This public document contains no secrets or private customer data.

| Source repository | Findings | Reuse in Work-Mode |
| --- | --- | --- |
| bryanthebrain | Local chat, task memory, Playwright-based visual audit, guarded staged edits, verification scripts | Adopt principles: visible actions, guarded writes, verification; do not transplant the entire codebase |
| CloneAI | Browser interaction suite and page inspection focused on web crawling / extraction | Use Playwright concept and inspect-after-action flow, not the cloning/business product |
| Genesis-Loop---mind---body---soul | Multi-agent sequential orchestration from plan to code and deployment | Reuse bounded orchestration ideas only |
| Auto-Coder | Independent coding IDE with Electron shell and source editing | KEEP separate, unchanged |
| Mirror-OS- | Empty GitHub repository at review time | Nothing to migrate from GitHub; local files not inspected |
| phone-super-assistant | Empty GitHub repository at review time | Nothing to migrate from GitHub; local files not inspected |

## User requirements

- Create a **brand new Work-Mode project** at customerservice-prog/Work-Mode.
- Maintain Auto-Coder independently; it must not be deleted.
- The assistant should act on user-authorized websites from a familiar chat UI, like Work, without consuming ChatGPT Work credits.
- Show browser activity, inspect outcomes and do not claim success without evidence.
- Use simple Windows setup and minimize recurring costs.
- Require review before high-impact actions; keep credentials and browser state local.

## What is NOT proven

Prior repository README claims do not constitute end-to-end verification of browser control. This is a new local browser operator. Website compatibility, Google Voice changes and installation are not yet verified.

## Deletion / retirement

**No legacy repositories or deployments have been deleted.** A whole-repository delete action is not available in the connected GitHub tools. The owner requests retaining Auto-Coder; before deleting any other legacy AI repository, export a verified archive of each repository's code and Git history and inspect external deployment/domain links. Avoid deleting any unrelated repositories.

## Privacy

Work-Mode is currently a public repository. Never commit API keys, credentials, cookies, logged-in browser profiles or business/customer records.
