# Puppeteer Really

> Maintained fork of [puppeteer-real-browser](https://github.com/zfcsoftware/puppeteer-real-browser) with updated dependencies and enhanced stealth features.

This package prevents Puppeteer from being detected as a bot in services like Cloudflare and allows you to pass captchas without any problems. It behaves like a real browser.

## What's New in v2.0.0

- ⬆️ **Updated `rebrowser-puppeteer-core`** from v23.3.1 → v24.8.1
- ⬆️ **Updated `ghost-cursor`** from v1.3.0 → v1.4.2
- ⬆️ **Updated `chrome-launcher`** from v1.1.2 → v1.2.1
- 🛡️ **Additional stealth patches:**
  - `navigator.webdriver` hidden
  - `chrome.runtime` spoofed to look like real browser
  - `permissions.query` fixed for notifications
  - Extra Chrome flags: `--disable-blink-features=AutomationControlled`, `--disable-infobars`
- 🔒 **Safer flag manipulation** — bounds checking to prevent crashes if chrome-launcher changes defaults
- 🔌 **Safe plugin handling** — `onPageCreated` existence check before calling
- 🔐 **Null-safe proxy** — no crash when proxy object is empty

## Installation

```bash
npm install ./puppeteer-really
```

## Usage

### ESM

```js
import { connect } from "puppeteer-really";

const { page, browser } = await connect({
  headless: false,
  turnstile: true,
});

await page.goto("https://example.com");
// Use page.realClick for ghost-cursor clicking
await page.realClick("button");
await browser.close();
```

### CommonJS

```js
const { connect } = require("puppeteer-really");

async function main() {
  const { page, browser } = await connect({
    headless: false,
    turnstile: true,
  });

  await page.goto("https://example.com");
  await page.realClick("button");
  await browser.close();
}

main();
```

## Options

```js
const { browser, page } = await connect({
  headless: false,            // false (recommended), true, "new", "shell"
  args: [],                   // Extra Chromium flags
  customConfig: {},           // chrome-launcher options (chromePath, userDataDir, etc.)
  turnstile: true,            // Auto-solve Cloudflare Turnstile
  connectOption: {            // puppeteer.connect() options
    defaultViewport: null,
  },
  disableXvfb: false,         // Linux: set true to show browser
  ignoreAllFlags: false,      // Override all default flags
  plugins: [],                // puppeteer-extra plugins
  proxy: {                    // Proxy configuration
    host: "proxy-host",
    port: 8080,
    username: "user",         // Optional
    password: "pass",         // Optional
  },
});
```

## Ghost Cursor (Human-like Mouse)

The library includes [ghost-cursor](https://github.com/Xetera/ghost-cursor) for realistic mouse movements:

```js
// Recommended: use realClick instead of page.click
await page.realClick("button.submit");

// Access full ghost-cursor API
await page.realCursor.move("input#search");
await page.realCursor.click("a.link");
```

## Puppeteer-Extra Plugins

```js
import { connect } from "puppeteer-really";

const { page, browser } = await connect({
  plugins: [
    require("puppeteer-extra-plugin-click-and-wait")(),
  ],
});
```

> ⚠️ Some plugins like `puppeteer-extra-plugin-anonymize-ua` may cause detection. Test carefully.

## Tests

```bash
npm run esm_test   # ESM tests
npm run cjs_test   # CJS tests
```

Tests cover: DrissionPage Detector, Brotector, Cloudflare WAF, Cloudflare Turnstile, Fingerprint JS, Datadome, and Recaptcha V3 Score.

## Credits

- Original: [zfcsoftware/puppeteer-real-browser](https://github.com/zfcsoftware/puppeteer-real-browser)
- [rebrowser-patches](https://github.com/rebrowser/rebrowser-patches) — Runtime patches for anti-detection
- [ghost-cursor](https://github.com/Xetera/ghost-cursor) — Human-like cursor movements
- [chrome-launcher](https://github.com/GoogleChrome/chrome-launcher) — Chrome process management

## License

MIT — See [LICENSE](LICENSE.md)

## Disclaimer

This software is for educational and informational purposes only. Users are responsible for their own usage. Not intended to bypass security measures for malicious purposes.
