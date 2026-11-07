# Work-Mode — Browser Agent (Cloud Beta)

**Status: beta, not a complete replacement for ChatGPT Work.** The hosted version is accessible at https://work-mode-production.up.railway.app/ and runs on Railway. The Windows offline Lite v0.5.0 installer remains separate and unchanged.

## Features implemented

- Owner-only sign-in over HTTPS with protected APIs, HttpOnly cookies, rate-limited login, and persistent sessions.
- Private password rotation from Cloud status (requires current password; revokes old sessions).
- One remote Playwright Chromium browser, browser preview, tabs, navigation, touch, keyboard and owner-approved consequential actions.
- Basic browser commands without an AI subscription or per-message API fee. Type `Help` to see the supported commands. **These are deterministic actions, not autonomous AI.**
- Optional advanced AI via an OpenAI API key **or** an owner-hosted OpenAI Responses-compatible endpoint, e.g., recent Ollama. Compatible inference requires its own computing environment; it is not provisioned by this repository.
- Private mounted storage for browser profile and task metadata.
- Encrypted task checkpoints and task history on cloud, plus recovery that marks interrupted work without blindly redoing high-impact actions.
- Automated HTTP, hosted-authentication, browser, provider, journal, and responsive-UI tests.

## Major limitations

- **No free, capable hosted AI is included.** Without a configured inference server or API, Work-Mode offers only predefined browser commands.
- The Railway browser starts without Chromium's process sandbox due to host restrictions. Container isolation is **not equivalent**. Avoid sensitive logins and arbitrary untrusted websites. A properly isolated browser worker is required before claiming production-ready safe automation.
- A single in-memory running task and owner session are supported. Checkpoints survive restarts, but interrupted tasks require deliberate review and restart; no unattended replay.
- GitHub coding, code execution, autonomous PR creation, and deploy approval are not yet built into the standalone Work-Mode web app.
- Phone/iPad browser layouts have automated checks, but physical-device sign-in and real-world website compatibility have not all been verified.
- Browser profile may contain sensitive cookies. Storage encryption and independent off-host backups must be verified separately; application encryption of task records does not encrypt the Chromium profile.
- This Railway service and self-hosted inference consume hosting resources and may generate charges. Neither unlimited free cloud inference nor unlimited computing capacity can be guaranteed.

## Run modes

### Hosted basics (no AI model)

Deploy the `feature/cross-device-cloud` branch. Configure `WORKMODE_CLOUD_MODE=1`,
`WORKMODE_CLOUD_ORIGIN`, `WORKMODE_CLOUD_PASSWORD` (16+ chars),
`WORKMODE_SESSION_SECRET` (32+ chars), and `WORKMODE_DATA_DIR=/data` with a mounted persistent volume.
A browser command such as `Open https://www.google.com and tell me the page title` does not need an OpenAI API key.

### Optional self-hosted AI

Set the following **private server environment variables**:

- `WORKMODE_AI_BASE_URL`: HTTPS OpenAI-compatible `/v1` URL or a private `http://name.railway.internal:port/v1` endpoint.
- `WORKMODE_AI_MODEL`: model name hosted by that server.
- `WORKMODE_AI_API_KEY`: only if the compatible endpoint requires bearer authentication.

The compatible endpoint must support the OpenAI Responses API and function calling. The implementation uses stateless transcripts and does not send screenshot images to a text-only endpoint. Hosted AI server availability, hardware, model quality, and fees are independent of Work-Mode.

Alternatively, configure `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) for a separately billed OpenAI API. Token ceilings apply to that option, not the self-hosted endpoint.

### Offline Windows

The local-only [Lite v0.5.0 Windows release](https://github.com/customerservice-prog/Work-Mode/releases/tag/v0.5.0) has a bundled small offline AI model. It is a different edition, and it has not been verified on every low-spec PC.

## Security and verification

See [Operations](docs/OPERATIONS.md), [Acceptance criteria](docs/ACCEPTANCE.md), and [Architecture](docs/CROSS-DEVICE.md).
The GitHub workflow runs `npm test` and checks the app. **A green CI result does not prove the real Railway site, every external website, or physical iPad/phone works.**

Never put passwords, cookies, API keys, or browser profiles in GitHub, task prompts, or issue comments. Rotate the earlier shared website password inside Work-Mode's Cloud status settings.
