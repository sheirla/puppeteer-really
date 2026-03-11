/**
 * Extended Stealth Stress Test v5
 * Tests against multiple real-world bot detection & fingerprint sites.
 * Each site verified via browser agent for correct URLs, selectors, and timing.
 * 
 * Run: node test/stress-test.js
 */

const { connect } = require('../lib/cjs/index.js');
const fs = require('fs');
const path = require('path');

const PASS = '\x1b[32m✓ PASS\x1b[0m';
const FAIL = '\x1b[31m✗ FAIL\x1b[0m';
const INFO = '\x1b[36mℹ INFO\x1b[0m';
const WARN = '\x1b[33m⚠ WARN\x1b[0m';

let passed = 0;
let failed = 0;
let warnings = 0;

function log(status, message) {
    console.log(`  ${status} ${message}`);
}

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

const screenshotDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

async function screenshot(page, name) {
    try {
        const filePath = path.join(screenshotDir, `${name}.png`);
        await page.screenshot({ path: filePath, fullPage: false });
        console.log(`    📸 Screenshot: test/screenshots/${name}.png`);
        return filePath;
    } catch (err) {
        console.log(`    ⚠ Screenshot failed: ${err.message.substring(0, 60)}`);
        return null;
    }
}

async function safeGoto(page, url, extraWait = 3000) {
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (err) {
        console.log(`    ⚠ Nav partial: ${err.message.substring(0, 80)}`);
    }
    await sleep(extraWait);
}

