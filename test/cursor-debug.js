const { connect } = require('../lib/cjs/index.js');

(async () => {
    let browser;
    try {
        const result = await connect({ headless: false, turnstile: false });
        browser = result.browser;
        const page = result.page;

        await page.goto('about:blank');
        await page.setContent(`
            <html><body>
                <button id="testBtn" style="padding:30px;margin:50px;font-size:16px;">Click Me</button>
                <div id="result">waiting</div>
                <script>
                    document.getElementById('testBtn').addEventListener('click', () => {
                        document.getElementById('result').textContent = 'CLICKED';
                    });
                </script>
            </body></html>
        `);
        await new Promise(r => setTimeout(r, 1000));

        console.log('--- Cursor Debug ---');
        console.log('typeof realCursor:', typeof page.realCursor);
        console.log('typeof realClick:', typeof page.realClick);
        console.log('typeof realCursor.moveTo:', typeof page.realCursor.moveTo);
        console.log('typeof realCursor.move:', typeof page.realCursor.move);
        console.log('typeof realCursor.click:', typeof page.realCursor.click);

        // Test moveTo
        console.log('\n--- moveTo test ---');
        await page.realCursor.moveTo({ x: 100, y: 100 });
        console.log('moveTo({x:100,y:100}) OK');

        // Test click
        console.log('\n--- realClick test ---');
        await page.realClick('#testBtn');
        await new Promise(r => setTimeout(r, 500));
        const txt = await page.evaluate(() => document.getElementById('result').textContent);
        console.log('Click result:', txt);
        console.log(txt === 'CLICKED' ? '✓ PASS' : '✗ FAIL');

        await browser.close();
        process.exit(0);
    } catch (e) {
        console.error('ERROR:', e.message);
        console.error(e.stack);
        if (browser) await browser.close();
        process.exit(1);
    }
})();
