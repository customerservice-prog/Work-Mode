# Work-Mode Edge Tab Connector (beta)

This Manifest V3 Edge/Chrome extension connects **one website tab that you explicitly approve** to the existing Work-Mode website at https://work-mode-production.up.railway.app/.

**No paid browser API or OpenAI API key is required** for its supported commands. Your Edge browser performs clicks and text entry locally. Railway is only the existing Work-Mode website; no browser-tab service or AI subscription is created. The extension does **not** add an AI model or autonomous decision-making.

## Install in Microsoft Edge (unpacked beta)

1. In the successful GitHub Actions build, download the **Work-Mode-Edge-Connector** artifact from **Artifacts** and extract its ZIP file.
2. Open `edge://extensions` in Microsoft Edge.
3. Turn on **Developer mode**, click **Load unpacked**, and select the extracted folder containing `manifest.json`.
4. Open the Facebook tab (or another website tab) that you want Work-Mode to use. Click the Extensions puzzle icon and then **Work-Mode Edge Tab Connector**. Select **Allow Work-Mode to use this tab** and approve the *specific site* permission.
5. Open https://work-mode-production.up.railway.app/ in a separate Edge tab. Sign in, click **My Edge tabs**, and click **Check extension**.
6. Select **Read selected tab**. It should display the tab's title and visible controls, while leaving password fields protected.

If Check extension times out, confirm you installed the extension, approved the relevant website tab, and reloaded the Work-Mode tab.

## Facebook group-post acceptance test

1. Open and sign in to Facebook in Edge yourself. Choose the correct Facebook account/profile.
2. Give the extension access to that **specific Facebook tab** using its icon.
3. In Work-Mode's **My Edge tabs** section, enter a **specific Facebook group URL** and the exact post text.
4. Choose **Prepare group post**. Inspect the Facebook tab to verify the message, destination and active account.
5. Click **Review & publish** and approve the final confirmation.
6. The app attempts a single click. It only reports **VERIFIED** when it detects a new, matching group-feed article. Otherwise it returns **pending approval** or **unconfirmed** and does not retry automatically.

A simulated Facebook-style page is exercised by CI, **not the real Facebook website**. Live Facebook availability and group membership/approval rules can change. Never call a post published solely because the Post button was clicked.

## Security and limitations

- Only the website origin `https://work-mode-production.up.railway.app` is allowed to send extension commands.
- The extension does not read browser cookies or reveal stored passwords. It refuses password, OTP, card, and API-secret fields.
- You must explicitly select the target tab and approve website access in Edge. A tab from a different origin needs a new approval.
- Publishing, submitting, sending and other consequential clicks require explicit confirmation in the Work-Mode interface.
- Edge internal pages, extensions, PDFs, cross-origin frames, anti-bot challenges, restricted groups, and unpredictable website UI may not be supported.
- Sites that move or rename controls may need manual interaction. No silent retries or bulk posting.
- The browser and extension still require the existing Edge computer to be on. This mode won't magically give Railway access to Edge tabs when the computer is shut off.
- The Work-Mode website itself must be trusted; the extension exposes text from explicitly approved tabs to that site's page JavaScript. Avoid sensitive data or important accounts until the connector receives independent security review.

This extension is in beta. It is not distributed through the Microsoft Edge Add-ons store and must be installed manually.
