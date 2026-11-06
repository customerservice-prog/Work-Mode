# Work-Mode — AI Browser Assistant

**Work-Mode is being developed as one private assistant for iPad, phone, Windows, and inexpensive laptops.** The cross-device edition is an **unreleased prototype** in a feature branch; it has not been deployed to a public cloud URL.

## What you'll use

On any device, open a secure HTTPS Work-Mode website and sign in. Chat with the assistant, watch a remote browser, approve consequential actions, and take manual control for logins through a touchscreen. On iPhone, iPad or Android, add the page to your Home Screen.

The AI and website browser run on a hosted computer, **not on your phone/iPad/laptop**. This removes the need to install Ollama or a huge AI model on every device. It does require hosting and metered AI resources; it does not consume ChatGPT Work credits.

## Existing Windows download

The already-published [Work-Mode Desktop v0.3.0 installer](https://github.com/customerservice-prog/Work-Mode/releases/tag/v0.3.0) remains a **local-only early release**. It is not yet the cross-device edition. Auto-Coder is separate and untouched.

## Cross-device edition status

The feature branch adds:
- Responsive mobile/tablet chat and browser views
- A web app manifest and safe-to-install Home Screen shell
- Password-gated hosted access, protected API endpoints, and session cookies
- A browser running on the server, streamed as screenshots to your device
- Touch/click, typing, navigation, scrolling, and keyboard controls for the remote browser
- Private browser-session and history storage on a mounted host volume
- A host container configuration and automated authentication tests

**It has NOT yet been published as a working cloud service.** Before real use it needs secure hosting, persistent encrypted storage, an isolated browser sandbox, a private HTTPS URL, and a funded AI provider. It also needs end-to-end testing against real sites on actual iPad and phone devices.

See [Cross-device architecture and deployment requirements](docs/CROSS-DEVICE.md).

## Security and costs

Only run hosted mode on a protected HTTPS address with strong, privately configured host secrets. The browser may contain sensitive signed-in website sessions; do not expose it publicly. A screenshot is not proof that a site action completed. High-impact agent clicks require approval. The current prototype is intended for one trusted owner, not multiple accounts.

Remote browsing and AI calls require a cloud computer and AI provider. There is no legitimate way to guarantee unlimited cost-free cloud use. Usage limits and browser security need verification before business use.

## Development

Install Node 22+ and dependencies with `npm install`; the local-only application runs using `npm start` and the existing Windows version builds with `npm run desktop:build`.

For cloud experimentation, `WORKMODE_CLOUD_MODE=1` requires `WORKMODE_CLOUD_ORIGIN` (exact HTTPS origin), `WORKMODE_CLOUD_PASSWORD` (16+ characters), `WORKMODE_SESSION_SECRET` (32+ characters), a private `OPENAI_API_KEY`, and a secure host providing TLS, persistent storage and Chromium sandbox support. Never commit these values to GitHub.

Do not enable automatic production deployment just because this code builds: security and real-device integration tests are mandatory.
