const { createCursor } = require('ghost-cursor');
const { checkTurnstile } = require('./turnstile.js');
const kill = require('tree-kill');

/**
 * Comprehensive stealth evasions — injected into every new document.
 * Covers all vectors from puppeteer-extra-plugin-stealth and more.
 */
function getStealthScript() {
    return () => {
        // ========================================
        // 0. Native function disguise utility
        // ========================================
        const nativeToStringStore = new Map();
        function disguiseAsNative(fn, nativeName) {
            nativeToStringStore.set(fn, `function ${nativeName || fn.name || ''}() { [native code] }`);
            return fn;
        }

        // ========================================
        // 1. navigator.webdriver — primary detection vector
        // ========================================
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });
        if (navigator.__proto__) {
            delete navigator.__proto__.webdriver;
        }

        // ========================================
        // 2. Chrome Runtime — must exist in real Chrome
        // ========================================
        if (!window.chrome) window.chrome = {};
        if (!window.chrome.runtime) {
            window.chrome.runtime = {
                connect: function () { return {} },
                sendMessage: function () { },
                id: undefined,
                onConnect: { addListener: function () { }, removeListener: function () { } },
                onMessage: { addListener: function () { }, removeListener: function () { } },
            };
        }

        // ========================================
        // 3. chrome.app — present in real Chrome
        // ========================================
        if (!window.chrome.app) {
            window.chrome.app = {
                isInstalled: false,
                InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
                RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
                getDetails: function () { return null },
                getIsInstalled: function () { return false },
                installState: function (cb) { if (cb) cb('not_installed') },
            };
        }

        // ========================================
        // 4. chrome.csi — exists in real Chrome
        // ========================================
        if (!window.chrome.csi) {
            window.chrome.csi = function () {
                return {
                    onloadT: Date.now(),
                    startE: Date.now(),
                    pageT: Math.random() * 1000 + 500,
                    tran: 15,
                };
            };
        }

        // ========================================
        // 5. chrome.loadTimes — exists in real Chrome
        // ========================================
        if (!window.chrome.loadTimes) {
            window.chrome.loadTimes = function () {
                return {
                    commitLoadTime: Date.now() / 1000,
                    connectionInfo: 'http/1.1',
                    finishDocumentLoadTime: Date.now() / 1000 + Math.random(),
                    finishLoadTime: Date.now() / 1000 + Math.random(),
                    firstPaintAfterLoadTime: 0,
                    firstPaintTime: Date.now() / 1000 + Math.random() * 0.5,
                    navigationType: 'Other',
                    npnNegotiatedProtocol: 'unknown',
                    requestTime: Date.now() / 1000 - Math.random(),
                    startLoadTime: Date.now() / 1000 - Math.random(),
                    wasAlternateProtocolAvailable: false,
                    wasFetchedViaSpdy: false,
                    wasNpnNegotiated: false,
                };
            };
        }

        // ========================================
        // 6. navigator.plugins — headless has empty plugins
        // ========================================
        if (navigator.plugins.length === 0) {
            const fakePluginData = [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', mimeType: 'application/x-google-chrome-pdf' },
                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', mimeType: 'application/pdf' },
                { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', mimeType: 'application/x-nacl' },
            ];
            const fakePluginArray = Object.create(PluginArray.prototype);
            const plugins = fakePluginData.map((p, i) => {
                const plugin = Object.create(Plugin.prototype);
                Object.defineProperties(plugin, {
                    name: { value: p.name, enumerable: true },
                    filename: { value: p.filename, enumerable: true },
                    description: { value: p.description, enumerable: true },
                    length: { value: 1, enumerable: true },
                    0: { value: { type: p.mimeType, suffixes: '', description: p.description, enabledPlugin: plugin } },
                });
                return plugin;
            });
            Object.defineProperties(fakePluginArray, {
                length: { value: plugins.length, enumerable: true },
                ...plugins.reduce((acc, p, i) => ({ ...acc, [i]: { value: p, enumerable: true } }), {}),
                item: { value: (i) => plugins[i] || null },
                namedItem: { value: (name) => plugins.find(p => p.name === name) || null },
                refresh: { value: () => { } },
            });
            Object.defineProperty(navigator, 'plugins', { get: () => fakePluginArray });
        }

        // ========================================
        // 7. navigator.languages — must be non-empty
        // ========================================
        if (!navigator.languages || navigator.languages.length === 0) {
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });
        }

        // ========================================
        // 8. navigator.permissions.query — notifications leak
        // ========================================
        try {
            const originalQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
            const patchedQuery = disguiseAsNative(function query(parameters) {
                if (parameters.name === 'notifications') {
                    return Promise.resolve({ state: Notification.permission });
                }
                return originalQuery(parameters);
            }, 'query');
            Object.defineProperty(window.navigator.permissions, 'query', {
                value: patchedQuery,
                writable: true,
                configurable: true,
            });
        } catch (e) { }

        // ========================================
        // 9. window.outerWidth/outerHeight — 0 in headless
        // ========================================
        if (window.outerWidth === 0) {
            Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth });
        }
        if (window.outerHeight === 0) {
            Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight + 85 });
        }

        // ========================================
        // 10. MouseEvent screenX/screenY — CDP detection fix
        // ========================================
        Object.defineProperty(MouseEvent.prototype, 'screenX', {
            get: function () { return this.clientX + window.screenX; }
        });
        Object.defineProperty(MouseEvent.prototype, 'screenY', {
            get: function () { return this.clientY + window.screenY; }
        });

        // ========================================
        // 11. iframe.contentWindow — cross-origin detection
        // ========================================
        try {
            const iframeProto = HTMLIFrameElement.prototype;
            const origContentWindow = Object.getOwnPropertyDescriptor(iframeProto, 'contentWindow');
            if (origContentWindow) {
                Object.defineProperty(iframeProto, 'contentWindow', {
                    get: function () {
                        const iframeWindow = origContentWindow.get.call(this);
                        if (!iframeWindow) return iframeWindow;
                        if (!iframeWindow.chrome) {
                            try { iframeWindow.chrome = window.chrome; } catch (e) { }
                        }
                        return iframeWindow;
                    }
                });
            }
        } catch (e) { }

        // ========================================
        // 12. WebGL Vendor/Renderer — hide "SwiftShader"
        // ========================================
        try {
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function (param) {
                if (param === 37445) return 'Intel Inc.';
                if (param === 37446) return 'Intel Iris OpenGL Engine';
                return getParameter.call(this, param);
            };
            if (typeof WebGL2RenderingContext !== 'undefined') {
                const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
                WebGL2RenderingContext.prototype.getParameter = function (param) {
                    if (param === 37445) return 'Intel Inc.';
                    if (param === 37446) return 'Intel Iris OpenGL Engine';
                    return getParameter2.call(this, param);
                };
            }
        } catch (e) { }

        // ========================================
        // 13. Notification.permission — prevent "denied" leak
        // ========================================
        try {
            if (Notification.permission === 'denied') {
                Object.defineProperty(Notification, 'permission', { get: () => 'default' });
            }
        } catch (e) { }

        // ========================================
        // 14. navigator.connection — present in real Chrome
        // ========================================
        if (!navigator.connection) {
            Object.defineProperty(navigator, 'connection', {
                get: () => ({
                    effectiveType: '4g',
                    rtt: 50,
                    downlink: 10,
                    saveData: false,
                    onchange: null,
                    addEventListener: function () { },
                    removeEventListener: function () { },
                }),
            });
        }

        // ========================================
        // 15. navigator.platform — ensure consistent
        // ========================================
        if (!navigator.platform || navigator.platform === '') {
            Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
        }

        // ========================================
        // 16. navigator.hardwareConcurrency — prevent 0
        // ========================================
        if (!navigator.hardwareConcurrency || navigator.hardwareConcurrency === 0) {
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
        }

        // ========================================
        // 17. navigator.deviceMemory — prevent undefined
        // ========================================
        if (!navigator.deviceMemory) {
            Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        }

        // ========================================
        // 18. Function.prototype.toString — native disguise + sourceURL removal
        // ========================================
        try {
            const origFunc = Function.prototype.toString;
            const patchedToString = function toString() {
                if (nativeToStringStore.has(this)) {
                    return nativeToStringStore.get(this);
                }
                const result = origFunc.call(this);
                return result.replace(/\/\/# sourceURL=[^\n]+/g, '');
            };
            nativeToStringStore.set(patchedToString, 'function toString() { [native code] }');
            Function.prototype.toString = patchedToString;
        } catch (e) { }

        // ========================================
        // 18b. navigator.userAgentData — ensure OS version consistency
        // ========================================
        try {
            if (navigator.userAgentData) {
                const originalUAData = navigator.userAgentData;
                const originalGetHighEntropyValues = originalUAData.getHighEntropyValues.bind(originalUAData);
                const patchedGetHEV = disguiseAsNative(function getHighEntropyValues(hints) {
                    return originalGetHighEntropyValues(hints).then(function (result) {
                        if (result.platform === 'Windows') {
                            result.platformVersion = '10.0.0';
                        }
                        return result;
                    });
                }, 'getHighEntropyValues');
                Object.defineProperty(originalUAData, 'getHighEntropyValues', {
                    value: patchedGetHEV,
                    writable: true,
                    configurable: true,
                });
            }
        } catch (e) { }

        // ========================================
        // 19. Web Worker Consistency — prevent hasInconsistentWorkerValues
        // ========================================
        try {
            const mainPlatform = navigator.platform || 'Win32';
            const mainConcurrency = navigator.hardwareConcurrency || 4;
            const mainMemory = navigator.deviceMemory || 8;
            const mainLangs = JSON.stringify(navigator.languages || ['en-US', 'en']);

            const mainUA = navigator.userAgent || '';

            const workerPatchCode = `;(function(){
                try{Object.defineProperty(navigator,'webdriver',{get:()=>undefined})}catch(e){}
                try{Object.defineProperty(navigator,'platform',{get:()=>'${mainPlatform}'})}catch(e){}
                try{Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>${mainConcurrency}})}catch(e){}
                try{Object.defineProperty(navigator,'deviceMemory',{get:()=>${mainMemory}})}catch(e){}
                try{Object.defineProperty(navigator,'languages',{get:()=>${mainLangs}})}catch(e){}
                try{Object.defineProperty(navigator,'userAgent',{get:()=>'${mainUA.replace(/'/g, "\\'")}'})}catch(e){}
                try{
                    if(typeof WebGLRenderingContext!=='undefined'){
                        var gp=WebGLRenderingContext.prototype.getParameter;
                        WebGLRenderingContext.prototype.getParameter=function(p){
                            if(p===37445)return'Intel Inc.';
                            if(p===37446)return'Intel Iris OpenGL Engine';
                            return gp.call(this,p);
                        };
                    }
                }catch(e){}
                try{
                    if(typeof WebGL2RenderingContext!=='undefined'){
                        var gp2=WebGL2RenderingContext.prototype.getParameter;
                        WebGL2RenderingContext.prototype.getParameter=function(p){
                            if(p===37445)return'Intel Inc.';
                            if(p===37446)return'Intel Iris OpenGL Engine';
                            return gp2.call(this,p);
                        };
                    }
                }catch(e){}
            })();\n`;

            const OriginalBlob = window.Blob;
            window.Blob = function (parts, options) {
                if (options && options.type &&
                    (options.type.includes('javascript') || options.type.includes('ecmascript'))) {
                    const newParts = [workerPatchCode, ...(parts || [])];
                    return new OriginalBlob(newParts, options);
                }
                return new OriginalBlob(parts, options);
            };
            window.Blob.prototype = OriginalBlob.prototype;
            try {
                Object.defineProperty(window.Blob, 'toString', {
                    value: OriginalBlob.toString.bind(OriginalBlob),
                    configurable: true,
                });
                Object.defineProperty(window.Blob, 'name', {
                    value: 'Blob',
                    configurable: true,
                });
                Object.defineProperty(window.Blob, Symbol.hasInstance, {
                    value: (instance) => instance instanceof OriginalBlob,
                    configurable: true,
                });
            } catch (e) { }

            const OriginalWorker = window.Worker;
            window.Worker = function (scriptURL, options) {
                if (options && options.type === 'module') {
                    return new OriginalWorker(scriptURL, options);
                }
                try {
                    if (typeof scriptURL === 'string' &&
                        !scriptURL.startsWith('blob:') &&
                        !scriptURL.startsWith('data:')) {
                        const patchBlob = new OriginalBlob(
                            [workerPatchCode + 'importScripts("' + new URL(scriptURL, location.href).href + '");'],
                            { type: 'application/javascript' }
                        );
                        const patchedURL = URL.createObjectURL(patchBlob);
                        const worker = new OriginalWorker(patchedURL, options);
                        setTimeout(() => URL.revokeObjectURL(patchedURL), 30000);
                        return worker;
                    }
                } catch (e) { }
                return new OriginalWorker(scriptURL, options);
            };
            window.Worker.prototype = OriginalWorker.prototype;
            try {
                Object.defineProperty(window.Worker, 'toString', {
                    value: OriginalWorker.toString.bind(OriginalWorker),
                    configurable: true,
                });
                Object.defineProperty(window.Worker, 'name', {
                    value: 'Worker',
                    configurable: true,
                });
            } catch (e) { }
        } catch (e) { }

        // ========================================
        // 20. Error stack trace cleaning — hide CDP internals
        // ========================================
        try {
            const originalPrepareStackTrace = Error.prepareStackTrace;
            Error.prepareStackTrace = function (error, stack) {
                const filteredStack = stack.filter(frame => {
                    const fn = frame.getFileName() || '';
                    return !fn.includes('pptr:') &&
                        !fn.includes('__puppeteer_evaluation_script__') &&
                        !fn.includes('DevTools');
                });
                if (originalPrepareStackTrace) {
                    return originalPrepareStackTrace(error, filteredStack);
                }
                return error + '\n' + filteredStack.map(f => '    at ' + f.toString()).join('\n');
            };
        } catch (e) { }
    };
}

