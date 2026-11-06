# Work-Mode for Windows — self-contained offline edition

**This version is designed for an inexpensive Windows computer.** It is not ChatGPT Work or a feature-for-feature replacement.

## Install and use

1. Open [Work-Mode Releases](https://github.com/customerservice-prog/Work-Mode/releases) and download **Work-Mode-Setup-0.4.0-x64.exe** when the new release appears.
2. Install the Windows app. It creates a Work-Mode desktop shortcut.
3. Open Work-Mode and type your instruction. **Built-in AI is already included**. You do not need Ollama, a model download, a terminal, GitHub commands, or an AI API key.
4. Click **Open Browser** to control a separate Microsoft Edge window. Sign into websites yourself when needed.
5. Review progress and approve consequential actions. Never assume an action succeeded unless verified.

This Windows prerelease is **unsigned**, so Windows may display a publisher warning. Only run the installer downloaded from this repository's Releases page.

## What makes it suitable for lower-cost PCs

- The installer contains a Windows CPU-only llama.cpp engine and **two small offline models**.
- The application checks installed RAM automatically. Machines with under 7.5 GB use **Lite Qwen3 0.6B** (approximately 397 MB model); machines with at least 7.5 GB use **Standard Qwen3 1.7B** (approximately 1.28 GB model).
- Below 3.5 GB of total RAM, the included AI will not start to avoid overloading Windows. Machines running out of *available* memory are asked to close other programs.
- The AI starts only when you ask it to work and shuts down after about six minutes of inactivity to free RAM.
- The desktop window fits smaller screens instead of requiring a large monitor.
- A **Test included AI** self-test is available through the local application API to check that the packaged model actually generates a reply.

**The new installer is substantially larger** because it includes both models and the engine. It is a one-install experience, not a zero-download experience.

### Quality limitations

A 0.6B or 1.7B offline model is substantially less capable than ChatGPT Work on complex websites. It may be slow on an older CPU, misunderstand site controls, or fail to follow multi-step instructions. It only uses webpage text and controls, not screenshot vision. Work-Mode must disclose when it cannot verify completion. Use it for simpler supervised tasks first.

### Optional more capable mode

In **AI Settings**, choose **OpenAI API** and enter a separately billed API key if you want a stronger remote model. This is optional and **not included in the ChatGPT Plus subscription**. Set spending limits with the API provider.

## Privacy and security

- Your browser and offline model run locally; the app's server binds only to 127.0.0.1.
- Website credentials should be entered by you into the separate browser, not into AI chat.
- Secret-looking form values are redacted in text snapshots, and form controls are masked in screenshots passed to a paid visual model.
- Work-Mode requests approval before identified high-impact actions.
- Browser sessions and task history stay on your PC.
- The offline model server uses a randomized access key and loopback-only access.
- The model is not authorized to perform unverified destructive actions on its own.

## Developer notes

The installer is produced by the Windows GitHub Actions workflow. The workflow downloads pinned, checksum-verified llama.cpp and GGUF model artifacts **during the build**, packages them through electron-builder `extraResources`, and performs a real local AI inference check against the packaged Windows app.

The model weights and binary are not stored in the Git repository. `desktop-runtime/` is ignored and generated only during the Windows packaging job.

### Third-party software

llama.cpp (MIT): https://github.com/ggml-org/llama.cpp/releases/tag/b12179

Qwen3 0.6B (Apache 2.0, Unsloth GGUF): https://huggingface.co/unsloth/Qwen3-0.6B-GGUF

Qwen3 1.7B (Apache 2.0, ggml-org GGUF): https://huggingface.co/ggml-org/Qwen3-1.7B-GGUF

The installer includes relevant license notices.

## Project scope

The cross-device experiment remains on its own feature branch and is not part of this Windows release. Auto-Coder remains separate and unchanged. This release is focused only on a lightweight Windows desktop experience.
