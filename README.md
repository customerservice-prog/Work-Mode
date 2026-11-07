# Work-Mode Lite — Free offline Windows browser assistant

Work-Mode Lite is an experimental, locally running Windows assistant built for low-cost computers. **There is no Railway service, no external AI API, no account or API key, and no per-message/monthly model credit quota.** It is not equivalent to ChatGPT Work and may fail on complicated websites.

## Use

1. Download Work-Mode Lite v0.5.0 from the repository's Releases page once the Windows test build is marked successful.
2. Install on 64-bit Windows. The app includes a compact Qwen3 0.6B GGUF model and the llama.cpp CPU engine.
3. Open Work-Mode. To check the AI or share troubleshooting details, click **System check**, then **Test offline AI** or **Copy diagnostics**.
4. Start with the command `Open https://www.example.com and tell me the page title`. This basic browser operation works **without loading AI**.
5. For complex instructions, Work-Mode attempts to use the small offline model. Review every action and its verification.

**No extra Ollama installation, subscription, cloud service, or developer terminal is needed.** The Lite installer is smaller than v0.4.0 because it contains only the 0.6B model rather than both the 0.6B and 1.7B models. It is still a substantial download.

### Important limitations

- 64-bit Windows and Microsoft Edge are required. Machines with less than about **3.5 GB installed RAM** cannot run the offline AI, but can attempt the basic browser commands.
- Limited available RAM, older CPUs, Windows antivirus, and crowded browser tabs may prevent local inference from starting.
- The offline model is **much weaker than ChatGPT Work**. It can struggle with complex reasoning, site layout changes, long tasks, and tool calling. Never assume a website was updated unless the browser actually verifies it.
- Work-Mode keeps safeguards such as action approvals and finite steps *per task* to prevent runaway loops; these are not billing or monthly usage quotas. You can start more tasks without buying credits.
- No AI service can promise infinite throughput or capability on finite hardware. Electricity, internet access, and the hardware itself are separate costs.
- This prerelease is unsigned, so Windows may display a publisher warning. Only download from the GitHub repository.

## Troubleshooting

If Work-Mode opens but struggles, go to **System check → Copy diagnostics** and paste the output into the chat. It contains memory totals and local engine status, but no API key or website password. **Test offline AI** separately checks whether the included model responds on your specific PC.

The old Railway cloud deployment and its storage were retired. Development is focused on the Windows app only. The GitHub source and unrelated projects, including Auto-Coder, remain separate.

## Third-party notices

- llama.cpp, MIT: https://github.com/ggml-org/llama.cpp/releases/tag/b12179
- Qwen3 0.6B GGUF, Apache 2.0: https://huggingface.co/unsloth/Qwen3-0.6B-GGUF

The Windows build downloads SHA-256-verified third-party components into the installer and includes license notices. Work-Mode Lite is not affiliated with OpenAI or ChatGPT Work.
