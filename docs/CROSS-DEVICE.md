# Work-Mode cross-device architecture

## Goal

One private Work-Mode experience accessible through HTTPS from:
- Windows desktops and inexpensive laptops (any current browser)
- iPad (Safari / Add to Home Screen)
- iPhone and Android phones (mobile browser / Home Screen)

Users should not need Node.js, Ollama, a model download, or an installed desktop app on each device.

## How it works

The tablet or phone is a lightweight controller:
1. Open the HTTPS Work-Mode URL and sign in with your private Work-Mode password.
2. Chat with the assistant, watch the remote browser preview, and approve high-impact actions.
3. For authentication challenges, switch to **Browser**, enable tap control, and interact with the remote browser from the screenshot and typing controls.
4. Browser cookies, task history, and AI calls stay with the remote server, not the device. No browser control from this desktop ChatGPT chat is assumed.

The cloud server needs:
- A long-running Node process and Playwright browser
- An authenticated HTTPS endpoint with a user-supplied high-entropy access password
- A permanent encrypted-at-rest volume for browser profile and task history, backed up separately
- A configured and metered AI provider/API key (API usage is **not free**)
- One running server replica for current in-memory sessions and single-user task state
- A secure sandbox appropriate for visiting untrusted websites

## Deployment variables

Set secrets using the cloud host's private environment-variable controls, **not GitHub**.

| Variable | Required | Meaning |
| --- | --- | --- |
| WORKMODE_CLOUD_MODE | yes | Set to 1 |
| WORKMODE_CLOUD_ORIGIN | yes | The exact public HTTPS origin, e.g. https://your-private-domain.example |
| WORKMODE_CLOUD_PASSWORD | yes | At least 16 characters; make it strong and unique |
| WORKMODE_SESSION_SECRET | yes | At least 32 unpredictable characters |
| OPENAI_API_KEY | yes in current cloud edition | An API key with spending caps, stored privately by the host |
| AI_PROVIDER | yes | openai |
| WORKMODE_DATA_DIR | recommended | Persistent mounted volume (for example /data) |
| PORT | provided by hosting platform | HTTP port; binds 0.0.0.0 in hosted mode |

**Important:** The cloud host must supply TLS/HTTPS, persistent storage, and appropriate sandbox isolation. The application does not create an HTTPS certificate. Until the environment is provisioned and tested, there is **no live cloud app URL**.

## Security safeguards already implemented

- Strict HTTPS origin and Host validation
- Password-gated UI and APIs (including screenshots, task logs, SSE and manual controls)
- HttpOnly/Secure/SameSite=Strict session cookies and 12-hour sessions
- Login attempt limits and no anonymous browser access
- User-controlled remote typing not stored in action logs
- Existing URL restrictions against local/private network targets
- Explicit owner approval requests before high-impact agent actions
- Offline Home Screen cache limited to the public icon, not sensitive API responses

## Production gaps / required verification

This is a **prototype**, not yet a production-hardened agent that can safely operate arbitrary untrusted websites unattended:
- Verify Chromium process sandbox under the chosen host, with separate browser isolation, CPU/RAM limits and network egress policies
- Add persistent encrypted storage, backups and credential rotation
- Verify mobile Safari/Android home-screen installation and touch coordinates on physical devices
- Test sign-in flows on selected websites; some may block remote browsers or require additional verification
- Consider a browser infrastructure provider offering per-session isolation if the host cannot run Chromium sandboxed
- Add deployment health, runtime logging free of secrets, and usage/cost ceilings
- Test session restoration after app restarts and single-replica assumptions
- Use a stronger vision-capable model if visual website interpretation is needed

## Windows edition

The existing v0.3.0 Windows installer remains available. It is an independent local-browser edition and is unchanged by this feature branch. Once the cloud service is ready, Windows may use the same HTTPS Work-Mode URL through a browser or a small desktop wrapper. Do **not** force a heavyweight local language model onto a low-cost laptop or iPad.

## Hosting

The prior Railway project showed a past-due billing warning and an unexposed service. No deployment or billing change is authorized by this design work. Hosting must be verified before claiming the cloud service is available.
