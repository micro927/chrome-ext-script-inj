// Popup UI logic
//
// NOTE: Extension pages (MV3) forbid inline handlers like onclick="..." via CSP,
// so every button is wired with addEventListener / event delegation instead.
let currentGroupId = null;
let allData = { groups: [] };

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkUserScriptsAvailable();
  loadData();
});

function setupEventListeners() {
  document.getElementById('openSettingsBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
  });

  document.getElementById('addGroupBtn').addEventListener('click', openAddGroupModal);
  document.getElementById('saveGroupBtn').addEventListener('click', saveGroup);
  document.getElementById('closeModal').addEventListener('click', closeGroupModal);
  document.getElementById('cancelGroupBtn').addEventListener('click', closeGroupModal);

  document.getElementById('saveScriptBtn').addEventListener('click', saveScript);
  document.getElementById('closeScriptModal').addEventListener('click', closeScriptModal);
  document.getElementById('cancelScriptBtn').addEventListener('click', closeScriptModal);

  // Delegated handlers for the dynamically rendered content area
  const contentArea = document.getElementById('contentArea');

  contentArea.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.tagName === 'INPUT') return;
    const { action, groupId, scriptId } = btn.dataset;

    switch (action) {
      case 'edit-group': openEditGroupModal(groupId); break;
      case 'delete-group': deleteGroup(groupId); break;
      case 'add-script': openAddScriptModal(groupId); break;
      case 'edit-script': openEditScriptModal(groupId, scriptId); break;
      case 'delete-script': deleteScript(groupId, scriptId); break;
      case 'run-script': runScriptManually(groupId, scriptId); break;
    }
  });

  contentArea.addEventListener('change', (e) => {
    const input = e.target.closest('[data-action="toggle-script"]');
    if (!input) return;
    toggleScriptEnabled(input.dataset.groupId, input.dataset.scriptId, input.checked);
  });
}

function loadData(selectId) {
  chrome.storage.local.get('scriptInjectorData', (result) => {
    allData = result.scriptInjectorData || { groups: [] };
    allData.groups = allData.groups || [];

    // Keep the requested / current group selected; fall back to the first one
    const targetId = [selectId, currentGroupId].find(id => id && allData.groups.some(g => g.id === id));

    if (targetId) {
      selectGroup(targetId);
    } else if (allData.groups.length > 0) {
      selectGroup(allData.groups[0].id);
    } else {
      currentGroupId = null;
      renderGroupsList();
      renderContent(null);
    }
  });
}

function renderGroupsList() {
  const list = document.getElementById('groupsList');
  list.innerHTML = '';

  allData.groups.forEach(group => {
    const groupItem = document.createElement('div');
    groupItem.className = `group-item ${currentGroupId === group.id ? 'active' : ''}`;
    groupItem.addEventListener('click', () => selectGroup(group.id));

    const groupName = document.createElement('span');
    groupName.style.flex = '1';
    groupName.textContent = group.name;

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.className = 'group-toggle';
    toggle.title = 'Enable / disable this group';
    toggle.checked = group.enabled !== false;
    toggle.addEventListener('click', (e) => e.stopPropagation());
    toggle.addEventListener('change', () => toggleGroupEnabled(group.id, toggle.checked));

    groupItem.appendChild(groupName);
    groupItem.appendChild(toggle);
    list.appendChild(groupItem);
  });
}

function selectGroup(groupId) {
  currentGroupId = groupId;
  renderGroupsList();
  const group = allData.groups.find(g => g.id === groupId);
  renderContent(group);
}

