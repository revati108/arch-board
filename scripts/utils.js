// ArchBoard Shared Utilities
// Common functionality used across all tool pages

// =============================================================================
// SETTINGS STATE (persisted in localStorage)
// =============================================================================

const ArchBoard = {
    // localStorage key mapping
    _storageKeys: {
        toastsEnabled: 'archboard_toasts',
        autosaveEnabled: 'archboard_autosave'
    },

    // Settings with defaults
    settings: {
        toastsEnabled: localStorage.getItem('archboard_toasts') !== 'false',
        autosaveEnabled: localStorage.getItem('archboard_autosave') === 'true'
    },

    // Update a setting
    setSetting(key, value) {
        this.settings[key] = value;
        const storageKey = this._storageKeys[key] || `archboard_${key}`;
        localStorage.setItem(storageKey, value.toString());
    },

    // Get a setting
    getSetting(key) {
        return this.settings[key];
    }
};

// =============================================================================
// TOAST NOTIFICATIONS
// =============================================================================

function showToast(message, type = 'info') {
    // Skip if toasts are disabled
    if (!ArchBoard.settings.toastsEnabled) return;

    let container = document.getElementById('toast-container');

    // Create container if it doesn't exist
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-6 right-6 flex flex-col gap-2 z-[10000] pointers-events-none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const typeClasses = {
        'info': 'border-blue-500 bg-blue-500/10 text-blue-200',
        'success': 'border-teal-500 bg-teal-500/10 text-teal-200',
        'error': 'border-red-500 bg-red-500/10 text-red-200'
    };

    toast.className = `flex items-center justify-between gap-4 px-4 py-3 bg-zinc-900 border rounded-lg text-sm shadow-xl min-w-[300px] pointer-events-auto transition-all duration-300 animate-in slide-in-from-right-full ${typeClasses[type] || typeClasses['info']}`;
    toast.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" class="hover:text-white transition-colors">×</button>
    `;
    container.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => toast.remove(), 3000);
}

// Force show toast even if disabled (for settings confirmation)
function forceShowToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-6 right-6 flex flex-col gap-2 z-[10000] pointers-events-none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const typeClasses = {
        'info': 'border-blue-500 bg-blue-500/10 text-blue-200',
        'success': 'border-teal-500 bg-teal-500/10 text-teal-200',
        'error': 'border-red-500 bg-red-500/10 text-red-200'
    };
    toast.className = `flex items-center justify-between gap-4 px-4 py-3 bg-zinc-900 border rounded-lg text-sm shadow-xl min-w-[300px] pointer-events-auto transition-all duration-300 animate-in slide-in-from-right-full ${typeClasses[type] || typeClasses['info']}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// =============================================================================
// MODAL SYSTEM
// =============================================================================

function openGlobalModal(content) {
    let overlay = document.getElementById('global-modal-overlay');

    // Create modal overlay if it doesn't exist
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'global-modal-overlay';
        overlay.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center opacity-0 pointer-events-none transition-opacity duration-200 [&.active]:opacity-100 [&.active]:pointer-events-auto';
        overlay.onclick = closeGlobalModal;

        const modalContent = document.createElement('div');
        modalContent.id = 'global-modal-content';
        modalContent.className = 'bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl transform scale-95 transition-transform duration-200 [&.active]:scale-100';
        modalContent.onclick = (e) => e.stopPropagation();

        overlay.appendChild(modalContent);
        document.body.appendChild(overlay);
    }

    const modalContent = document.getElementById('global-modal-content');
    modalContent.innerHTML = content;
    overlay.classList.add('active');
}

function closeGlobalModal() {
    const overlay = document.getElementById('global-modal-overlay');
    if (overlay) overlay.classList.remove('active');
}

// =============================================================================
// GLOBAL SETTINGS MODAL
// =============================================================================

function toggleToasts(enabled) {
    ArchBoard.setSetting('toastsEnabled', enabled);
    forceShowToast(`Toasts ${enabled ? 'enabled' : 'disabled'}`);
}

function toggleGlobalAutosave(enabled) {
    ArchBoard.setSetting('autosaveEnabled', enabled);
    forceShowToast(`Autosave ${enabled ? 'enabled' : 'disabled'}`);

    // Also update any tool-specific autosave state
    if (typeof autosaveEnabled !== 'undefined') {
        autosaveEnabled = enabled;
    }

    // Update toggle in hyprland header if it exists
    const toggle = document.getElementById('autosave-toggle');
    if (toggle) toggle.checked = enabled;
}

function showGlobalSettingsModal() {
    openGlobalModal(`
        <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-bold text-white flex items-center gap-2">⚙️ Settings</h3>
            <button class="text-zinc-500 hover:text-white text-2xl leading-none" onclick="closeGlobalModal()">×</button>
        </div>
        <div class="mb-6">
            <div class="flex flex-col gap-3">
                <div class="flex justify-between items-center p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                    <div class="flex-1 mr-4">
                        <div class="font-medium text-zinc-200 mb-1">Show Notifications</div>
                        <div class="text-xs text-zinc-500">Display toast messages for save, sync, and other actions</div>
                    </div>
                    
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" class="sr-only peer" ${ArchBoard.settings.toastsEnabled ? 'checked' : ''} onchange="toggleToasts(this.checked)">
                        <div class="w-11 h-6 bg-zinc-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                    </label>
                </div>
                <div class="flex justify-between items-center p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                    <div class="flex-1 mr-4">
                        <div class="font-medium text-zinc-200 mb-1">Autosave</div>
                        <div class="text-xs text-zinc-500">Automatically save changes as you edit</div>
                    </div>
                    
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" class="sr-only peer" ${ArchBoard.settings.autosaveEnabled ? 'checked' : ''} onchange="toggleGlobalAutosave(this.checked)">
                        <div class="w-11 h-6 bg-zinc-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                    </label>
                </div>
            </div>
        </div>
        <div class="flex justify-end pt-4 border-t border-zinc-700/50">
            <button class="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-colors" onclick="closeGlobalModal()">Close</button>
        </div>
    `);
}

// Initialize global settings button
document.addEventListener('DOMContentLoaded', () => {
    // Find the settings button in header and wire it up
    const settingsButtons = document.querySelectorAll('button[title="Settings"]');
    settingsButtons.forEach(btn => {
        btn.onclick = showGlobalSettingsModal;
    });
});
