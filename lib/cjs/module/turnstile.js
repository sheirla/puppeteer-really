/**
 * Enhanced Turnstile solver — uses ghost-cursor for natural clicking
 * when realCursor is available, falls back to mouse.click otherwise.
 */
const checkTurnstile = ({ page }) => {
    return new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => { resolve(false) }, 5000);

        try {
            const elements = await page.$$('[name="cf-turnstile-response"]');

            if (elements.length <= 0) {
                // Fallback: look for turnstile widget by dimensions
                const coordinates = await page.evaluate(() => {
                    let coordinates = [];

                    // First pass: strict matching (margin=0, padding=0, width 290-310)
                    document.querySelectorAll('div').forEach(item => {
                        try {
                            let rect = item.getBoundingClientRect();
                            let css = window.getComputedStyle(item);
                            if (css.margin == "0px" && css.padding == "0px" && rect.width > 290 && rect.width <= 310 && !item.querySelector('*')) {
                                coordinates.push({ x: rect.x, y: rect.y, w: rect.width, h: rect.height });
                            }
                        } catch (err) { }
                    });

                    // Second pass: relaxed matching (just width)
                    if (coordinates.length <= 0) {
                        document.querySelectorAll('div').forEach(item => {
                            try {
                                let rect = item.getBoundingClientRect();
                                if (rect.width > 290 && rect.width <= 310 && !item.querySelector('*')) {
                                    coordinates.push({ x: rect.x, y: rect.y, w: rect.width, h: rect.height });
                                }
                            } catch (err) { }
                        });
                    }

                    return coordinates;
                });

                for (const item of coordinates) {
                    try {
                        // Add small random offset for natural clicking
                        let x = item.x + 25 + Math.random() * 10;
                        let y = item.y + item.h / 2 + (Math.random() * 4 - 2);

                        if (page.realCursor && typeof page.realCursor.moveTo === 'function') {
                            // Use ghost-cursor for natural mouse movement
                            await page.realCursor.moveTo({ x, y });
                            await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
                        }
                        await page.mouse.click(x, y);
                    } catch (err) { }
                }
                clearTimeout(timeout);
                return resolve(true);
            }

            // Found turnstile response elements — click the parent widget
            for (const element of elements) {
                try {
                    const parentElement = await element.evaluateHandle(el => el.parentElement);
                    const box = await parentElement.boundingBox();
                    if (!box) continue;

                    let x = box.x + 25 + Math.random() * 10;
                    let y = box.y + box.height / 2 + (Math.random() * 4 - 2);

                    if (page.realCursor && typeof page.realCursor.moveTo === 'function') {
                        await page.realCursor.moveTo({ x, y });
                        await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
                    }
                    await page.mouse.click(x, y);
                } catch (err) { }
            }
            clearTimeout(timeout);
            resolve(true);
        } catch (err) {
            clearTimeout(timeout);
            resolve(false);
        }
    });
}

module.exports = { checkTurnstile }