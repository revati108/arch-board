class ImagePicker {
    constructor() {
        this.options = {
            multiselect: false,
            folderSelect: false,
            onSelect: null
        };
        this.isOpen = false;
        this.activeTab = 'library'; // library, upload, folders
        this.items = [];
        this.folders = [];
        this.selected = new Set();

        // Bind methods
        this.close = this.close.bind(this);
        this.handleUpload = this.handleUpload.bind(this);
        this.handleFolderUpload = this.handleFolderUpload.bind(this);
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
        this.activeTab = 'library';

        // Adjust modal styling for large content
        const modalContent = document.getElementById('modal-content');
        if (modalContent) {
            // Save original classes to restore later if needed, or just hardcode reset
            this.originalClasses = modalContent.className;
            // Remove width and padding constraints
            modalContent.classList.remove('max-w-md', 'p-6', 'w-full');
            // Add wider constraints and no padding (header/footer handles it)
            modalContent.classList.add('max-w-5xl', 'w-[800px]', 'p-0', 'overflow-hidden');
        }

        // Open modal with content
        openModal(this.getModalContent());

        // Fetch data and populate content
        this.fetchData();
    }

    close() {
        this.isOpen = false;

        // Restore modal styling
        const modalContent = document.getElementById('modal-content');
        if (modalContent) {
            // Reset to default standard modal styles found in layout
            modalContent.className = 'bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl transform scale-95 transition-transform duration-200 [&.active]:scale-100';
        }

        closeModal();
    }

    async fetchData() {
        try {
            const res = await fetch('/images/list');
            const data = await res.json();
            this.allItems = data.images || [];
            this.allFolders = data.folders || [];
            this.items = [...this.allItems];
            this.folders = [...this.allFolders];
            this.renderContent();
        } catch (e) {
            console.error("Failed to load images", e);
        }
    }

    // Call this when switching tabs or updating UI
    render() {
        // Find existing container in modal or re-open modal if needed
        const container = document.getElementById('ip-modal-container');
        if (container) {
            container.outerHTML = this.getModalContent();
            this.renderContent(); // Re-populate content area
        }
    }

    getModalContent() {
        // Removed outer shell styling (bg, border, shadow) since modal-content handles it
        // Kept w-full h-[600px] flex flex-col to fill the modal-content
        return `
            <div id="ip-modal-container" class="w-full h-[600px] flex flex-col animate-in fade-in zoom-in duration-200">
                <!-- Header -->
                <div class="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                    <h3 class="text-lg font-semibold text-white">Select Image</h3>
                    <button class="text-zinc-500 hover:text-white" onclick="window._imagePicker.close()">✕</button>
                </div>

                <!-- Tabs -->
                <div class="flex border-b border-zinc-800 bg-zinc-900/30">
                    ${this.renderTab('library', 'Library')}
                    ${this.renderTab('upload', 'Upload Files')}
                    ${this.options.folderSelect ? this.renderTab('folders', 'Upload Folder') : ''}
                    <div class="flex-1"></div>
                    <div class="p-2">
                        <input type="text" placeholder="Search..." class="bg-zinc-950 border border-zinc-700 rounded px-3 py-1 text-sm text-zinc-300 focus:border-teal-500 outline-none" oninput="window._imagePicker.filter(this.value)">
                    </div>
                </div>

                <!-- Content -->
                <div id="ip-content" class="flex-1 overflow-y-auto p-6 bg-zinc-950/30 relative">
                    <!-- Loading... -->
                    <div class="flex justify-center items-center h-full text-zinc-500">Loading...</div>
                </div>

                <!-- Footer -->
                <div class="px-6 py-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                    <div class="text-sm text-zinc-500">
                        ${this.options.multiselect ? '<span id="ip-count">0</span> selected' : ''}
                    </div>
                    <div class="flex gap-3">
                        <button class="px-4 py-2 text-zinc-400 hover:text-white" onclick="window._imagePicker.close()">Cancel</button>
                        <button class="px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-medium shadow-lg shadow-teal-900/20" onclick="window._imagePicker.confirm()">
                            Select
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    renderTab(id, label) {
        const active = this.activeTab === id;
        return `
            <button 
                class="px-6 py-3 text-sm font-medium border-b-2 transition-colors ${active ? 'border-teal-500 text-teal-500 bg-teal-500/5' : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-800/50'}"
                onclick="window._imagePicker.switchTab('${id}')"
            >
                ${label}
            </button>
        `;
    }

    switchTab(tab) {
        this.activeTab = tab;
        this.render(); // Re-render shell
        this.renderContent(); // Render content
    }

    renderContent() {
        const container = document.getElementById('ip-content');
        if (!container) return;

        if (this.activeTab === 'library') {
            if (this.items.length === 0) {
                container.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-zinc-500 pb-10">
                    <div class="text-4xl mb-4 opacity-20">🖼️</div>
                    <p>No images found</p>
                    <button class="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm text-zinc-300" onclick="window._imagePicker.switchTab('upload')">Upload Image</button>
                </div>`;
                return;
            }
            container.innerHTML = `
                <div class="grid grid-cols-4 gap-4">
                    ${this.items.map(item => this.renderCard(item)).join('')}
                </div>
            `;
        } else if (this.activeTab === 'upload') {
            container.innerHTML = `
                <div class="h-full border-2 border-dashed border-zinc-700 rounded-xl flex flex-col items-center justify-center gap-4 text-zinc-400 hover:border-teal-500 hover:bg-zinc-800/20 transition-all cursor-pointer"
                     onclick="document.getElementById('ip-file-input').click()"
                     ondragover="event.preventDefault(); this.classList.add('border-teal-500')"
                     ondragleave="event.preventDefault(); this.classList.remove('border-teal-500')"
                     ondrop="event.preventDefault(); window._imagePicker.handleDrop(event)"
                >
                    <div class="text-4xl">☁️</div>
                    <p class="font-medium">Click to upload or drag & drop</p>
                    <p class="text-xs text-zinc-500">Supports PNG, JPG, WEBP</p>
                    <input type="file" id="ip-file-input" class="hidden" multiple accept="image/*" onchange="window._imagePicker.handleUpload(this.files)">
                </div>
            `;
        } else if (this.activeTab === 'folders') {
            // Folder Upload UI
            container.innerHTML = `
                <div class="flex flex-col h-full">
                    <div class="mb-6 p-6 border-2 border-dashed border-zinc-700 rounded-xl flex flex-col items-center justify-center gap-4 text-zinc-400 hover:border-teal-500 hover:bg-zinc-800/20 transition-all cursor-pointer"
                        onclick="document.getElementById('ip-folder-input').click()">
                        <div class="text-4xl">📂</div>
                        <p class="font-medium">Click to upload a folder</p>
                        <p class="text-xs text-zinc-500">Recursively uploads all images</p>
                        <input type="file" id="ip-folder-input" class="hidden" webkitdirectory directory onchange="window._imagePicker.handleFolderUpload(this.files)">
                    </div>
                    
                    <h3 class="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Managed Folders</h3>
                    <div class="space-y-2">
                        ${this.folders.length === 0 ? '<p class="text-zinc-500 text-sm italic">No folders uploaded yet</p>' : ''}
                        ${this.folders.map(f => `
                            <div class="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 group">
                                <div class="flex items-center gap-3">
                                    <span class="text-xl">📁</span>
                                    <div>
                                        <div class="text-sm font-medium text-zinc-200">${f.name}</div>
                                        <div class="text-xs text-zinc-500 font-mono">${f.path}</div>
                                    </div>
                                </div>
                                <button class="px-3 py-1 bg-zinc-800 hover:bg-teal-500/20 hover:text-teal-400 text-xs rounded transition-colors" onclick="window._imagePicker.selectFolder('${f.id}')">Select</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }

    renderCard(item) {
        const selected = this.selected.has(item.id);
        const name = item.name;
        const url = `/images/raw/${item.id}`;

        return `
            <div class="group relative aspect-square bg-zinc-900 rounded-lg border-2 overflow-hidden cursor-pointer transition-all ${selected ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-zinc-800 hover:border-zinc-600'}"
                 onclick="window._imagePicker.toggleSelect('${item.id}')">
                <img src="${url}" class="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" onerror="this.src='/assets/placeholder.png'">
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                    <span class="text-xs text-white truncate w-full shadow-black drop-shadow-md">${name}</span>
                </div>
                ${selected ? '<div class="absolute top-2 right-2 bg-teal-500 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg">✓</div>' : ''}
            </div>
        `;
    }

    toggleSelect(id) {
        if (this.options.multiselect) {
            if (this.selected.has(id)) this.selected.delete(id);
            else this.selected.add(id);
        } else {
            this.selected.clear();
            this.selected.add(id);
        }
        this.renderContent();
        this.updateCount();
    }

    selectFolder(id) {
        // Find folder obj
        const f = this.folders.find(x => x.id === id);
        if (this.options.onSelect && f) {
            this.options.onSelect([{ type: 'folder', ...f }]);
            this.close();
        }
    }

    updateCount() {
        const el = document.getElementById('ip-count');
        if (el) el.innerText = this.selected.size;
    }

    async handleUpload(files) {
        if (!files || files.length === 0) return;

        const formData = new FormData();
        Array.from(files).forEach(f => formData.append('files', f));

        // Show loading state
        document.getElementById('ip-content').innerHTML = '<div class="flex justify-center items-center h-full text-zinc-400">Uploading...</div>';

        try {
            const res = await fetch('/images/upload', {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                if (window.showToast) window.showToast('Images uploaded successfully', 'success');
                this.switchTab('library');
                this.fetchData(); // Refresh list
            } else {
                if (window.showToast) window.showToast('Upload failed', 'error');
                else alert('Upload failed');
                this.switchTab('upload');
            }
        } catch (e) {
            console.error(e);
            if (window.showToast) window.showToast('Upload error', 'error');
            else alert('Upload error');
        }
    }

    async handleFolderUpload(files) {
        if (!files || files.length === 0) return;

        const formData = new FormData();
        const folderName = files[0].webkitRelativePath.split('/')[0] || "Uploaded Folder";
        formData.append('folder_name', folderName);

        Array.from(files).forEach(f => {
            formData.append('files', f);
            formData.append('paths', f.webkitRelativePath);
        });

        // Show loading state
        document.getElementById('ip-content').innerHTML = '<div class="flex justify-center items-center h-full text-zinc-400">Uploading folder... This may take a while.</div>';

        try {
            const res = await fetch('/images/upload_folder', {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                if (window.showToast) window.showToast('Folder uploaded successfully', 'success');
                // Return to folders tab
                this.switchTab('folders');
                this.fetchData();
            } else {
                if (window.showToast) window.showToast('Folder upload failed', 'error');
                else alert('Folder upload failed');
            }
        } catch (e) {
            console.error(e);
            if (window.showToast) window.showToast('Folder upload error', 'error');
            else alert('Folder upload error');
        }
    }

    handleDrop(e) {
        const files = e.dataTransfer.files;
        this.handleUpload(files);
    }

    filter(query) {
        if (!this.allItems) return;
        const q = query.toLowerCase();

        if (this.activeTab === 'library') {
            this.items = this.allItems.filter(i => i.name.toLowerCase().includes(q));
        } else if (this.activeTab === 'folders') {
            this.folders = this.allFolders.filter(f => f.name.toLowerCase().includes(q));
        }
        this.renderContent();
    }

    confirm() {
        if (this.selected.size === 0) return;

        const selectedItems = this.items.filter(i => this.selected.has(i.id));
        if (this.options.onSelect) {
            this.options.onSelect(selectedItems);
        }
        this.close();
    }
}
