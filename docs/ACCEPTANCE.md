# Work-Mode release and acceptance matrix

Status labels: **Implemented** means code exists; **Automated test** means CI passed; **Live verified**
requires direct observation against the deployed Railway service or physical device.

| Requirement | Status | Evidence / blocker |
| --- | --- | --- |
| Owner sign-in over HTTPS | Implemented; earlier live login verified | Current session and password rotation still need release verification |
| Browser navigation and screenshot preview | Implemented; earlier live browser startup verified | Test on chosen websites before relying on outcomes |
| Zero-subscription browser commands | Implemented and automatically tested | Not natural-language AI beyond recognized commands |
| Advanced AI conversation with browser tools | Optional compatible provider implemented and mocked in tests | Actual model server is not provisioned or connected |
| Existing Edge tab connector (no paid browser API) | Extension and UI implemented; simulated tests passing | Requires manual Edge installation, per-site consent, and real Facebook acceptance test |
| Avoid paid AI API charges | Default mode has no AI API calls | Railway hosting and external model compute may incur costs |
| Password rotation and session revocation | Implemented and automatically tested | Owner must perform private rotation in the web interface |
| Durable interrupted tasks | Implemented and automatically tested | Resumption requires owner review; no blind replay |
| Encrypted task history | Implemented and automatically tested | Browser profile and off-site backups not encrypted/verified |
| Browser sandbox for untrusted sites | **Blocked** | Current standard Railway runtime cannot launch Chromium sandboxed; container is not equivalent |
| Autonomous code review, editing, tests and PRs | **Missing** | Requires development tools, safe isolated execution and code-provider permissions |
| Safe arbitrary website logins | **Not approved** | Unsandboxed host, blocked third-party sites and credential risks |
| Windows Lite v0.5.0 downloadable installer | Released separately | Not integrated with cloud, low-spec user hardware unverified |
| iPad and phone responsive layout | Automated tests | Physical-device testing incomplete |
| Off-host backup and restore drill | **Missing** | Must verify encryption, rotation and recovery |
| Resource cost caps and external API billing | Partial | Runtime resource bills are separate from token counters |
| Release quality | Automated CI required | Live deployment and smoke tests required after every change |

## End-to-end acceptance scenario

From an iPad and Windows device, sign in; submit a natural-language task against an authorized public
test website; verify browser actions, approval before consequential actions, saved checkpoints and
an accurate outcome. Restart during a pending task; verify an interrupted state and no duplicate
external writes. On a test GitHub repo, propose a change, run isolated tests and create a draft PR
only after approval. Restore encrypted state from an independently held backup. Verify security
isolation, resource bills and recovery behavior. **This full scenario has not been completed.**
