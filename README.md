# Work-Mode — Windows Desktop Assistant

**Work-Mode is your separate, local AI browser assistant.** It is not an official ChatGPT Work product. It lets you type instructions, watch a controlled browser, and approve high-impact actions.

## Install it on your Windows desktop (no coding)

1. Open **[Work-Mode Releases](https://github.com/customerservice-prog/Work-Mode/releases)**.
2. Download the file named **Work-Mode-Setup-0.2.0-x64.exe** (when the installer build appears).
3. Double-click the downloaded **.exe** and follow Windows installation prompts.
4. Open **Work-Mode** using the new desktop shortcut or Start menu.
5. Click **AI Settings** and choose either **OpenAI API** (metered, requires API key) or **Local Ollama** (no model API fee; requires separate local Ollama installation).
6. Click **Open Browser**. An Edge window opens; log in to the site yourself once, then tell Work-Mode what you want it to do.

**That's it.** You do not need GitHub, a code editor, Node.js, Railway, terminal commands, or a ZIP of source code to use the desktop app. The installer is built from this source using GitHub Actions.

The desktop installer is **not code-signed** yet and may trigger Windows SmartScreen. Do not run unexpected files from unverified publishers. Check that your download came from this exact repository and its Releases page. Early versions are prereleases and should be supervised.

### What the desktop app does

- Opens a chat window on your computer.
- Operates a **separate Microsoft Edge automation profile** using Playwright; this does not silently take over your normal signed-in Edge tabs.
- Navigates sites, reads pages, clicks, types, scrolls, selects dropdown options, and switches tabs.
- Keeps browser login cookies locally so you do not sign into the same site every session (where permitted).
- Shows screenshots, actions, verification status, and task history.
- Requires approval for potentially consequential actions (sending, deleting, purchasing, releasing phone numbers).
- Allows stopping tasks and switching AI providers from **AI Settings**.

### What it cannot guarantee

This is an **early local-browser MVP**, not yet a complete ChatGPT Work replacement. Login challenges, CAPTCHAs, complex workflows and some websites may need manual help, and the app has not yet passed a real Google Voice end-to-end task. It does not provide remote cloud computer use, all third-party connectors, or continuous unattended jobs. Never trust a claimed completion without checking the result.

### AI cost choices

**OpenAI API:** Paid separately from your ChatGPT subscription. You enter an API key in the app. Set a usage budget in your API account.

**Local Ollama:** Download [Ollama for Windows](https://ollama.com/download/windows), run `ollama pull qwen3:8b` once in the Windows Terminal, and select **Free local AI** in the app. Large model download and adequate PC memory are required. Local AI may be substantially less reliable on complex sites.

Neither uses ChatGPT Work credits. Building the Windows installer with GitHub Actions is separate from Railway; **Railway is not required for the desktop app**.

### Safety & privacy

- The local HTTP backend binds only to `127.0.0.1`.
- Browser cookies are stored locally under your Windows profile; passwords and verification codes should be entered by you in the browser, not into agent chat.
- App AI keys and history are stored on the computer, never in this public source repository.
- The desktop shell does not grant webpage Node.js access, and links open in the system browser.
- Work-Mode does not install a browser extension, spy on your normal tabs, or access unrelated computer files.
- No legitimate automated browser agent can guarantee safe or correct execution on every website. Use approvals and supervise financial or account changes.

## For developers

Run locally from source with `npm install`, `npx playwright install chromium`, `npm start`, and visit `http://127.0.0.1:3168`. For desktop development, use `npm run desktop` after installing dependencies; the packaged Windows desktop variant uses the installed Microsoft Edge channel.

Build an unsigned Windows installer on Windows with `npm run desktop:build`. The repository workflow `.github/workflows/windows-installer.yml` builds the same installer on GitHub's Windows runner and publishes its verified executable to GitHub Releases.

## Legacy project boundaries

This repository is new and independent. Auto-Coder remains separate and untouched. We reviewed BryanTheBrain, CloneAI, Genesis Loop, Mirror-OS, and Phone Super Assistant for reusable ideas. They have not been deleted. See [legacy review](docs/LEGACY-REVIEW.md).

Copyright © Work-Mode. Early testing release.