async function pageController({ browser, page, proxy, turnstile, xvfbsession, pid, plugins, killProcess = false, chrome }) {

    let solveStatus = turnstile;

    page.on('close', () => {
        solveStatus = false;
    });

    browser.on('disconnected', async () => {
        solveStatus = false;
        if (killProcess === true) {
            if (xvfbsession) try { xvfbsession.stopSync() } catch (err) { }
            if (chrome) try { chrome.kill() } catch (err) { console.log(err); }
            if (pid) try { kill(pid, 'SIGKILL', () => { }) } catch (err) { }
        }
    });

    async function turnstileSolver() {
        while (solveStatus) {
            await checkTurnstile({ page }).catch(() => { });
            await new Promise(r => setTimeout(r, 1000));
        }
        return;
    }

    turnstileSolver();

    if (proxy && proxy.username && proxy.password) {
        await page.authenticate({ username: proxy.username, password: proxy.password });
    }

    if (plugins && plugins.length > 0) {
        for (const plugin of plugins) {
            if (typeof plugin.onPageCreated === 'function') {
                plugin.onPageCreated(page);
            }
        }
    }

    // Inject all stealth evasions before any page load
    await page.evaluateOnNewDocument(getStealthScript());

    const cursor = createCursor(page);
    page.realCursor = cursor;
    page.realClick = cursor.click.bind(cursor);
    page.realMove = cursor.move.bind(cursor);
    page.realMoveTo = cursor.moveTo.bind(cursor);

    return page;
}

module.exports = { pageController }