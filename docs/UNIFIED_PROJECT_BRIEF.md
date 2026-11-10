# Work-Mode: Unified Project Brief — November 9, 2026

This is the consolidated specification from the previous Railway recovery, free/offline desktop, browser-extension and Facebook-posting conversations. **One project, two delivery modes.** Do not treat this as a claim that the project is complete.

## 1. Non-negotiable direction

- **Now:** Keep Work-Mode available as a password-protected web application through Railway, usable from the user's current low-powered Windows PC in Microsoft Edge. The user must not need to run the unfinished desktop installer on that PC.
- **Later:** Continue the downloadable standalone Windows desktop app independently, so it can be used when the owner has hardware that can run it.
- **Longer term:** Provide mobile/iPad access where possible. Remote Railway browsing can be viewed from mobile; controlling the Windows PC's Edge tabs requires an active, connected Edge extension on that PC and cannot be assumed to run while the computer is off.
- **Pricing preference:** No mandatory external paid AI API, no API key setup, no per-message model charges, no subscription, no unnecessary product-imposed task/message quotas. Do not silently connect a metered provider or provision extra paid infrastructure. **Railway and any self-hosted inference server consume real compute and may incur charges; unlimited free hosted AI cannot be promised.**
- **Security:** Preserve login and private storage, require confirmation for posts/sends/purchases and other consequential actions. Do not remove protective limits that prevent unsafe or runaway activity merely to advertise "unlimited."
- **Scope boundaries:** Do not delete the Railway Work-Mode service or its volume to save costs without explicit new authorization. Do not mix Work-Mode with Auto-Coder, ClipConvert, Bajo Mundo TV, Friendly Party Rental websites, or other projects.

## 2. Current components (source of truth, not claims of full acceptance)

| Component | Location / branch | State |
| --- | --- | --- |
| Hosted web UI | https://work-mode-production.up.railway.app/ | Railway project and production service restored; deployed source is `feature/cross-device-cloud`; last checked service was **sleeping after inactivity**, not deleted, and still had one mounted persistent volume |
| Built-in cloud browser | Railway Playwright Chromium | Basic deterministic commands and remote UI exist; browser process sandbox is disabled on the current Railway host, so avoid sensitive logins and untrusted sites |
| Browser instruction parser | `lib/basic-commands.js` | Supports known commands; not a self-directing AI model |
| Existing Edge tabs | `extension/`, `public/edge-tabs.js` | Opt-in MV3 extension built and simulated-test covered; requires owner to install locally and authorize selected website/tab |
| Facebook group workflow | `public/edge-facebook.js` | Draft, final approval, and post-verification logic implemented; **no real Facebook group post independently verified yet** |
| Direct extension ZIP download | https://work-mode-production.up.railway.app/downloads/work-mode-edge-connector.zip | Added to Railway website to bypass unreliable ChatGPT sandbox links; request must be checked in a real Edge download |
| Optional advanced AI API | `lib/hosted-ai.js` | Supports OpenAI API or compatible self-hosted model endpoint, **neither is configured** as of November 9, 2026 |
| Job history and login | `lib/task-journal.js`, `lib/history.js`, `lib/hosted-auth.js` | Encrypted job checkpoints, history migration, password rotation, and restart interruptions implemented and tested |
| Windows offline version | GitHub `main`; release `v0.5.0` | Installer published; not an automatic replacement for Railway or proven on owner's current low-spec computer |

## 3. Decisions about conflicting old conversations

- Earlier assistant **incorrectly retired the Railway service and deleted its volume**, despite the owner's requirement to use the hosted website now. That decision is superseded. The website was rebuilt and restored. Never repeat a retirement without specific owner approval.
- Earlier assistant repeatedly claimed browser task completion based only on a deployment, a screenshot, or a simulated test. That is not enough. **Verify the actual external result.**
- Older notes directing the owner to use the Windows app immediately are superseded: **web now, desktop later.**
- The existing Edge session and Railway Chromium are independent. Do not expect the cloud browser to inherit Facebook login cookies. The Edge extension needs one-time installation and site authorization; future web app updates normally only require refreshing the Railway site.
- A successful Post-button click is not proof of a published Facebook post. Distinguish **published**, **pending group approval**, and **unverified/unknown** and avoid automatic repeat submissions.