function renderContent(group) {
  const contentArea = document.getElementById('contentArea');

  if (!group) {
    contentArea.innerHTML = '<div class="content-empty">No groups yet. Create one to get started!</div>';
    return;
  }

  const gid = escapeHtml(group.id);

  let html = `
    <div class="group-header">
      <div>
        <div class="group-title">${escapeHtml(group.name)}</div>
      </div>
      <div>
        <button class="btn btn-small" data-action="edit-group" data-group-id="${gid}">Edit Group</button>
        <button class="btn btn-danger btn-small" data-action="delete-group" data-group-id="${gid}">Delete</button>
      </div>
    </div>

    <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
      <div style="font-weight: bold; font-size: 16px;">Scripts in this group</div>
      <button class="btn btn-success btn-small" data-action="add-script" data-group-id="${gid}">+ Add Script</button>
    </div>
  `;

  if (group.scripts && group.scripts.length > 0) {
    group.scripts.forEach(script => {
      const sid = escapeHtml(script.id);
      const autoLabel = script.autoFire
        ? '<span class="inline-label auto">AUTO</span>'
        : '<span class="inline-label manual">MANUAL</span>';
      const pageLabel = script.pageContext ? '<span class="inline-label">PAGE</span>' : '';

      html += `
        <div class="script-item">
          <div class="script-header">
            <div class="script-name">${escapeHtml(script.name)} ${autoLabel}${pageLabel}</div>
            <div class="script-controls">
              <input type="checkbox" class="toggle-checkbox" title="Enable / disable this script"
                     ${script.enabled !== false ? 'checked' : ''}
                     data-action="toggle-script" data-group-id="${gid}" data-script-id="${sid}">
              <button class="btn btn-success btn-small" data-action="run-script" data-group-id="${gid}" data-script-id="${sid}">▶ Run Now</button>
              <button class="btn btn-small" data-action="edit-script" data-group-id="${gid}" data-script-id="${sid}">Edit</button>
              <button class="btn btn-danger btn-small" data-action="delete-script" data-group-id="${gid}" data-script-id="${sid}">Delete</button>
            </div>
          </div>
          <div class="script-meta">Type: ${script.autoFire ? 'Auto-fire on load' : 'Manual trigger'}</div>
        </div>
      `;
    });
  } else {
    html += '<div class="content-empty">No scripts in this group yet</div>';
  }

  contentArea.innerHTML = html;
}

function openAddGroupModal() {
  document.getElementById('modalTitle').textContent = 'Add Group';
  document.getElementById('groupName').value = '';
  document.getElementById('groupWebsites').value = '';
  document.getElementById('saveGroupBtn').dataset.groupId = '';
  document.getElementById('groupModal').classList.add('active');
  document.getElementById('groupName').focus();
}

function openEditGroupModal(groupId) {
  const group = allData.groups.find(g => g.id === groupId);
  if (!group) return;

  document.getElementById('modalTitle').textContent = 'Edit Group';
  document.getElementById('groupName').value = group.name;
  document.getElementById('groupWebsites').value = (group.websites || []).join('\n');
  document.getElementById('saveGroupBtn').dataset.groupId = groupId;
  document.getElementById('groupModal').classList.add('active');
}

function closeGroupModal() {
  document.getElementById('groupModal').classList.remove('active');
}

function saveGroup() {
  const name = document.getElementById('groupName').value.trim();
  const websitesText = document.getElementById('groupWebsites').value.trim();
  const websites = websitesText.split('\n').map(w => w.trim()).filter(w => w);
  const groupId = document.getElementById('saveGroupBtn').dataset.groupId;

  if (!name) {
    alert('Group name is required');
    return;
  }

  if (websites.length === 0) {
    alert('Add at least one website pattern');
    return;
  }

  let selectId = groupId;

  if (groupId) {
    // Edit existing
    const group = allData.groups.find(g => g.id === groupId);
    if (group) {
      group.name = name;
      group.websites = websites;
    }
  } else {
    // Create new
    selectId = generateId('group');
    allData.groups.push({
      id: selectId,
      name: name,
      websites: websites,
      scripts: [],
      enabled: true
    });
  }

  saveData(() => {
    closeGroupModal();
    loadData(selectId);
  });
}

function deleteGroup(groupId) {
  if (confirm('Delete this group and all its scripts?')) {
    allData.groups = allData.groups.filter(g => g.id !== groupId);
    currentGroupId = null;
    saveData(() => loadData());
  }
}

function toggleGroupEnabled(groupId, enabled) {
  const group = allData.groups.find(g => g.id === groupId);
  if (group) {
    group.enabled = enabled;
    saveData();
  }
}

function openAddScriptModal(groupId) {
  document.getElementById('scriptModalTitle').textContent = 'Add Script';
  document.getElementById('scriptName').value = '';
  document.getElementById('scriptCode').value = '';
  document.getElementById('scriptAutoFire').checked = false;
  document.getElementById('scriptPageContext').checked = false;
  document.getElementById('saveScriptBtn').dataset.groupId = groupId;
  document.getElementById('saveScriptBtn').dataset.scriptId = '';
  document.getElementById('scriptModal').classList.add('active');
  document.getElementById('scriptName').focus();
}

