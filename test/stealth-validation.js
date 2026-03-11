/**
 * Stealth Validation Test
 * Tests all 18 evasion points + Chrome flags against real detection sites.
 * 
 * Run: node test/stealth-validation.js
 */

const { connect } = require('../lib/cjs/index.js');

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

async function runTests() {
    console.log('\n\x1b[1m🛡️  Puppeteer-Really Stealth Validation\x1b[0m');
    console.log('='.repeat(50));

    let browser, page;

    try {
        console.log('\n\x1b[1m[1/4] Launching browser...\x1b[0m');
        const result = await connect({
            headless: false,
            turnstile: true,
            args: ['--start-maximized'],
            connectOption: { defaultViewport: null },
        });
        browser = result.browser;
        page = result.page;
        log(PASS, 'Browser launched successfully');
        passed++;

        // ============================================
        // TEST GROUP 1: JavaScript Stealth Evasions
        // ============================================
        console.log('\n\x1b[1m[2/4] Testing JavaScript Stealth Evasions...\x1b[0m');

        await page.goto('about:blank', { waitUntil: 'domcontentloaded' });

        // Test 1: navigator.webdriver
        const webdriver = await page.evaluate(() => navigator.webdriver);
        if (webdriver === undefined || webdriver === false) {
            log(PASS, `navigator.webdriver = ${webdriver}`);
            passed++;
        } else {
            log(FAIL, `navigator.webdriver = ${webdriver} (should be undefined)`);
            failed++;
        }

        // Test 2: chrome.runtime
        const chromeRuntime = await page.evaluate(() => {
            return {
                exists: !!window.chrome?.runtime,
                hasConnect: typeof window.chrome?.runtime?.connect === 'function',
                hasSendMessage: typeof window.chrome?.runtime?.sendMessage === 'function',
            };
        });
        if (chromeRuntime.exists && chromeRuntime.hasConnect && chromeRuntime.hasSendMessage) {
            log(PASS, 'chrome.runtime exists with connect/sendMessage');
            passed++;
        } else {
            log(FAIL, `chrome.runtime: ${JSON.stringify(chromeRuntime)}`);
            failed++;
        }

        // Test 3: chrome.app
        const chromeApp = await page.evaluate(() => !!window.chrome?.app?.getDetails);
        if (chromeApp) {
            log(PASS, 'chrome.app exists with getDetails');
            passed++;
        } else {
            log(FAIL, 'chrome.app missing');
            failed++;
        }

        // Test 4: chrome.csi
        const chromeCsi = await page.evaluate(() => typeof window.chrome?.csi === 'function');
        if (chromeCsi) {
            log(PASS, 'chrome.csi() exists');
            passed++;
        } else {
            log(FAIL, 'chrome.csi missing');
            failed++;
        }

        // Test 5: chrome.loadTimes
        const chromeLoadTimes = await page.evaluate(() => typeof window.chrome?.loadTimes === 'function');
        if (chromeLoadTimes) {
            log(PASS, 'chrome.loadTimes() exists');
            passed++;
        } else {
            log(FAIL, 'chrome.loadTimes missing');
            failed++;
        }

        // Test 6: navigator.plugins
        const pluginCount = await page.evaluate(() => navigator.plugins.length);
        if (pluginCount > 0) {
            log(PASS, `navigator.plugins.length = ${pluginCount}`);
            passed++;
        } else {
            log(WARN, `navigator.plugins.length = ${pluginCount} (may fail some detections)`);
            warnings++;
        }

        // Test 7: navigator.languages
        const languages = await page.evaluate(() => navigator.languages);
        if (languages && languages.length > 0) {
            log(PASS, `navigator.languages = ${JSON.stringify(languages)}`);
            passed++;
        } else {
            log(FAIL, 'navigator.languages is empty');
            failed++;
        }

        // Test 8: window.outerWidth/outerHeight
        const dimensions = await page.evaluate(() => ({
            outerWidth: window.outerWidth,
            outerHeight: window.outerHeight,
        }));
        if (dimensions.outerWidth > 0 && dimensions.outerHeight > 0) {
            log(PASS, `outerWidth=${dimensions.outerWidth}, outerHeight=${dimensions.outerHeight}`);
            passed++;
        } else {
            log(FAIL, `outerWidth/Height is 0 (headless leak)`);
            failed++;
        }

        // Test 9: WebGL vendor
        const webgl = await page.evaluate(() => {
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl');
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (!debugInfo) return { vendor: 'N/A', renderer: 'N/A' };
                return {
                    vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
                    renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
                };
            } catch (e) { return { vendor: 'error', renderer: 'error' }; }
        });
        if (!webgl.renderer.includes('SwiftShader') && !webgl.renderer.includes('llvmpipe')) {
            log(PASS, `WebGL: ${webgl.vendor} / ${webgl.renderer}`);
            passed++;
        } else {
            log(FAIL, `WebGL leaks headless: ${webgl.renderer}`);
            failed++;
        }

        // Test 10: navigator.connection
        const connection = await page.evaluate(() => !!navigator.connection?.effectiveType);
        if (connection) {
            log(PASS, 'navigator.connection exists');
            passed++;
        } else {
            log(WARN, 'navigator.connection missing (may not exist on all platforms)');
            warnings++;
        }

        // Test 11: navigator.hardwareConcurrency
        const cores = await page.evaluate(() => navigator.hardwareConcurrency);
        if (cores > 0) {
            log(PASS, `navigator.hardwareConcurrency = ${cores}`);
            passed++;
        } else {
            log(FAIL, 'navigator.hardwareConcurrency = 0');
            failed++;
        }

        // Test 12: navigator.deviceMemory
        const memory = await page.evaluate(() => navigator.deviceMemory);
        if (memory > 0) {
            log(PASS, `navigator.deviceMemory = ${memory}`);
            passed++;
        } else {
            log(WARN, 'navigator.deviceMemory undefined (not all browsers support this)');
            warnings++;
        }

        // Test 13: permissions.query
        const permsOk = await page.evaluate(async () => {
            try {
                const result = await navigator.permissions.query({ name: 'notifications' });
                return result.state !== undefined;
            } catch { return false; }
        });
        if (permsOk) {
            log(PASS, 'permissions.query(notifications) works');
            passed++;
        } else {
            log(FAIL, 'permissions.query throws or broken');
            failed++;
        }

        // Test 14: ghost-cursor available
        if (page.realCursor && page.realClick) {
            log(PASS, 'page.realCursor and page.realClick available');
            passed++;
        } else {
            log(FAIL, 'ghost-cursor not attached to page');
            failed++;
        }

        // ============================================
        // TEST GROUP 2: Bot Detection Sites
        // ============================================
        console.log('\n\x1b[1m[3/4] Testing against bot detection sites...\x1b[0m');

        // Test A: bot.sannysoft.com
        console.log('  → Testing bot.sannysoft.com...');
        try {
            await page.goto('https://bot.sannysoft.com/', { waitUntil: 'networkidle2', timeout: 30000 });
            await sleep(3000);

            const sannyResults = await page.evaluate(() => {
                const rows = document.querySelectorAll('table#fp2 tr');
                let results = {};
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 2) {
                        const key = cells[0]?.textContent?.trim();
                        const td = cells[1];
                        const passed = td?.classList?.contains('passed') ||
                            td?.style?.backgroundColor === 'rgb(144, 238, 144)' ||
                            td?.getAttribute('bgcolor') === 'lightgreen';
                        if (key) results[key] = passed;
                    }
                });
                return results;
            });

            const sannyKeys = Object.keys(sannyResults);
            if (sannyKeys.length > 0) {
                const sannyPassed = sannyKeys.filter(k => sannyResults[k]).length;
                const sannyFailed = sannyKeys.filter(k => !sannyResults[k]);

                if (sannyFailed.length === 0) {
                    log(PASS, `bot.sannysoft.com — All ${sannyPassed} tests passed!`);
                    passed++;
                } else {
                    log(WARN, `bot.sannysoft.com — ${sannyPassed}/${sannyKeys.length} passed, failed: ${sannyFailed.join(', ')}`);
                    warnings++;
                }
            } else {
                // Fallback: check the simpler table
                const simpleResults = await page.evaluate(() => {
                    const table = document.querySelector('table');
                    if (!table) return null;
                    const failedCells = table.querySelectorAll('td.failed');
                    const allCells = table.querySelectorAll('td[class]');
                    return { failed: failedCells.length, total: allCells.length };
                });
                if (simpleResults && simpleResults.failed === 0) {
                    log(PASS, `bot.sannysoft.com — No failed detections (${simpleResults.total} checked)`);
                    passed++;
                } else {
                    log(WARN, `bot.sannysoft.com — ${simpleResults?.failed || '?'} failures detected`);
                    warnings++;
                }
            }
        } catch (err) {
            log(WARN, `bot.sannysoft.com — Could not load: ${err.message.substring(0, 60)}`);
            warnings++;
        }

        // Test B: Brotector — SKIPPED (site deleted: kaliiiiiiiiii.github.io/brotector)
        log(INFO, 'Brotector — SKIPPED (site deleted)');

        // Test C: Infosimples fingerprint 
        console.log('  → Testing Infosimples detection...');
        try {
            await page.goto('https://infosimples.github.io/detect-headless/', { waitUntil: 'networkidle2', timeout: 30000 });
            await sleep(3000);

            const infosimplesResults = await page.evaluate(() => {
                const rows = document.querySelectorAll('tr');
                let pass = 0, fail = 0, failNames = [];
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 2) {
                        const name = cells[0]?.textContent?.trim();
                        const text = cells[1]?.textContent?.trim().toLowerCase();
                        if (text && (text.includes('headless') || text.includes('bot') || text.includes('automation'))) {
                            fail++;
                            failNames.push(name);
                        } else if (text) {
                            pass++;
                        }
                    }
                });
                return { pass, fail, failNames };
            });

            if (infosimplesResults.fail === 0) {
                log(PASS, `Infosimples — ${infosimplesResults.pass} checks passed, 0 detections`);
                passed++;
            } else {
                log(WARN, `Infosimples — ${infosimplesResults.fail} detections: ${infosimplesResults.failNames.join(', ')}`);
                warnings++;
            }
        } catch (err) {
            log(WARN, `Infosimples — Could not load: ${err.message.substring(0, 60)}`);
            warnings++;
        }

        // ============================================
        // TEST GROUP 3: Ghost Cursor Functionality
        // ============================================
        console.log('\n\x1b[1m[4/4] Testing ghost-cursor functionality...\x1b[0m');

        try {
            await page.goto('about:blank');
            await page.setContent(`
                <html><body>
                    <button id="testBtn" style="padding:20px;margin:50px;font-size:16px;">Click Me</button>
                    <div id="result"></div>
                    <script>
                        document.getElementById('testBtn').addEventListener('click', () => {
                            document.getElementById('result').textContent = 'CLICKED';
                        });
                    </script>
                </body></html>
            `);
            await sleep(500);

            // Test realClick
            await page.realClick('#testBtn');
            await sleep(500);

            const clickResult = await page.evaluate(() => document.getElementById('result').textContent);
            if (clickResult === 'CLICKED') {
                log(PASS, 'page.realClick() works — ghost-cursor clicked button');
                passed++;
            } else {
                log(FAIL, `page.realClick() did not trigger click event (result: "${clickResult}")`);
                failed++;
            }

            // Test realCursor.moveTo
            try {
                await page.realCursor.moveTo({ x: 200, y: 200 });
                log(PASS, 'page.realCursor.moveTo() works — Bézier mouse movement');
                passed++;
            } catch (cursorErr) {
                log(FAIL, `page.realCursor.moveTo() error: ${cursorErr.message}`);
                failed++;
            }

        } catch (err) {
            log(FAIL, `Ghost cursor test error: ${err.message}`);
            failed++;
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

    // ============================================
    // RESULTS SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(50));
    console.log('\x1b[1m📊 Results Summary\x1b[0m');
    console.log(`  ${PASS.replace(' PASS', '')} Passed:   ${passed}`);
    console.log(`  ${FAIL.replace(' FAIL', '')} Failed:   ${failed}`);
    console.log(`  ${WARN.replace(' WARN', '')} Warnings: ${warnings}`);
    console.log('='.repeat(50));

    if (failed === 0) {
        console.log('\n\x1b[32m🎉 All critical tests passed!\x1b[0m\n');
    } else {
        console.log(`\n\x1b[31m❌ ${failed} test(s) failed — review above.\x1b[0m\n`);
    }

    process.exit(failed > 0 ? 1 : 0);
}

runTests();