## 4. Minimum acceptance goal (next milestone)

A supervised, consented **single Facebook group post from the user's existing Microsoft Edge Facebook session**:

1. Owner downloads and installs the Edge extension once from the Railway-hosted ZIP link.
2. Owner chooses the correct Facebook account and group tab and grants that website's permission.
3. Work-Mode's **My Edge tabs → Check extension → Read selected tab** confirms the selected tab and visible controls.
4. Owner specifies a group URL and the exact text/video to post. A valid draft is prepared and shown.
5. Owner approves the final publish/send action **once**.
6. Check the actual Facebook group feed or its approval status; record a post permalink or distinguish pending/unconfirmed. No false success claims and no retry if outcome is uncertain.

This must be a **real-site acceptance test**, not merely a mock browser test. Note that the current draft workflow supports text; user-requested video/Reel sharing may require additional implementation and a separately verified end-to-end test.

## 5. Remaining major engineering gaps

1. **Usability:** Confirm current Railway website login, direct ZIP download, Edge installation and same-origin bridge against the owner's actual Edge browser. Diagnose real UI failures rather than adding unrelated features.
2. **Facebook workflow:** Test with owner's permission in a real Facebook group and adapt to UI changes, including sharing an authorized Reel as needed. Maintain explicit approval and no duplicate posts.
3. **Autonomous AI:** No currently connected no-subscription inference engine capable of arbitrary natural-language planning. Self-hosting an open-weight model would avoid per-message API fees but requires sufficient machine resources and possibly paid hosting. Do not advertise free unlimited cloud inference.
4. **Safer browser isolation:** Replace or contain the unsandboxed Railway Chromium design before treating it as safe for sensitive accounts or arbitrary untrusted sites.
5. **Full coding agent:** GitHub file edits, isolated code execution/testing, and verified/approved deployments are not built into the hosted Work-Mode product.
6. **Recovery, compliance and security:** Verify off-host backups, recovery drills, browser-profile privacy, password rotation on the running site, resource/billing monitoring, and physical Windows/mobile/iPad tests.
7. **Limits:** Distinguish actual metered API token limits (only relevant if paid API is configured) from currently implemented local safety/action limits such as `MAX_STEPS`. User prefers no artificial usage quotas, but removing safety checks or pretending compute is unlimited is not acceptable.

## 6. Change and verification rules

- Railway production uses `feature/cross-device-cloud`. Develop on a separate feature branch, run CI, then promote only passing code. Avoid touching GitHub `main` or Windows release artifacts unless explicitly working on desktop.
- Protect the existing Railway production volume and environment secrets. Never paste credentials into chat, issue comments, or source control.
- A CI green check proves code tests passed, not that Facebook posted, the extension installed on the owner's device, or a cloud model is available.
- For each change, report three separate states: **coded**, **deployed**, and **live end-to-end verified**.
- Keep instructions short and actionable; do not send the user back and forth between unrelated desktop/Railway paths.

## Links

- [Hosted Work-Mode](https://work-mode-production.up.railway.app/)
- [Edge extension ZIP direct download](https://work-mode-production.up.railway.app/downloads/work-mode-edge-connector.zip)
- [Cloud source branch](https://github.com/customerservice-prog/Work-Mode/tree/feature/cross-device-cloud)
- [Windows Lite v0.5.0 release](https://github.com/customerservice-prog/Work-Mode/releases/tag/v0.5.0)
- [Existing acceptance matrix](ACCEPTANCE.md)
- [Cloud operations](OPERATIONS.md)