function openEditScriptModal(groupId, scriptId) {
  const group = allData.groups.find(g => g.id === groupId);
  if (!group) return;

  const script = (group.scripts || []).find(s => s.id === scriptId);
  if (!script) return;

  document.getElementById('scriptModalTitle').textContent = 'Edit Script';
  document.getElementById('scriptName').value = script.name;
  document.getElementById('scriptCode').value = script.code;
  document.getElementById('scriptAutoFire').checked = script.autoFire || false;
  document.getElementById('scriptPageContext').checked = script.pageContext || false;
  document.getElementById('saveScriptBtn').dataset.groupId = groupId;
  document.getElementById('saveScriptBtn').dataset.scriptId = scriptId;
  document.getElementById('scriptModal').classList.add('active');
}

function closeScriptModal() {
  document.getElementById('scriptModal').classList.remove('active');
}

function saveScript() {
  const name = document.getElementById('scriptName').value.trim();
  const code = document.getElementById('scriptCode').value.trim();
  const autoFire = document.getElementById('scriptAutoFire').checked;
  const pageContext = document.getElementById('scriptPageContext').checked;
  const groupId = document.getElementById('saveScriptBtn').dataset.groupId;
  const scriptId = document.getElementById('saveScriptBtn').dataset.scriptId;

  if (!name) {
    alert('Script name is required');
    return;
  }

  if (!code) {
    alert('Script code is required');
    return;
  }

  const group = allData.groups.find(g => g.id === groupId);
  if (!group) return;
  group.scripts = group.scripts || [];

  if (scriptId) {
    // Edit existing
    const script = group.scripts.find(s => s.id === scriptId);
    if (script) {
      script.name = name;
      script.code = code;
      script.autoFire = autoFire;
      script.pageContext = pageContext;
    }
  } else {
    // Create new
    group.scripts.push({
      id: generateId('script'),
      name: name,
      code: code,
      autoFire: autoFire,
      pageContext: pageContext,
      enabled: true
    });
  }

  saveData(() => {
    closeScriptModal();
    selectGroup(groupId);
  });
}

function deleteScript(groupId, scriptId) {
  const group = allData.groups.find(g => g.id === groupId);
  if (group && confirm('Delete this script?')) {
    group.scripts = (group.scripts || []).filter(s => s.id !== scriptId);
    saveData(() => selectGroup(groupId));
  }
}

function toggleScriptEnabled(groupId, scriptId, enabled) {
  const group = allData.groups.find(g => g.id === groupId);
  if (group) {
    const script = (group.scripts || []).find(s => s.id === scriptId);
    if (script) {
      script.enabled = enabled;
      saveData();
    }
  }
}

function runScriptManually(groupId, scriptId) {
  const group = allData.groups.find(g => g.id === groupId);
  if (!group) return;

  const script = (group.scripts || []).find(s => s.id === scriptId);
  if (!script) return;

  if (!isUserScriptsAvailable()) {
    alert('User scripts are disabled. Click "Open extension settings" at the top and turn on "Allow User Scripts".');
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs.length === 0) return;

    try {
      const results = await chrome.userScripts.execute({
        target: { tabId: tabs[0].id },
        js: [{ code: script.code }],
        world: script.pageContext ? 'MAIN' : 'USER_SCRIPT'
      });
      const error = results && results[0] && results[0].error;
      if (error) {
        alert(`"${script.name}" threw an error:\n${error}`);
        return;
      }
      alert(`Executed "${script.name}" on current page`);
    } catch (e) {
      alert(`Could not run "${script.name}" on this page:\n${e.message}\n\n(chrome:// pages and the Chrome Web Store can't be scripted.)`);
    }
  });
}

// Accessing chrome.userScripts throws (or it is undefined) until the user enables
// "Allow User Scripts" for this extension in chrome://extensions → Details.
function isUserScriptsAvailable() {
  try {
    chrome.userScripts.getScripts();
    return true;
  } catch {
    return false;
  }
}

function checkUserScriptsAvailable() {
  const warning = document.getElementById('userScriptsWarning');
  if (isUserScriptsAvailable()) {
    warning.classList.remove('active');
    // Registration may have failed while the permission was off: re-sync now
    chrome.runtime.sendMessage({ action: 'sync' }).catch(() => {});
  } else {
    warning.classList.add('active');
  }
}

function saveData(callback) {
  chrome.storage.local.set({ scriptInjectorData: allData }, callback || (() => {}));
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text ?? '').replace(/[&<>"']/g, m => map[m]);
}
