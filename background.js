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

    const includeGlobs = (group.websites || []).flatMap(patternToGlobs);
    if (includeGlobs.length === 0) return;

    (group.scripts || []).forEach(script => {
      if (script.enabled === false || !script.autoFire || !script.code) return;

      userScripts.push({
        id: `${group.id}::${script.id}`,
        matches: ['<all_urls>'],
        includeGlobs,
        js: [
          // Separate entry so the log still prints if the user code has a syntax error
          { code: `console.log("[Script Injector] Auto-firing:", ${JSON.stringify(script.name)});` },
          { code: script.code }
        ],
        runAt: 'document_end',
        world: 'MAIN'
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

// Convert a website pattern into URL globs (matched against the full URL).
// Examples:
//   "github.com/*"   -> http(s)://github.com/*
//   "www.ohmy.*"     -> http(s)://www.ohmy.*   (www.ohmy.com, www.ohmy.co.uk, ...)
//   "localhost:3000" -> http(s)://localhost:3000*
// Patterns are prefix matches, as before. A pattern that already has a scheme is used as-is.
function patternToGlobs(pattern) {
  const p = pattern.trim();
  if (!p) return [];

  const withWildcardEnd = p.endsWith('*') ? p : `${p}*`;
  if (p.includes('://')) return [withWildcardEnd];
  return [`http://${withWildcardEnd}`, `https://${withWildcardEnd}`];
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
