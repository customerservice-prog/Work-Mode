# Work-Mode

**A local, user-controlled browser assistant.** This is a new, independent project, not a modification of Auto-Coder.

## What it is

Open a chat page on your Windows computer, describe what you want done on a website, and watch Work-Mode use its own visible browser. It can navigate, inspect page controls, click, type and scroll. It records actions and shows screenshots. Sensitive clicks require your approval. It does **not** turn regular ChatGPT into Work and it does not use ChatGPT Work credits.

**Project status: initial MVP / not production-ready.** The browser runner has not yet been tested against your Google Voice account or other authenticated sites. It uses a **separate browser profile**, so you sign in there once yourself. It does not import existing Edge/Chrome sessions.

## Use on Windows

1. Install [Node.js 22+](https://nodejs.org/) if you don't have it.
2. Download this repository from GitHub (Code -> Download ZIP), then extract it.
3. Double-click `setup-windows.cmd` and follow the prompts. This installs dependencies and creates your local `.env` file.
4. Enter an **OpenAI API key** in the local `.env` file (not here or in GitHub). API charges are **separate** from ChatGPT subscriptions.
5. Double-click `start-windows.cmd`, open **http://127.0.0.1:3168**, and choose **Open Browser**. Sign in yourself to sites in that window, then give the agent a task.

The agent only runs while the local app is open. Keep the command window open.

### Costs
Local software and Playwright are free; OpenAI API model calls are metered. Budgeting/limits are controlled through your OpenAI API account. This project has its own per-task action limit (`MAX_STEPS`) but that does **not** guarantee a fixed dollar amount.

## Safety
- The server binds to **127.0.0.1 only**; it is not a remotely hosted public control panel.
- The automation browser stores cookies under your computer's local user profile, outside GitHub.
- Passwords and verification codes must be typed by **you**, in the browser window.
- Browser page text is treated as untrusted; it cannot authorize actions.
- Potentially high-impact clicks (payment, posting, deletion, saving, number assignment, sending messages etc.) require an approval in the local UI.
- Stops and approval denials are supported. No security boundary can fully guarantee a malicious website or flawed model won't make mistakes; supervise sensitive tasks.
- The public GitHub repository must never contain passwords, API keys, customer data, or saved browser profiles.

## What works in this initial version
- Real local Playwright Chromium with persistent login, visible while it acts
- Chat/task input; status, action log and preview screenshots
- OpenAI Responses API with structured browser tools and bounded steps
- Explicit approval for sensitive button clicks
- Stop button and no automatic deployments or payments
- Local-only server and basic URL safeguards

## What still needs work
- Automated tests and a verified Windows install
- Robust handling of every website, tabs, popups and complex applications
- More complete confirmations, domain/URL security policies and audit logs
- Better error recovery, persistent task history, lower-cost local models
- No direct integration with this ChatGPT conversation yet

## Source-project consolidation

This project is **new**. Auto-Coder stays independent and untouched. Prior related projects were reviewed for ideas, not copied wholesale: BryanTheBrain (agent staging and verification), CloneAI (Playwright inspection), Genesis Loop (task sequencing), and two empty GitHub repositories (Mirror-OS-, phone-super-assistant). See `docs/LEGACY-REVIEW.md`.

**Old projects have NOT been deleted.** Back up their full histories and check deployment/domain dependencies before deleting. This GitHub connector cannot delete whole repositories.

## Development

```sh
npm install
npx playwright install chromium
cp .env.example .env
npm start
```

Use Node 22+. The page is at `http://127.0.0.1:3168`. Set `OPENAI_API_KEY` in the local `.env`. Environment values are never committed.
