// Background service worker
//
// Auto-fire scripts are registered with the chrome.userScripts API. Unlike injecting
// a <script> tag from a content script, user scripts are injected by the browser
// itself, so they also run on sites with a strict Content-Security-Policy (github.com etc).
console.log('[Script Injector] Background service worker started');

const DEFAULT_DATA = {
  groups: [
    {
      id: 'group_example',
      name: 'Example Group',
      websites: ['example.com', 'www.example.*'],
      scripts: [
        {
          id: 'script_example',
          name: 'Welcome Script',
          code: 'console.log("Script Injector is working!");',
          autoFire: true,
          enabled: true
        }
      ],
      enabled: true
    }
  ]
};

// Initialize storage if empty
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Script Injector] Extension installed/updated');

  const { scriptInjectorData } = await chrome.storage.local.get('scriptInjectorData');
  if (!scriptInjectorData) {
    await chrome.storage.local.set({ scriptInjectorData: DEFAULT_DATA });
    console.log('[Script Injector] Initialized with default data');
  }
  queueSync();
});

chrome.runtime.onStartup.addListener(queueSync);

// Any change made in the popup re-registers the auto-fire scripts
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.scriptInjectorData) queueSync();
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sync') {
    queueSync().then(sendResponse);
    return true; // keep the channel open for the async response
  }
});

// Serialize syncs so overlapping unregister/register calls can't race
let syncChain = Promise.resolve();
function queueSync() {
  syncChain = syncChain.then(syncUserScripts, syncUserScripts);
  return syncChain;
}

async function syncUserScripts() {
  if (!isUserScriptsAvailable()) {
    console.warn('[Script Injector] User scripts are disabled. Enable "Allow User Scripts" in chrome://extensions → Details.');
    return { ok: false, reason: 'userScripts-disabled' };
  }

  const { scriptInjectorData } = await chrome.storage.local.get('scriptInjectorData');
  const groups = (scriptInjectorData && scriptInjectorData.groups) || [];
  const userScripts = [];

  groups.forEach(group => {
    if (group.enabled === false) return;

    const targets = (group.websites || []).map(patternToTarget).filter(Boolean);
    if (targets.length === 0) return;

    (group.scripts || []).forEach(script => {
      if (script.enabled === false || !script.autoFire || !script.code) return;

      // One registration per pattern: matches and includeGlobs are ANDed, so
      // patterns can't share a registration without narrowing each other.
      targets.forEach((target, i) => {
        userScripts.push({
          id: `${group.id}::${script.id}::${i}`,
          ...target,
          js: [
            // Separate entry so the log still prints if the user code has a syntax error
            { code: `console.log("[Script Injector] Auto-firing:", ${JSON.stringify(script.name)});` },
            { code: script.code }
          ],
          runAt: 'document_end',
          world: scriptWorld(script)
        });
      });
    });
  });

  try {
    await chrome.userScripts.unregister();
    if (userScripts.length > 0) {
      await chrome.userScripts.register(userScripts);
    }
    console.log(`[Script Injector] Registered ${userScripts.length} auto-fire script(s)`);
    return { ok: true, count: userScripts.length };
  } catch (error) {
    console.error('[Script Injector] Failed to register scripts:', error);
    return { ok: false, reason: error.message };
  }
}

// Scripts run in an isolated world by default: they share the page's DOM but are
// invisible to its JavaScript. Running in the page's own world ('MAIN') lets bot and
// tamper checks (Microsoft login/Office, captcha providers) see the injected code.
function scriptWorld(script) {
  return script.pageContext ? 'MAIN' : 'USER_SCRIPT';
}

// Convert a website pattern into where a script may run ({ matches, includeGlobs }).
// A plain host, or one starting with "*.", becomes a Chrome match pattern, so the
// wildcard can only match subdomains. (In a URL glob, "*" matches any text, so
// "*.github.io/*" would also match any URL with ".github.io/" in its query string.)
// Examples:
//   "github.com/*"   -> matches github.com, any path
//   "*.github.io/*"  -> matches github.io and its subdomains, any path
//   "localhost:3000" -> matches localhost, glob pins port 3000
//   "www.ohmy.*"     -> no match pattern can express this: glob http(s)://www.ohmy.*
// Paths are prefix matches, as before. A pattern that already has a scheme keeps it.
function patternToTarget(pattern) {
  const p = pattern.trim();
  if (!p) return null;

  const schemeMatch = p.match(/^([a-z]+):\/\//i);
  const rest = schemeMatch ? p.slice(schemeMatch[0].length) : p;
  const schemes = schemeMatch ? [schemeMatch[1].toLowerCase()] : ['http', 'https'];
  const globs = schemes.map(s => `${s}://${rest.endsWith('*') ? rest : `${rest}*`}`);

  const slash = rest.indexOf('/');
  const hostPort = slash === -1 ? rest : rest.slice(0, slash);
  const path = slash === -1 ? '' : rest.slice(slash);
  const hostMatch = hostPort.match(/^((?:\*\.)?[a-z0-9.-]+)(:\d+)?$/i);
  const webSchemes = schemes.every(s => s === 'http' || s === 'https');

  if (!hostMatch || !webSchemes) {
    return { matches: ['<all_urls>'], includeGlobs: globs };
  }

  const target = { matches: schemes.map(s => `${s}://${hostMatch[1].toLowerCase()}/*`) };
  // Match patterns ignore ports and can't express a path prefix, so the glob narrows those
  const pathIsAny = path === '' || path === '/' || path === '/*';
  if (hostMatch[2] || !pathIsAny) target.includeGlobs = globs;
  return target;
}

// Recommended check from the Chrome docs: accessing chrome.userScripts throws
// (or it is undefined) until the user enables "Allow User Scripts" for the extension.
function isUserScriptsAvailable() {
  try {
    chrome.userScripts.getScripts();
    return true;
  } catch {
    return false;
  }
}