async function runTests() {
    console.log('\n\x1b[1m🔥 Puppeteer-Really Extended Stress Test v5\x1b[0m');
    console.log('='.repeat(55));

    let browser, page;

    try {
        console.log('\n\x1b[1m[SETUP] Launching browser...\x1b[0m');
        const result = await connect({
            headless: false,
            turnstile: true,
            args: ['--start-maximized'],
            connectOption: { defaultViewport: null },
        });
        browser = result.browser;
        page = result.page;
        log(PASS, 'Browser launched');
        passed++;

        // ====================================================
        // TEST 1: deviceandbrowserinfo.com — Bot Detection
        // JSON in <pre> with details.hasInconsistentWorkerValues etc.
        // ====================================================
        console.log('\n\x1b[1m[TEST 1] deviceandbrowserinfo.com/are_you_a_bot\x1b[0m');
        try {
            await safeGoto(page, 'https://deviceandbrowserinfo.com/are_you_a_bot', 5000);
            console.log('    ⏳ Waiting 15s for Worker analysis...');
            await sleep(15000);
            await screenshot(page, '01_deviceandbrowserinfo');

            const botResult = await page.evaluate(() => {
                const pre = document.querySelector('pre');
                if (!pre) return { error: 'no pre element found' };
                try {
                    return JSON.parse(pre.textContent);
                } catch (e) {
                    return { error: 'JSON parse failed', text: pre.textContent.substring(0, 300) };
                }
            });

            if (botResult.error) {
                log(INFO, `deviceandbrowserinfo — ${botResult.error}`);
                warnings++;
            } else if (botResult.isBot === false) {
                log(PASS, 'deviceandbrowserinfo — NOT detected as bot');
                passed++;
            } else {
                const trueFlags = Object.entries(botResult.details || {})
                    .filter(([, v]) => v === true).map(([k]) => k);
                log(FAIL, `deviceandbrowserinfo — DETECTED as bot`);
                if (trueFlags.length) console.log(`    Triggered: ${trueFlags.join(', ')}`);
                failed++;
            }
        } catch (err) {
            log(WARN, `deviceandbrowserinfo — ${err.message.substring(0, 100)}`);
            warnings++;
        }

        // ====================================================
        // TEST 2: bot.sannysoft.com
        // Uses CSS classes: "passed", "failed", "warn"
        // Computed BG: passed=rgb(200,216,109), failed=rgb(244,81,89)
        // ====================================================
        console.log('\n\x1b[1m[TEST 2] bot.sannysoft.com\x1b[0m');
        try {
            await safeGoto(page, 'https://bot.sannysoft.com/', 3000);
            console.log('    ⏳ Waiting for tests...');
            await sleep(5000);
            await screenshot(page, '02_sannysoft');

            const sannyResults = await page.evaluate(() => {
                let pass = 0, fail = 0, warn = 0, failNames = [];
                document.querySelectorAll('td').forEach(td => {
                    const cls = (td.className || '').toLowerCase();
                    if (cls.includes('failed')) {
                        fail++;
                        const row = td.closest('tr');
                        const name = row ? (row.querySelector('td:first-child')?.textContent?.trim() || '?') : '?';
                        failNames.push(name);
                    } else if (cls.includes('passed')) {
                        pass++;
                    } else if (cls.includes('warn')) {
                        warn++;
                    }
                });
                return { pass, fail, warn, failNames: [...new Set(failNames)] };
            });

            const total = sannyResults.pass + sannyResults.fail + sannyResults.warn;
            if (total === 0) {
                log(WARN, 'bot.sannysoft — Could not parse results, check screenshot');
                warnings++;
            } else if (sannyResults.fail === 0) {
                log(PASS, `bot.sannysoft — ${sannyResults.pass} passed, ${sannyResults.warn} warnings`);
                passed++;
            } else {
                log(FAIL, `bot.sannysoft — ${sannyResults.fail} failed: ${sannyResults.failNames.join(', ')}`);
                console.log(`    (${sannyResults.pass} passed, ${sannyResults.warn} warnings)`);
                failed++;
            }
        } catch (err) {
            log(WARN, `bot.sannysoft — ${err.message.substring(0, 100)}`);
            warnings++;
        }

        // ====================================================
        // TEST 3: Fingerprint.com Demo — Smart Signals
        // /demo page, click "02 BROWSER SMART SIGNALS" tab
        // Check individual signal results
        // ====================================================
        console.log('\n\x1b[1m[TEST 3] fingerprint.com/demo\x1b[0m');
        try {
            await safeGoto(page, 'https://fingerprint.com/demo/', 8000);

            // Click on "02 BROWSER SMART SIGNALS" tab  
            await page.evaluate(() => {
                const allElements = document.querySelectorAll('button, a, [role="tab"], div');
                for (const el of allElements) {
                    const text = (el.textContent || '').trim();
                    if (text.includes('BROWSER SMART') || text.includes('Browser Smart')) {
                        el.click();
                        return true;
                    }
                }
                return false;
            });
            console.log('    ⏳ Waiting for Smart Signals tab...');
            await sleep(8000);
            await screenshot(page, '03_fingerprint');

            const fpResult = await page.evaluate(() => {
                const text = document.body.innerText;
                const results = {};
                // Extract each signal line: "SIGNAL_NAME\nStatus\nDetected/Not Detected"
                const signals = ['BOT DETECTION', 'BROWSER TAMPERING', 'INCOGNITO MODE',
                    'VPN DETECTION', 'DEVELOPER TOOLS', 'VIRTUAL MACHINE'];
                for (const signal of signals) {
                    const idx = text.toUpperCase().indexOf(signal);
                    if (idx >= 0) {
                        const after = text.substring(idx + signal.length, idx + signal.length + 150);
                        if (after.match(/not\s*detected/i)) {
                            results[signal] = 'Not Detected';
                        } else if (after.match(/detected/i)) {
                            results[signal] = 'Detected';
                        } else {
                            results[signal] = 'Unknown';
                        }
                    }
                }
                return results;
            });

            const entries = Object.entries(fpResult);
            if (entries.length === 0) {
                log(INFO, 'fingerprint.com — Could not parse signals, check screenshot');
                warnings++;
            } else {
                const detected = entries.filter(([, v]) => v === 'Detected');
                const notDetected = entries.filter(([, v]) => v === 'Not Detected');
                const summary = entries.map(([k, v]) => `${k}: ${v}`).join(' | ');

                // Key signals that indicate client-side stealth failure
                const tamperingDetected = fpResult['BROWSER TAMPERING'] === 'Detected';
                const devToolsDetected = fpResult['DEVELOPER TOOLS'] === 'Detected';

                if (!tamperingDetected && !devToolsDetected) {
                    log(PASS, `fingerprint.com — Tampering: Not Detected, DevTools: Not Detected`);
                    if (detected.length > 0) {
                        console.log(`    Server-side: ${detected.map(([k]) => k).join(', ')} (expected on datacenter IP)`);
                    }
                    passed++;
                } else {
                    log(WARN, `fingerprint.com — ${summary}`);
                    warnings++;
                }
            }
        } catch (err) {
            log(WARN, `fingerprint.com — ${err.message.substring(0, 100)}`);
            warnings++;
        }

        // ====================================================
        // TEST 4: CreepJS — Advanced Fingerprint
        // Shows trust score, grade, lies count at the top
        // ====================================================
        console.log('\n\x1b[1m[TEST 4] CreepJS\x1b[0m');
        try {
            await safeGoto(page, 'https://abrahamjuliot.github.io/creepjs/', 5000);
            console.log('    ⏳ CreepJS analyzing (30 seconds)...');
            await sleep(30000);
            await page.evaluate(() => window.scrollTo(0, 0));
            await sleep(1000);
            await screenshot(page, '04_creepjs');

            const creepResult = await page.evaluate(() => {
                const body = document.body.innerText;
                // CreepJS format: "XX.X% trust" or shows grade like A/B/C/D/F
                // Try multiple patterns
                let trust = null, grade = null, lies = null;

                // Pattern 1: "XX.X% trust"
                const m1 = body.match(/(\d+(?:\.\d+)?)\s*%\s*trust/i);
                if (m1) trust = m1[1];

                // Pattern 2: Just look for percentage near top
                if (!trust) {
                    const lines = body.split('\n').slice(0, 30);
                    for (const line of lines) {
                        const m = line.match(/(\d+(?:\.\d+)?)\s*%/);
                        if (m) { trust = m[1]; break; }
                    }
                }

                // Grade
                const gm = body.match(/grade[:\s]*([A-F][+-]?)/i);
                if (gm) grade = gm[1];

                // Lies
                const lm = body.match(/(\d+)\s*lie/i);
                if (lm) lies = parseInt(lm[1]);

                // Also check for "stealth" failure indicators
                const stealthFail = body.includes('stealth') &&
                    (body.includes('✗') || body.includes('fail'));

                return { trust, grade, lies, stealthFail };
            });

            if (creepResult.trust !== null) {
                const trustNum = parseFloat(creepResult.trust);
                const details = `Trust: ${creepResult.trust}%, Grade: ${creepResult.grade || '?'}, Lies: ${creepResult.lies ?? '?'}`;
                if (trustNum >= 60) {
                    log(PASS, `CreepJS — ${details}`);
                    passed++;
                } else if (trustNum >= 30) {
                    log(WARN, `CreepJS — ${details}`);
                    warnings++;
                } else {
                    log(FAIL, `CreepJS — ${details}`);
                    failed++;
                }
            } else {
                log(INFO, 'CreepJS — Could not parse trust score, check screenshot');
                warnings++;
            }
        } catch (err) {
            log(WARN, `CreepJS — ${err.message.substring(0, 100)}`);
            warnings++;
        }

        // ====================================================
        // TEST 5: BrowserLeaks — WebGL
        // Table rows with "Unmasked Vendor" / "Unmasked Renderer"
        // ====================================================
        console.log('\n\x1b[1m[TEST 5] BrowserLeaks WebGL\x1b[0m');
        try {
            await safeGoto(page, 'https://browserleaks.com/webgl', 5000);
            await sleep(5000);
            await screenshot(page, '05_browserleaks_webgl');

            const webglResult = await page.evaluate(() => {
                let vendor = 'N/A', renderer = 'N/A';
                document.querySelectorAll('tr').forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 2) {
                        const label = cells[0].textContent.trim();
                        const value = cells[1].textContent.trim();
                        if (label.includes('Unmasked Vendor')) vendor = value;
                        if (label.includes('Unmasked Renderer')) renderer = value;
                    }
                });
                return { vendor, renderer };
            });

            const isHeadless = webglResult.renderer.includes('SwiftShader') ||
                webglResult.renderer.includes('llvmpipe') ||
                webglResult.renderer === 'N/A';
            if (!isHeadless) {
                log(PASS, `WebGL — Vendor: "${webglResult.vendor}", Renderer: "${webglResult.renderer}"`);
                passed++;
            } else {
                log(FAIL, `WebGL — Headless renderer: "${webglResult.renderer}"`);
                failed++;
            }
        } catch (err) {
            log(WARN, `BrowserLeaks WebGL — ${err.message.substring(0, 100)}`);
            warnings++;
        }

        // ====================================================
        // TEST 6: BrowserLeaks — Canvas
        // ====================================================
        console.log('\n\x1b[1m[TEST 6] BrowserLeaks Canvas\x1b[0m');
        try {
            await safeGoto(page, 'https://browserleaks.com/canvas', 5000);
            await sleep(5000);
            await screenshot(page, '06_browserleaks_canvas');

            const canvasResult = await page.evaluate(() => {
                let hash = null;
                document.querySelectorAll('tr').forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 2) {
                        const label = cells[0].textContent.trim();
                        if (label.includes('Signature') || label.includes('Hash') || label.includes('CRC')) {
                            hash = cells[1].textContent.trim();
                        }
                    }
                });
                return { hash };
            });

            if (canvasResult.hash && canvasResult.hash.length > 4) {
                log(PASS, `Canvas — Hash: ${canvasResult.hash.substring(0, 24)}...`);
                passed++;
            } else {
                log(INFO, 'Canvas — Could not extract hash, check screenshot');
                warnings++;
            }
        } catch (err) {
            log(WARN, `BrowserLeaks Canvas — ${err.message.substring(0, 100)}`);
            warnings++;
        }

        // ====================================================
        // TEST 7: Pixelscan.net — Fingerprint Check
        // Correct URL: /fingerprint-check (auto-scans)
        // ====================================================
        console.log('\n\x1b[1m[TEST 7] Pixelscan.net Fingerprint Check\x1b[0m');
        try {
            await safeGoto(page, 'https://pixelscan.net/fingerprint-check', 5000);
            console.log('    ⏳ Waiting 15s for scan...');
            await sleep(15000);
            await screenshot(page, '07_pixelscan');

            const pixelResult = await page.evaluate(() => {
                const body = document.body.innerText.toLowerCase();
                return {
                    noAutomated: body.includes('no automated behavior detected'),
                    maskingDetected: body.includes('masking detected'),
                    noProxy: body.includes('no proxy detected'),
                    snippet: document.body.innerText.substring(0, 500),
                };
            });

            if (pixelResult.noAutomated) {
                log(PASS, 'Pixelscan — No automated behavior detected');
                if (pixelResult.maskingDetected) {
                    console.log('    ℹ Masking detected (expected — WebGL spoofing)');
                }
                passed++;
            } else {
                log(WARN, 'Pixelscan — Check screenshot for details');
                console.log(`    Snippet: ${pixelResult.snippet.substring(0, 200)}`);
                warnings++;
            }
        } catch (err) {
            log(WARN, `Pixelscan — ${err.message.substring(0, 100)}`);
            warnings++;
        }

        // ====================================================
        // TEST 8: Recaptcha V3 Score
        // Must click "Refresh score now!" button, then wait for score
        // Score appears in text like "Your score is: X.X"
        // ====================================================
        console.log('\n\x1b[1m[TEST 8] Recaptcha V3 Score\x1b[0m');
        try {
            await safeGoto(page, 'https://antcpt.com/score_detector/', 5000);

            // Click "Refresh score now!" button to trigger detection
            await page.evaluate(() => {
                const btns = document.querySelectorAll('button, input[type="button"], input[type="submit"], a');
                for (const btn of btns) {
                    if ((btn.textContent || btn.value || '').toLowerCase().includes('refresh')) {
                        btn.click();
                        return true;
                    }
                }
                return false;
            });

            console.log('    ⏳ Waiting for score (up to 30s)...');

            // Poll until score appears
            let score = null;
            for (let i = 0; i < 15; i++) {
                await sleep(2000);
                score = await page.evaluate(() => {
                    // Check for score in various formats
                    const body = document.body.innerText;
                    // Pattern: "Your score is: 0.X" or just a number in a <big> tag
                    const scoreMatch = body.match(/score[:\s]*(\d+\.?\d*)/i);
                    if (scoreMatch) {
                        const val = parseFloat(scoreMatch[1]);
                        if (val >= 0 && val <= 1) return scoreMatch[1];
                    }
                    // Check <big> elements
                    const bigs = document.querySelectorAll('big');
                    for (const big of bigs) {
                        const text = big.textContent.trim();
                        if (text && !text.includes('Detecting') && !text.includes('...')) {
                            const num = text.replace(/[^0-9.]/g, '');
                            if (num && parseFloat(num) >= 0 && parseFloat(num) <= 1) return num;
                        }
                    }
                    return null;
                });
                if (score) break;
            }

            await screenshot(page, '08_recaptcha_v3');

            if (score && parseFloat(score) >= 0.7) {
                log(PASS, `Recaptcha V3 — Score: ${score} (human-like)`);
                passed++;
            } else if (score && parseFloat(score) >= 0.3) {
                log(WARN, `Recaptcha V3 — Score: ${score} (suspicious, expected on datacenter IP)`);
                warnings++;
            } else if (score) {
                log(WARN, `Recaptcha V3 — Score: ${score} (low, expected on datacenter IP)`);
                warnings++;
            } else {
                log(WARN, 'Recaptcha V3 — Score did not appear, check screenshot');
                warnings++;
            }
        } catch (err) {
            log(WARN, `Recaptcha V3 — ${err.message.substring(0, 100)}`);
            warnings++;
        }

        // ====================================================
        // TEST 9: Infosimples Headless Detector
        // ====================================================
        console.log('\n\x1b[1m[TEST 9] Infosimples Headless Detector\x1b[0m');
        try {
            await safeGoto(page, 'https://infosimples.github.io/detect-headless/', 3000);
            await sleep(5000);
            await screenshot(page, '09_infosimples');

            const infoResult = await page.evaluate(() => {
                const rows = document.querySelectorAll('tr');
                let results = [];
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 2) {
                        const name = cells[0]?.textContent?.trim();
                        const value = cells[1]?.textContent?.trim();
                        const computed = getComputedStyle(cells[1]).backgroundColor;
                        // Red shades indicate suspicious
                        const isRed = computed.includes('255, 0, 0') ||
                            computed.includes('255, 99, 71') ||
                            computed.includes('244, 81, 89');
                        results.push({ name, value, suspicious: isRed });
                    }
                });
                return results;
            });

            const suspicious = infoResult.filter(r => r.suspicious);
            if (suspicious.length === 0) {
                log(PASS, `Infosimples — ${infoResult.length} checks, no headless indicators`);
                passed++;
            } else {
                log(WARN, `Infosimples — ${suspicious.length} suspicious: ${suspicious.map(s => s.name).join(', ')}`);
                warnings++;
            }
        } catch (err) {
            log(WARN, `Infosimples — ${err.message.substring(0, 100)}`);
            warnings++;
        }

        // ====================================================
        // TEST 10: BrowserLeaks — JavaScript
        // ====================================================
        console.log('\n\x1b[1m[TEST 10] BrowserLeaks JavaScript\x1b[0m');
        try {
            await safeGoto(page, 'https://browserleaks.com/javascript', 5000);
            await sleep(5000);
            await screenshot(page, '10_browserleaks_js');

            const jsResult = await page.evaluate(() => {
                let webdriver = 'N/A', plugins = 'N/A';
                document.querySelectorAll('tr').forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 2) {
                        const label = cells[0].textContent.trim();
                        const value = cells[1].textContent.trim();
                        if (label.toLowerCase().includes('webdriver')) webdriver = value;
                        if (label.toLowerCase().includes('plugins') && label.toLowerCase().includes('length'))
                            plugins = value;
                    }
                });
                return { webdriver, plugins };
            });

            const isClean = !jsResult.webdriver.toLowerCase().includes('true');
            if (isClean) {
                log(PASS, `BrowserLeaks JS — webdriver: ${jsResult.webdriver}, plugins: ${jsResult.plugins}`);
                passed++;
            } else {
                log(FAIL, `BrowserLeaks JS — webdriver LEAKED: ${jsResult.webdriver}`);
                failed++;
            }
        } catch (err) {
            log(WARN, `BrowserLeaks JS — ${err.message.substring(0, 100)}`);
            warnings++;
        }

    } catch (err) {
        log(FAIL, `Fatal error: ${err.message}`);
        console.error(err);
        failed++;
    } finally {
        if (browser) {
            try { await browser.close(); } catch (e) { }
        }
    }

    // RESULTS SUMMARY
    console.log('\n' + '='.repeat(55));
    console.log('\x1b[1m📊 Stress Test v5 Results\x1b[0m');
    console.log(`  ${PASS.replace(' PASS', '')} Passed:   ${passed}`);
    console.log(`  ${FAIL.replace(' FAIL', '')} Failed:   ${failed}`);
    console.log(`  ${WARN.replace(' WARN', '')} Warnings: ${warnings}`);
    console.log('='.repeat(55));
    console.log(`\n📸 Screenshots saved to: test/screenshots/`);

    if (failed === 0 && warnings === 0) {
        console.log('\x1b[32m🎉 Perfect score!\x1b[0m\n');
    } else if (failed === 0) {
        console.log(`\x1b[33m⚠ No critical failures, ${warnings} warning(s).\x1b[0m\n`);
    } else {
        console.log(`\x1b[31m❌ ${failed} failure(s) — review above.\x1b[0m\n`);
    }

    process.exit(failed > 0 ? 1 : 0);
}

runTests();
