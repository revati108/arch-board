// Main application script
let production = prod || false;

// Dev mode settings panel
if (!production) {
    console.log('Dev mode enabled');

    // Create dev toolbar
    document.addEventListener('DOMContentLoaded', () => {
        createDevToolbar();
        initAutoReload();
    });
}

function createDevToolbar() {
    const toolbar = document.createElement('div');
    toolbar.id = 'dev-toolbar';
    toolbar.innerHTML = `
        <div class="fixed bottom-4 right-4 flex items-center gap-3 px-3 py-2 bg-zinc-900/95 border border-zinc-700 rounded-lg text-xs z-[9999] backdrop-blur text-zinc-400">
            <span class="px-1.5 py-0.5 bg-red-500 text-white rounded font-bold text-[10px] tracking-wider">DEV</span>
            <label class="flex items-center gap-2 cursor-pointer hover:text-zinc-200 transition-colors">
                <input type="checkbox" id="auto-reload-toggle" ${getLocalSettings('auto_reload', 'true') === 'true' ? 'checked' : ''} class="accent-teal-500 cursor-pointer">
                <span>Auto-reload</span>
            </label>
        </div>
    `;
    document.body.appendChild(toolbar);

    // Handle toggle change
    const toggle = document.getElementById('auto-reload-toggle');
    toggle.addEventListener('change', (e) => {
        setLocalSettings('auto_reload', e.target.checked.toString());
        console.log('Auto-reload:', e.target.checked);
    });
}

function initAutoReload() {
    const autoReload = getLocalSettings('auto_reload', 'true') === 'true';
    if (autoReload) {
        setTimeout(() => {
            if (autoReload) {
                location.reload();
            }
        }, 60000); // Reload every 60 seconds in dev mode
    }
}
