# Script Injector - Chrome Extension

A Chrome extension that lets you inject custom JavaScript scripts into websites with grouped organization, auto-fire on page load, and manual trigger options.

## Features

✅ **Group-based organization** — Organize websites into groups  
✅ **Wildcard URL patterns** — Match multiple sites with patterns like `www.ohmy.*`, `github.com/*`  
✅ **Auto-fire scripts** — Scripts run automatically when you visit matching sites  
✅ **Manual execution** — Run scripts on demand with one click  
✅ **Paste code directly** — Add scripts by pasting JavaScript code in a textarea  
✅ **Group-level control** — Disable entire groups when needed  
✅ **Enable/disable per script** — Toggle individual scripts on/off  
✅ **Edit & delete** — Manage your scripts from the popup  

---

## Installation

Requires Chrome 135 or newer.

1. **Download/extract** these files to a folder:
   - `manifest.json`
   - `popup.html`
   - `popup.js`
   - `background.js`

2. **Open Chrome** and go to `chrome://extensions/`

3. **Enable "Developer mode"** (toggle in top-right)

4. **Click "Load unpacked"** and select the folder with the extension files

5. **Allow user scripts:** click **Details** on Script Injector and turn on **"Allow User Scripts"**.
   Chrome requires this before an extension can run code you paste in. The popup shows a warning banner with a shortcut button until it's on.

6. **Done!** You should see the Script Injector icon in your Chrome toolbar

After changing the extension's files, click the reload icon on its card in `chrome://extensions/`.

---

## How to Use

### Adding a Group

1. Click the **Script Injector** icon in your toolbar
2. Click **"+ Add Group"** at the bottom of the sidebar
3. Enter:
   - **Group Name**: e.g., "Dev Tools"
   - **Websites**: URL patterns (one per line):
     - `github.com/*` — matches any path on github.com
     - `www.ohmy.*` — matches www.ohmy.com, www.ohmy.co.uk, etc.
     - `localhost:3000` — any page on localhost port 3000
4. Click **"Save Group"**

### Adding a Script to a Group

1. Click the group name in the sidebar to select it
2. Click **"+ Add Script"** in the main area
3. Enter:
   - **Script Name**: e.g., "Dark Mode"
   - **Script Code**: Paste your JavaScript code
   - **Auto-fire**: Check if you want it to run automatically on matching pages
4. Click **"Save Script"**

### Running Scripts

**Auto-fire scripts:**
- Automatically run when you visit a page matching the group's website patterns
- Only runs if the group AND script are both **enabled**

**Manual scripts:**
- Click **"Run Now"** button on the script to execute it immediately on the current page
- Useful for scripts you want to trigger on demand

### Managing Scripts & Groups

- **Toggle on/off**: Use the checkboxes in the sidebar (groups) and script items
- **Edit**: Click the "Edit" button
- **Delete**: Click the "Delete" button (confirm the action)

---

## URL Pattern Examples

```
github.com/*           → Matches github.com, github.com/user, github.com/user/repo, etc.
www.ohmy.*            → Matches www.ohmy.com, www.ohmy.co.uk, www.ohmy.co.nz, etc.
localhost:3000        → Matches localhost:3000 and every path on it
example.com/api/*     → Matches example.com/api/, example.com/api/users, etc.
*.github.io/*         → Matches anything.github.io and all paths
https://site.com/a/*  → Patterns with a scheme are used as-is (here: https only)
```

Rules:
- Patterns without a scheme match both `http://` and `https://`
- `*` matches any characters, `?` matches exactly one character
- Patterns are **prefix** matches: `example.com` also matches `example.com/anything`
- The query string counts as part of the URL

---

## Example Scripts

### Dark Mode Toggle
```javascript
document.body.style.background = '#1e1e1e';
document.body.style.color = '#ffffff';
```

### Hide Elements
```javascript
const ads = document.querySelectorAll('.advertisement');
ads.forEach(ad => ad.style.display = 'none');
```

### Auto-scroll
```javascript
window.scrollInterval = setInterval(() => {
  window.scrollBy(0, 100);
}, 2000);
```

### Inject HTML
```javascript
const banner = document.createElement('div');
banner.textContent = 'Custom banner!';
banner.style.cssText = 'background:blue;color:white;padding:10px;';
document.body.prepend(banner);
```

---

## Storage

All data is stored locally in Chrome's `chrome.storage.local`:
- No cloud sync
- Persists across browser restarts
- Private to your browser profile

---

## Troubleshooting

**Scripts not running?**
- Make sure **"Allow User Scripts"** is on (see Installation step 5); the popup shows a banner if it's off
- Check the browser console (F12) for error messages
- Verify the website pattern matches your current URL
- Make sure the group AND script are both enabled (checkboxes)
- Auto-fire scripts run on the next page load, so reload the tab after saving
- Try "Run Now" to test the script manually
- `chrome://` pages and the Chrome Web Store can't be scripted by any extension

**URL pattern not matching?**
- Patterns are compared against the full URL (see URL Pattern Examples above)
- Use `*` for wildcards, e.g. `*.example.com/*` for subdomains

**Debugging the extension itself?**
- In `chrome://extensions/`, click **"service worker"** on the Script Injector card to see how many auto-fire scripts were registered

**Want to see what's happening?**
- Open DevTools console (F12)
- Look for `[Script Injector]` log messages

---

## Tips

1. **Test scripts first** — Use "Run Now" before enabling auto-fire
2. **Use auto-fire sparingly** — Reserved for scripts you always need
3. **Name clearly** — Use descriptive names so you remember what each script does
4. **Backup your data** — Screenshot or export groups if they're important

---

Enjoy automating your web experience! 🚀
