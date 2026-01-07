class ImagePicker {
    constructor() {
        this.options = {
            multiselect: false,
            onSelect: null
        };
        this.isOpen = false;

        // State
        this.currentFolderId = null;
        this.items = [];
        this.breadcrumbs = [];
        this.selected = new Set();
        this.clipboard = null; // for cut/paste if implemented, or we use drag/drop

        // Bind methods
        this.close = this.close.bind(this);
        this.handleUpload = this.handleUpload.bind(this);
        this.handleDrop = this.handleDrop.bind(this);
    }

    static open(options = {}) {
        if (!window._imagePicker) {
            window._imagePicker = new ImagePicker();
        }
        window._imagePicker.show(options);
    }

    show(options) {
        this.options = { ...this.options, ...options };
        this.isOpen = true;
        this.selected.clear();
        this.currentFolderId = null; // Start at root

        // Adjust modal styling
        const modalContent = document.getElementById('modal-content');
        if (modalContent) {
            modalContent.classList.remove('max-w-md', 'p-6', 'w-full');
            modalContent.classList.add('max-w-5xl', 'w-[900px]', 'p-0', 'overflow-hidden');
        }

        openModal(this.getModalContent());
        this.fetchItems();
    }

    close() {
        this.isOpen = false;
        const modalContent = document.getElementById('modal-content');
        if (modalContent) {
            modalContent.className = 'bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl transform scale-95 transition-transform duration-200 [&.active]:scale-100';
        }
        closeModal();
    }

    async fetchItems() {
        try {
            const url = this.currentFolderId
                ? `/images/fs/list?parent_id=${this.currentFolderId}`
                : `/images/fs/list`;

            const res = await fetch(url);
            const data = await res.json();
            this.items = data.items || [];
            this.breadcrumbs = data.breadcrumbs || [];
            this.renderContent();
            this.renderBreadcrumbs();
        } catch (e) {
            console.error("Failed to load items", e);
        }
    }

    getModalContent() {
        return `
            <div id="ip-modal-container" class="w-full h-[650px] flex flex-col animate-in fade-in zoom-in duration-200 select-none">
                <!-- Header / Toolbar -->
                <div class="px-4 py-3 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center gap-4">
                    <h3 class="text-lg font-semibold text-white shrink-0">Files</h3>
                    
                    <!-- Breadcrumbs -->
                    <div id="ip-breadcrumbs" class="flex-1 flex items-center overflow-hidden text-sm text-zinc-400 gap-1 px-2">
                        <!-- Populated via JS -->
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center gap-2">
                        <button onclick="window._imagePicker.createFolderPrompt()" class="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white" title="New Folder">
                            📁+
                        </button>
                        <button onclick="document.getElementById('ip-upload-input').click()" class="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white" title="Upload Files">
                            ☁️
                        </button>
                        <input type="file" id="ip-upload-input" class="hidden" multiple accept="image/*" onchange="window._imagePicker.handleUpload(this.files)">
                        
                        <button class="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white ml-2" onclick="window._imagePicker.close()">✕</button>
                    </div>
                </div>

                <!-- Main Content Area -->
                <div class="flex-1 flex overflow-hidden">
                    <!-- File Grid -->
                    <div id="ip-content" 
                         class="flex-1 overflow-y-auto p-4 bg-zinc-950/50"
                         ondragover="window._imagePicker.onDragOver(event)"
                         ondrop="window._imagePicker.handleDrop(event)">
                         <!-- Content -->
                    </div>
                </div>

                <!-- Footer -->
                <div class="px-6 py-4 border-t border-zinc-800 bg-zinc-900 flex justify-between items-center">
                    <div class="text-sm text-zinc-500">
                        <span id="ip-status">Ready</span>
                    </div>
                    <div class="flex gap-3">
                        <button class="px-4 py-2 text-zinc-400 hover:text-white" onclick="window._imagePicker.close()">Cancel</button>
                        <button class="px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-medium shadow-lg shadow-teal-900/20" onclick="window._imagePicker.confirm()">
                            Select
                        </button>
                    </div>
                </div>
                
                <!-- Context Menu (Hidden) -->
                <div id="ip-context-menu" class="fixed hidden bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 w-48 py-1">
                    <button class="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white" onclick="window._imagePicker.ctxRename()">Rename</button>
                    <button class="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-zinc-800 hover:text-red-300" onclick="window._imagePicker.ctxDelete()">Delete</button>
                </div>
            </div>
        `;
    }

    renderBreadcrumbs() {
        const container = document.getElementById('ip-breadcrumbs');
        if (!container) return;

        let html = `<button class="hover:text-white hover:underline px-1" onclick="window._imagePicker.navigateTo(null)">Root</button>`;

        this.breadcrumbs.forEach(crumb => {
            html += `<span class="text-zinc-600">/</span>`;
            html += `<button class="hover:text-white hover:underline px-1 truncate max-w-[150px]" onclick="window._imagePicker.navigateTo('${crumb.id}')">${crumb.name}</button>`;
        });

        container.innerHTML = html;
        container.scrollLeft = container.scrollWidth;
    }

    renderContent() {
        const container = document.getElementById('ip-content');
        if (!container) return;

        if (this.items.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-zinc-600 opacity-50">
                    <div class="text-5xl mb-4">📂</div>
                    <p>Folder is empty</p>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div class="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                ${this.items.map(item => this.renderCard(item)).join('')}
            </div>
        `;
    }

    renderCard(item) {
        const isSelected = this.selected.has(item.id);
        const isFolder = item.type === 'folder';

        let iconOrImg = '';
        if (isFolder) {
            iconOrImg = `<div class="w-full h-full flex items-center justify-center bg-zinc-800 text-5xl">📁</div>`;
        } else {
            iconOrImg = `<img src="/images/raw/${item.id}" class="w-full h-full object-cover pointer-events-none" draggable="false">`;
        }

        return `
            <div class="group relative aspect-[4/5] bg-zinc-900/50 rounded-lg border ${isSelected ? 'border-teal-500 ring-1 ring-teal-500/50' : 'border-zinc-800 hover:border-zinc-600'} flex flex-col overflow-hidden transition-all cursor-pointer"
                 onclick="window._imagePicker.toggleSelect('${item.id}', ${isFolder})"
                 ondblclick="${isFolder ? `window._imagePicker.navigateTo('${item.id}')` : `window._imagePicker.confirm('${item.id}')`}"
                 oncontextmenu="window._imagePicker.showCtxMenu(event, '${item.id}')"
                 draggable="true"
                 ondragstart="window._imagePicker.onItemDragStart(event, '${item.id}')"
                 ondragover="${isFolder ? `window._imagePicker.onItemDragOver(event)` : ''}"
                 ondrop="${isFolder ? `window._imagePicker.onItemDrop(event, '${item.id}')` : ''}"
            >
                <div class="flex-1 overflow-hidden relative">
                    ${iconOrImg}
                </div>
                <div class="h-8 flex items-center px-2 bg-zinc-900 border-t border-zinc-800">
                    <span class="text-xs text-zinc-300 truncate w-full text-center group-hover:text-white" title="${item.name}">${item.name}</span>
                </div>
            </div>
        `;
    }

    // --- Interaction ---

    navigateTo(folderId) {
        this.currentFolderId = folderId;
        this.fetchItems();
    }

    toggleSelect(id, isFolder) {
        // Simple single select for files logic usually, but keep simple
        if (this.options.multiselect) {
            if (this.selected.has(id)) this.selected.delete(id);
            else this.selected.add(id);
        } else {
            this.selected.clear();
            this.selected.add(id);
        }
        this.renderContent();

        // Update status
        const count = this.selected.size;
        document.getElementById('ip-status').innerText = count > 0 ? `${count} selected` : 'Ready';

        // Close context menu if open
        this.closeCtxMenu();
    }

    confirm(forceId) {
        let targets = [];
        if (forceId) targets = [this.items.find(i => i.id === forceId)];
        else targets = this.items.filter(i => this.selected.has(i.id));

        // Note: Can we select folders as "value"? 
        // For now, assuming ImagePicker is for IMAGES only.
        const files = targets.filter(t => t.type === 'file');

        if (files.length === 0) return;

        if (this.options.onSelect) {
            this.options.onSelect(files);
        }
        this.close();
    }

    // --- File Operations ---

    async createFolderPrompt() {
        const name = prompt("Enter folder name:", "New Folder");
        if (!name) return;

        try {
            const res = await fetch('/images/fs/folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, parent_id: this.currentFolderId })
            });
            if (res.ok) {
                this.fetchItems();
            } else {
                alert("Failed to create folder");
            }
        } catch (e) {
            console.error(e);
        }
    }

    async handleUpload(files) {
        if (!files || files.length === 0) return;

        const formData = new FormData();
        Array.from(files).forEach(f => formData.append('files', f));
        if (this.currentFolderId) {
            formData.append('parent_id', this.currentFolderId);
        }

        // Optimistic loading UI?
        document.getElementById('ip-status').innerText = "Uploading...";

        try {
            const res = await fetch('/images/upload', {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                this.fetchItems();
                document.getElementById('ip-status').innerText = "Upload Complete";
            } else {
                alert("Upload failed");
            }
        } catch (e) {
            console.error(e);
            alert("Upload error");
        }
    }

    // --- Drag & Drop (Move) ---

    onItemDragStart(e, id) {
        e.dataTransfer.setData('curr_id', id);
        e.dataTransfer.effectAllowed = 'move';
        this.draggedId = id;
    }

    onItemDragOver(e) {
        e.preventDefault(); // allow drop
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('bg-teal-500/20');
    }

    // Drop ONTO a folder (move into folder)
    async onItemDrop(e, targetFolderId) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('bg-teal-500/20');

        const sourceId = e.dataTransfer.getData('curr_id');
        if (!sourceId || sourceId === targetFolderId) return;

        // Execute Move
        await this.moveItem(sourceId, targetFolderId);
    }

    // Drop ONTO the background (upload) or move to parent?
    // Let's handle File upload drop separately
    onDragOver(e) {
        e.preventDefault();
    }

    async handleDrop(e) {
        e.preventDefault();
        // Check if files
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            this.handleUpload(e.dataTransfer.files);
            return;
        }

        // If internal move (dragged to empty space not allowed/configured yet? 
        // maybe drag to breadcrumb for parent move in future)
    }

    async moveItem(itemId, targetParentId) {
        try {
            const res = await fetch(`/images/fs/${itemId}/move`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_parent_id: targetParentId })
            });
            if (res.ok) {
                this.fetchItems();
            } else {
                alert("Move failed");
            }
        } catch (e) {
            console.error(e);
        }
    }

    // --- Context Menu ---

    showCtxMenu(e, id) {
        e.preventDefault();
        e.stopPropagation();
        this.ctxId = id;

        // Select it
        this.selected.clear();
        this.selected.add(id);
        this.renderContent();

        const menu = document.getElementById('ip-context-menu');
        menu.classList.remove('hidden');
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;

        // Click away listener
        const close = () => {
            this.closeCtxMenu();
            document.removeEventListener('click', close);
        };
        document.addEventListener('click', close);
    }

    closeCtxMenu() {
        document.getElementById('ip-context-menu').classList.add('hidden');
        this.ctxId = null;
    }

    async ctxRename() {
        if (!this.ctxId) return;
        const item = this.items.find(i => i.id === this.ctxId);
        const newName = prompt("Rename to:", item.name);
        if (!newName || newName === item.name) return;

        try {
            const res = await fetch(`/images/fs/${this.ctxId}/rename`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });
            if (res.ok) this.fetchItems();
        } catch (e) { console.error(e); }
    }

    async ctxDelete() {
        if (!this.ctxId) return;
        if (!confirm("Are you sure you want to delete this item?")) return;

        try {
            const res = await fetch(`/images/fs/${this.ctxId}`, {
                method: 'DELETE'
            });
            if (res.ok) this.fetchItems();
        } catch (e) { console.error(e); }
    }
}
