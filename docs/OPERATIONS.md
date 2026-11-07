# Work-Mode cloud operations

## Current deployment

- Railway service: `Work-Mode` in project `Work-Mode`, production environment.
- URL: https://work-mode-production.up.railway.app/
- Single service with one mounted `/data` volume. Do not delete the service or volume without independently verifying a usable backup.
- Railway `/api/health` is a **liveness** check, not proof of model, browser, or task readiness.
- Sign in, then check `/api/cloud/readiness`, `/api/status`, and `/api/task-journal`.
- The browser currently lacks its own Chromium sandbox; avoid sensitive account operations.

## No-cost-per-message browser mode

With no AI server configured, commands such as `Help`, `Open google.com`,
`Read the page`, `List tabs`, `Scroll down`, and `Verify page contains text` work.
No generic AI reasoning or code editing is implied. Railway computing is still billed according to your account.

## Configuring a self-hosted inference backend

Provision and secure the inference server **separately**. No additional Railway service is created automatically.
Use a private-network URL when running on Railway. Do not expose an unauthenticated Ollama server publicly.

- `WORKMODE_AI_BASE_URL=http://your-model-service.railway.internal:11434/v1`
- `WORKMODE_AI_MODEL=<installed model identifier>`
- `WORKMODE_AI_API_KEY=<private credential, if required>`

The model must support the Responses API with tool calling. Modern Ollama versions provide this functionality;
small CPU models can struggle with complex instructions. This is not free hosting. Only set variables after
checking resource costs and security. If no compatible endpoint is available, keep basic browser mode.

Alternatively, `OPENAI_API_KEY` enables a separately billed OpenAI API. Per-day/month token controls protect
against excessive usage but are not hard dollar-spend guarantees. Do not reuse a ChatGPT login credential as an API key.

## Password rotation

The earlier website password was pasted into a chat. **Change it through the private Work-Mode interface:**
sign in, open Cloud status, enter current and new website passwords, submit. Existing sessions are revoked.
Store the replacement in your own password manager, not ChatGPT or GitHub.

The server stores a salted scrypt hash of the owner-changed password in `/data/auth-password.json`.
The original Railway env password remains as a bootstrap fallback if the entire volume is lost; a separate
credential and storage recovery plan is needed before treating this as fully hardened. Rotate the original
Railway variable during planned credential maintenance as well, after confirming access.

## Encrypted task data and recovery

- `/data/task-checkpoints.enc` contains encrypted running/recent tasks.
- `/data/task-history.enc` contains encrypted task history. A migration reads previous plaintext history,
  verifies and writes encrypted records, then unlinks the old JSON file.
- Application encryption uses a key derived from `WORKMODE_SESSION_SECRET`; preserve that secret
  securely and do not rotate it without an explicit migration/backup. Otherwise old records cannot be decrypted.
- Chromium's `/data/browser-profile` is **not encrypted by these application routines**. Browser credentials
  may still exist on the volume and should be treated as sensitive.
- After an app restart, any unfinished task is marked `interrupted`, never automatically replayed.
  Check the real website and payments or outgoing messages before retrying.
- A corrupted encrypted journal blocks task execution rather than overwriting it.
- There is **no verified off-site backup** in this project. Establish and test an encrypted backup/restore
  process before calling it production ready.

## Release checklist

1. Make changes to a development branch, not directly to the deployed branch.
2. Verify all GitHub CI checks, including hosted integration tests.
3. Fast-forward or merge only passing revisions to `feature/cross-device-cloud`.
4. Confirm Railway deploy `SUCCESS` and `/api/health` passes.
5. Log in to Edge, verify `Open Browser`, and run `Open https://www.google.com and tell me the page title`.
6. Verify `/api/cloud/readiness`, private session controls, task journal and no secrets in API responses.
7. Test physical iPad/phone and the actual websites before asserting cross-device acceptance.
8. If rollback is needed, restore the last verified commit while **retaining `/data`**.

## Outstanding production blockers

The browser requires real sandbox/microVM isolation; advanced inference requires an available model/API;
code-editing actions need scoped repository authorization and sandboxed test execution; independently
encrypted off-site backups, availability metrics, resource/cost monitoring, and physical-device tests
remain. This beta is not intended for fully autonomous unattended high-impact actions.
