
const moduleList = document.getElementById('modules-list');
const searchInput = document.getElementById('search-modules');
const editorContainer = document.getElementById('editor-container');
const emptyState = document.getElementById('empty-state');
const moduleTitle = document.getElementById('module-title');
const moduleConfig = document.getElementById('module-config');
const saveBtn = document.getElementById('save-btn');
const statusMsg = document.getElementById('status-msg');

let fullConfig = {};
let currentModule = null;

async function fetchConfig() {
    try {
        const res = await fetch('/waybar/config');
        fullConfig = await res.json();
        renderModules();
    } catch (e) {
        console.error(e);
        moduleList.innerHTML = '<div class="text-red-500 p-4 text-center">Failed to load config</div>';
    }
}

function getModules() {
    const modules = [];
    // Helper to add modules from a list/dict
    const add = (source, location) => {
        if (Array.isArray(source)) {
            source.forEach(name => {
                modules.push({ name, location });
            });
        }
    };

    if (fullConfig) {
        // Handle array of configs? Waybar supports multi-bar. assume single object for now or first one.
        const cfg = Array.isArray(fullConfig) ? fullConfig[0] : fullConfig;

        add(cfg['modules-left'], 'Left');
        add(cfg['modules-center'], 'Center');
        add(cfg['modules-right'], 'Right');

        // Also find definitions in root that might not be in layout yet
        Object.keys(cfg).forEach(key => {
            if (typeof cfg[key] === 'object' && !['modules-left', 'modules-center', 'modules-right'].includes(key)) {
                // It's a module definition potentially
                // Avoid things like "layer", "output"
                if (!['layer', 'output', 'position', 'height', 'width', 'spacing', 'margin'].includes(key)) {
                    // Check if already added
                    if (!modules.find(m => m.name === key)) {
                        modules.push({ name: key, location: 'Defined' });
                    }
                }
            }
        });
    }
    return modules;
}

function renderModules() {
    const query = searchInput.value.toLowerCase();
    moduleList.innerHTML = '';

    const modules = getModules();
    const filtered = modules.filter(m => m.name.toLowerCase().includes(query));

    filtered.forEach(m => {
        const item = document.createElement('div');
        item.className = 'group flex items-center justify-between p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/5';

        // Highlight active
        if (currentModule === m.name) {
            item.classList.add('bg-white/10', 'border-white/10');
        }

        item.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-cyan-400 transition-colors">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                </div>
                <div>
                    <div class="text-sm font-medium text-zinc-300 group-hover:text-white">${m.name}</div>
                    <div class="text-xs text-zinc-500">${m.location}</div>
                </div>
            </div>
            <svg class="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
        `;

        item.onclick = () => selectModule(m.name);
        moduleList.appendChild(item);
    });
}

function selectModule(name) {
    currentModule = name;
    renderModules(); // Re-render to update active state

    emptyState.classList.add('hidden');
    editorContainer.classList.remove('hidden');
    moduleTitle.textContent = name;

    // Find config for this module
    const cfg = Array.isArray(fullConfig) ? fullConfig[0] : fullConfig;
    const modConfig = cfg[name] || {};

    moduleConfig.value = JSON.stringify(modConfig, null, 4);
}

async function saveModule() {
    const name = currentModule;
    try {
        const newContent = JSON.parse(moduleConfig.value);

        saveBtn.disabled = true;
        saveBtn.innerHTML = 'Saving...';

        const res = await fetch('/waybar/config/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                module: name,
                value: newContent
            })
        });

        if (res.ok) {
            showStatus('Configuration saved successfully', 'text-green-400');
            // Update local cache
            const cfg = Array.isArray(fullConfig) ? fullConfig[0] : fullConfig;
            cfg[name] = newContent;
            // Optional: Reload full config if we want to be sure
            // fullConfig = await (await fetch('/waybar/config')).json();
        } else {
            const err = await res.json();
            showStatus('Error: ' + err.error, 'text-red-400');
        }
    } catch (e) {
        showStatus('Invalid JSON: ' + e.message, 'text-red-400');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg> Save Changes`;
    }
}

function showStatus(msg, cls) {
    statusMsg.textContent = msg;
    statusMsg.className = 'mt-4 text-sm text-center ' + cls;
    statusMsg.classList.remove('hidden');
    setTimeout(() => statusMsg.classList.add('hidden'), 3000);
}

// Event listeners
if (searchInput) searchInput.addEventListener('input', renderModules);
if (saveBtn) saveBtn.addEventListener('click', saveModule);

// Initial load
fetchConfig();
