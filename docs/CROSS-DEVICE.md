# Work-Mode cross-device architecture — current beta

## What currently runs

One password-protected website is deployed at https://work-mode-production.up.railway.app/.
Edge, mobile Safari and other browsers are lightweight remote controllers; Chromium and the
Node service run on Railway with a mounted `/data` volume. Basic browser commands are
available without an AI API key. The standalone Windows offline Lite v0.5.0 installer
is independent; it has not been merged with the hosted architecture.

## Model and autonomy boundary

- No AI model is currently included in the Railway web service.
- Optional advanced model access supports either `OPENAI_API_KEY` (separately billed)
  or `WORKMODE_AI_BASE_URL` plus `WORKMODE_AI_MODEL` (an independently running
  OpenAI Responses-compatible model such as recent Ollama).
- The self-hosted option uses the full stateless tool transcript. It does not send
  screenshot input to a text-only model or assume that omitted token usage is free.
- Inference requires hardware and may incur cloud hosting charges. There is no
  unlimited free cloud computing guarantee.

## Privacy and isolation

- Host and HTTPS origin validation, password-gated APIs, private HttpOnly sessions,
  persistent session hashes, login throttling and current-password-verified private rotation.
- Cloud job checkpoints and task history encrypted with a key derived from the
  session secret; never rotate that secret without an explicit migration plan.
- Browser profile persists separately and has NOT been independently verified
  encrypted at rest. Backups and restore drills are not complete.
- Network restrictions block local/private HTTP targets, WebSocket private targets,
  and service-worker request interception.
- Chromium process sandbox cannot start on the present Railway standard container.
  It runs as a non-root process inside Railway container isolation. This does not
  provide production-grade untrusted site isolation. Avoid sensitive logins.
- High-impact browser actions require owner approval. After a restart, pending
  tasks are marked interrupted and must be reviewed before retry; automatic
  duplicate submissions are not performed.

## Operations and acceptance

See [Operations](OPERATIONS.md) for configuration, tests, and recovery, and
[Acceptance checklist](ACCEPTANCE.md) for the exact remaining production gaps.

**The full autonomous coding-agent workflow, isolated browser worker, real
self-hosted model, off-host backups and physical-device acceptance testing
remain incomplete.** Do not call this beta a finished substitute for ChatGPT Work.
