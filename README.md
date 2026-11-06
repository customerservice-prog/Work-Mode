# Work-Mode

**A local, user-controlled browser assistant.** This is a new, independent project, not a modification of Auto-Coder.

## What it is

Open a chat page on your Windows computer, describe what you want done on a website, and watch Work-Mode use its own visible browser. It can navigate, inspect page controls, click, type and scroll. It records actions and shows screenshots. Sensitive clicks require your approval. It does **not** turn regular ChatGPT into Work and it does not use ChatGPT Work credits.

**Project status: advanced local-browser MVP / not production-ready.** The browser runner has not yet been tested against your Google Voice account or other authenticated sites. It uses a **separate browser profile**, so you sign in there once yourself. It does not import existing Edge/Chrome sessions.

## Use on Windows

1. Install [Node.js 22+](https://nodejs.org/) if you don't have it.
2. Download this repository from GitHub (Code -> Download ZIP), then extract it.
3. Double-click `setup-windows.cmd` and follow the prompts. This installs dependencies and creates your local `.env` file.
4. Choose an AI mode in the local `.env` file: **OpenAI API** (usually more capable, but metered) or **Ollama** (runs a local model, no per-request API charges). See below.
5. Double-click `start-windows.cmd`, open **http://127.0.0.1:3168**, and choose **Open Browser**. Sign in yourself to sites in that window, then give the agent a task.

The agent only runs while the local app is open. Keep the command window open.

### Browser operator upgrade

- Multiple tab listing, switching, and opening; back navigation and keyboard/dropdown controls.
- Concrete page verification instead of assuming a click proves success.
- Private-network URL blocks and a local-only API.
- Local task history and a way to continue earlier tasks.
- Automated safety and browser smoke tests.

### Costs
Local software and Playwright are free. **OpenAI API mode** has separate usage charges and needs an API key. **Ollama mode** runs a model on your own PC with no per-message model API bill, but uses your computer's RAM/CPU/GPU and can be slower or less reliable. Neither mode consumes ChatGPT Work credits. Hosting on Railway or another cloud provider has its own cost.

### Choose your AI provider

**Option A — paid API mode (more reliable for complex tasks):** In your local `.env`, set `AI_PROVIDER=openai` and `OPENAI_API_KEY=your_key`. Set your own API spending limits in the OpenAI API dashboard.

**Option B — local Ollama (no per-message model API fee):** Install [Ollama](https://ollama.com/download/windows), open Windows Terminal once and run `ollama pull qwen3:8b` (a multi-GB download; a PC with sufficient memory is required). Then set `AI_PROVIDER=ollama` in `.env`. You can leave `OPENAI_API_KEY` empty; set `OLLAMA_MODEL=qwen3:8b`. Ollama must be running when you use Work-Mode.

Ollama's compatible Responses endpoint does not support `previous_response_id`; Work-Mode instead carries the tool calls forward explicitly in local mode. Tool-calling quality depends on the installed model, so some website tasks may not work well in local mode. Never consider an unverified task completed.

The app's action limit (`MAX_STEPS`) bounds browser operations, **not** the price of model tokens. Be careful with long or repeated tasks.

## Safety
- The server binds to **127.0.0.1 only**; it is not a remotely hosted public control panel. A successful Railway deployment cannot operate the browser on your personal computer; install and run this app on Windows.
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
- Robust handling of every website, multi-step authentication, popups, captchas, and complex applications
- More complete confirmations, domain/URL security policies and audit logs
- Better error recovery, persistent task history, lower-cost local models
- No direct integration with this ChatGPT conversation yet
- Full computer control, recurring tasks, connected apps and the broader range of ChatGPT Work functions are not implemented

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
