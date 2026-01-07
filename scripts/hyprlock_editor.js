class HyprlockEditor {
    constructor() {
        this.config = null;
        this.widgets = []; // array of { id, type, data, element }
        this.selectedId = null;
        this.canvas = document.getElementById('editor-canvas');
        this.scale = 0.5;
        this.dragState = { active: false, startX: 0, startY: 0, initialLeft: 0, initialTop: 0 };

        // Preset management
        this.presets = [];
        this.activePreset = null;
        this.saveTimeout = null;

        this.init();
    }

    async init() {
        this.setupDragAndDrop();
        this.setupCanvasInteractions();
        this.setupCanvasControls();
        await Promise.all([
            this.loadConfig(),
            this.loadPresets()
        ]);
        this.render();
        this.renderPresetSelector();
        setTimeout(() => this.fitToContainer(), 100);
    }

    setupCanvasControls() {
        // Zoom slider
        const zoomSlider = document.getElementById('zoom-slider');
        if (zoomSlider) {
            zoomSlider.value = this.scale * 100;
            zoomSlider.oninput = (e) => {
                this.setZoom(parseInt(e.target.value) / 100);
            };
        }

        // Zoom display
        this.updateZoomDisplay();
    }

    setCanvasSize(width, height) {
        this.canvasWidth = width;
        this.canvasHeight = height;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.render();
    }

    setZoom(scale) {
        this.scale = Math.max(0.1, Math.min(1.5, scale));
        this.canvas.style.transform = `scale(${this.scale})`;
        this.updateZoomDisplay();
    }

    updateZoomDisplay() {
        const display = document.getElementById('zoom-display');
        if (display) {
            display.textContent = `${Math.round(this.scale * 100)}%`;
        }
        const slider = document.getElementById('zoom-slider');
        if (slider) {
            slider.value = this.scale * 100;
        }
    }

    fitToContainer() {
        const container = document.getElementById('canvas-container');
        if (!container || !this.canvas) return;

        const padding = 10;
        const containerWidth = container.clientWidth - padding;
        const containerHeight = container.clientHeight - padding;

        const canvasWidth = parseInt(this.canvas.style.width) || 1920;
        const canvasHeight = parseInt(this.canvas.style.height) || 1080;

        const scaleX = containerWidth / canvasWidth;
        const scaleY = containerHeight / canvasHeight;

        const fitScale = Math.min(scaleX, scaleY, 1.5);

        this.setZoom(fitScale - 0.03);
    }

    resetZoom() {
        this.fitToContainer();
    }

    async loadConfig() {
        try {
            const res = await fetch('/hyprlock/config');
            this.config = await res.json();
            // Convert config to flat widget list
            this.flattenConfig();
        } catch (e) {
            console.error('Failed to load config', e);
        }
    }

    flattenConfig() {
        this.widgets = [];
        let idCounter = 0;

        const add = (list, type) => {
            if (!list) return;
            list.forEach(item => {
                this.widgets.push({
                    id: `w-${idCounter++}`,
                    type,
                    data: { ...item }
                });
            });
        };

        add(this.config.backgrounds, 'background');
        add(this.config.input_fields, 'input-field');
        add(this.config.labels, 'label');
        add(this.config.images, 'image');
        add(this.config.shapes, 'shape');
    }

    async saveConfig() {
        // Reconstruct config object
        const newConfig = {
            general: this.config.general || {},
            auth: this.config.auth || {},
            animations: this.config.animations || {},
            backgrounds: [],
            input_fields: [],
            labels: [],
            images: [],
            shapes: []
        };

        this.widgets.forEach(w => {
            const typeMap = {
                'background': 'backgrounds',
                'input-field': 'input_fields',
                'label': 'labels',
                'image': 'images',
                'shape': 'shapes'
            };
            if (typeMap[w.type]) {
                newConfig[typeMap[w.type]].push(w.data);
            }
        });

        try {
            const res = await fetch('/hyprlock/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig)
            });

            if (res.ok) {
                showToast('Configuration saved!', 'success');
            } else {
                showToast('Failed to save configuration', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error saving configuration', 'error');
        }
    }

    // Debounced autosave (500ms delay)
    triggerAutosave() {
        if (this.isAutosaveEnabled()) {
            if (this.saveTimeout) clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(() => this.saveConfig(), 500);
        }
    }

    isAutosaveEnabled() {
        return typeof ArchBoard !== 'undefined' ? ArchBoard.settings.autosaveEnabled : false;
    }

    render() {
        const layer = document.getElementById('canvas-widgets-layer');
        const bgLayer = document.getElementById('canvas-background-layer');
        layer.innerHTML = '';
        bgLayer.innerHTML = '';

        // Sort by z-index (ascending - lower values render first/behind)
        const sortedWidgets = [...this.widgets].sort((a, b) => {
            const zA = a.data.zindex ?? (a.type === 'background' ? -1 : 0);
            const zB = b.data.zindex ?? (b.type === 'background' ? -1 : 0);
            return zA - zB;
        });

        sortedWidgets.forEach(widget => {
            const el = this.createWidgetElement(widget);
            widget.element = el;

            if (widget.type === 'background') {
                bgLayer.appendChild(el);
            } else {
                layer.appendChild(el);
            }
        });

        this.updateSelectionAttributes();
    }

    createWidgetElement(widget) {
        const el = document.createElement('div');
        el.id = widget.id;
        // pointer-events-auto to override parent's pointer-events-none
        el.className = 'absolute transition-shadow hover:ring-1 hover:ring-teal-500/50 cursor-pointer select-none pointer-events-auto';

        // Z-index: use the configured value, default backgrounds to -1, others to 0
        const zindex = widget.data.zindex ?? (widget.type === 'background' ? -1 : 0);
        el.style.zIndex = zindex + 10; // Offset by 10 so -1 becomes 9, 0 becomes 10, etc.

        const [posX, posY] = this.parseVec2(widget.data.position || "0, 0");
        const centerX = 1920 / 2;
        const centerY = 1080 / 2;

        // Apply alignment
        const halign = widget.data.halign || 'center';
        const valign = widget.data.valign || 'center';

        // Base Point based on align
        let baseX = centerX;
        let baseY = centerY;

        if (halign === 'left') baseX = 0;
        if (halign === 'right') baseX = 1920;
        if (valign === 'top') baseY = 0;
        if (valign === 'bottom') baseY = 1080;

        // Y coordinate flipper: Hyprlock Y is UP, CSS Y is Down
        const cssY = -posY;

        el.style.left = `${baseX + posX}px`;
        el.style.top = `${baseY + cssY}px`;

        // Transformations for anchor point
        let translateX = '0%';
        let translateY = '0%';

        if (halign === 'center') translateX = '-50%';
        if (halign === 'right') translateX = '-100%';

        if (valign === 'center') translateY = '-50%';
        if (valign === 'bottom') translateY = '-100%';

        el.style.transform = `translate(${translateX}, ${translateY})`;

        // Content Rendering
        this.renderWidgetContent(el, widget);

        // Events
        el.onmousedown = (e) => this.handleMouseDown(e, widget);

        return el;
    }

    renderWidgetContent(el, widget) {
        const d = widget.data;

        if (widget.type === 'label') {
            let text = d.text || "Label";

            // Text Parsing logic for preview
            if (text.startsWith('cmd[')) {
                // Extract the command part after ]
                const cmdMatch = text.match(/cmd\[.*?\](.*)/);
                if (cmdMatch) {
                    let cmdText = cmdMatch[1].trim();
                    // Try to extract echo content
                    const echoMatch = cmdText.match(/echo\s+["'](.*)["']/);
                    if (echoMatch) {
                        text = echoMatch[1];
                        // Unescape quotes
                        text = text.replace(/\\"/g, '"');
                        text = text.replace(/\\'/g, "'");
                    } else {
                        text = cmdText; // Fallback to raw command
                    }
                }
            }

            // Variable Substitution - use actual username from environment or "shash" as fallback
            text = text.replace(/\$USER/g, 'shash');

            // Date substitution - handle $(date ...) patterns
            text = text.replace(/\$\(date\s*\+?"([^"]+)"\)/g, (match, fmt) => {
                const now = new Date();
                // Basic format substitution
                let result = fmt;
                result = result.replace('%A', now.toLocaleDateString('en-US', { weekday: 'long' }));
                result = result.replace('%d', String(now.getDate()).padStart(2, '0'));
                result = result.replace('%m', String(now.getMonth() + 1).padStart(2, '0'));
                result = result.replace('%Y', now.getFullYear());
                result = result.replace('%-I', now.getHours() % 12 || 12);
                result = result.replace('%I', String(now.getHours() % 12 || 12).padStart(2, '0'));
                result = result.replace('%M', String(now.getMinutes()).padStart(2, '0'));
                result = result.replace('%p', now.getHours() >= 12 ? 'PM' : 'AM');
                return result;
            });

            // Also handle simpler $(date) or $TIME
            text = text.replace(/\$TIME12/g, new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
            text = text.replace(/\$TIME/g, new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));

            // Strip pango span tags for simple preview, but keep the text
            text = text.replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '');

            el.innerText = text; // Use innerText for safety, or innerHTML if you want span styling

            // Color
            el.style.color = this.parseColor(d.color);
            el.style.fontSize = `${d.font_size || 16}pt`;
            el.style.fontFamily = d.font_family || 'Sans';
            // Rotation - need to preserve existing transform
            const existingTransform = el.style.transform || '';
            if (d.rotate) el.style.transform = existingTransform + ` rotate(${-d.rotate}deg)`;
            el.style.whiteSpace = 'nowrap';
            // Shadow
            if (d.shadow_passes > 0 && d.shadow_size > 0) {
                el.style.textShadow = `2px 2px ${d.shadow_size}px ${this.parseColor(d.shadow_color || 'black')}`;
            }

        } else if (widget.type === 'input-field') {
            const [w, h] = this.parseVec2(d.size || "200, 50");
            el.style.width = `${w}px`;
            el.style.height = `${h}px`;
            el.style.backgroundColor = this.parseColor(d.inner_color);
            el.style.border = `${d.outline_thickness || 0}px solid ${this.parseColor(d.outer_color)}`;
            el.style.borderRadius = d.rounding === -1 ? `${h / 2}px` : `${d.rounding}px`;

            el.classList.add('flex', 'items-center', 'justify-center', 'text-sm');
            if (d.placeholder_text) {
                const temp = document.createElement('div');
                temp.innerHTML = d.placeholder_text;
                el.innerText = temp.innerText || 'Input Password...';
            } else {
                el.innerText = 'Input Password...';
            }
            el.style.color = this.parseColor(d.font_color);

        } else if (widget.type === 'shape') {
            const [w, h] = this.parseVec2(d.size || "100, 100");
            el.style.width = `${w}px`;
            el.style.height = `${h}px`;
            el.style.backgroundColor = this.parseColor(d.color);

            if (d.rounding === -1) el.style.borderRadius = `${Math.min(w, h) / 2}px`;
            else if (d.rounding) el.style.borderRadius = `${d.rounding}px`;

            if (d.rotate) el.style.transform += ` rotate(${-d.rotate}deg)`;

        } else if (widget.type === 'image') {
            const targetSize = parseInt(d.size) || 150;
            el.style.overflow = 'hidden';

            // Border on container
            if (d.border_size) {
                el.style.border = `${d.border_size}px solid ${this.parseColor(d.border_color)}`;
            }

            const img = document.createElement('img');

            // Build image URL
            let imgUrl = '/assets/placeholder.png';
            if (d.path) {
                if (d.path.includes('.archboard/images/')) {
                    const filename = d.path.split('/').pop();
                    const id = filename.split('.')[0];
                    imgUrl = `/images/raw/${id}`;
                } else {
                    imgUrl = `/hyprlock/images/preview?path=${encodeURIComponent(d.path)}`;
                }
            }
            img.src = imgUrl;

            // When image loads, calculate proper dimensions based on aspect ratio
            // Size = scale based on the lesser side of the image
            img.onload = () => {
                const naturalW = img.naturalWidth;
                const naturalH = img.naturalHeight;
                const lesserSide = Math.min(naturalW, naturalH);
                const scale = targetSize / lesserSide;

                const displayW = Math.round(naturalW * scale);
                const displayH = Math.round(naturalH * scale);

                el.style.width = `${displayW}px`;
                el.style.height = `${displayH}px`;

                // Apply rounding AFTER we know the dimensions
                // Rounding -1 means stadium/oval shape (half of lesser side creates pill shape)
                if (d.rounding === -1) {
                    const lesserDisplaySide = Math.min(displayW, displayH);
                    el.style.borderRadius = `${lesserDisplaySide / 2}px`;
                } else if (d.rounding !== undefined && d.rounding !== 0) {
                    el.style.borderRadius = `${d.rounding}px`;
                }

                img.style.width = '100%';
                img.style.height = '100%';
            };

            // Set initial size while loading
            el.style.width = `${targetSize}px`;
            el.style.height = `${targetSize}px`;
            el.style.borderRadius = `${targetSize / 2}px`; // Initial circular while loading
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.display = 'block';

            if (d.rotate) {
                const existingTransform = el.style.transform || '';
                el.style.transform = existingTransform + ` rotate(${-d.rotate}deg)`;
            }

            el.appendChild(img);
        } else if (widget.type === 'background') {
            // Add classes without removing base classes (keeps it clickable/selectable)
            el.classList.add('inset-0', 'w-full', 'h-full', 'bg-black');
            el.style.position = 'absolute';
            el.style.cursor = 'pointer';

            if (d.path && d.path !== 'screenshot') {
                let url = '';
                if (d.path.includes('.archboard/images/')) {
                    const id = d.path.split('/').pop().split('.')[0];
                    url = `/images/raw/${id}`;
                } else {
                    url = `/hyprlock/images/preview?path=${encodeURIComponent(d.path)}`;
                }
                el.style.backgroundImage = `url('${url}')`;
                el.style.backgroundSize = 'cover';
                el.style.backgroundPosition = 'center';
            }
            el.style.backgroundColor = this.parseColor(d.color);
            // Blur effect simulation
            if (d.blur_passes > 0) el.style.filter = `blur(${d.blur_passes * (d.blur_size || 1)}px)`;
        }
    }

    parseVec2(str) {
        if (!str) return [0, 0];
        const parts = str.split(',').map(s => parseFloat(s.trim()));
        return [parts[0] || 0, parts[1] || 0];
    }

    parseColor(str) {
        if (!str) return 'transparent';
        // Handle "$variable" - common fallbacks
        if (str.startsWith('$')) {
            if (str === '$foreground') return '#ffffff';
            if (str === '$background') return '#000000';
            return '#aaaaaa'; // Generic variable fallback
        }
        // Handle custom hex "0xff..." -> "#..."
        if (str.startsWith('0x')) {
            return '#' + str.substring(2);
        }
        // rgba/rgb/hex are valid CSS, just return
        return str;
    }

    handleMouseDown(e, widget) {
        e.stopPropagation();
        this.selectedId = widget.id;
        this.render(); // update selection outline
        this.renderPropertiesPanel(widget);

        if (widget.type === 'background') return; // Can't drag BG

        // Drag Start
        this.dragState.active = true;
        this.dragState.startX = e.clientX;
        this.dragState.startY = e.clientY;

        // Store initial Hyprlock pos
        const [x, y] = this.parseVec2(widget.data.position || "0, 0");
        this.dragState.initialX = x;
        this.dragState.initialY = y; // Hyprlock Y

        // Global Move Listener
        const onMove = (em) => {
            if (!this.dragState.active) return;
            const dx = (em.clientX - this.dragState.startX) / this.scale;
            const dy = (em.clientY - this.dragState.startY) / this.scale;

            // Hyprlock Y is UP, so screen dy maps to -HyprlockY
            const newX = Math.round(this.dragState.initialX + dx);
            const newY = Math.round(this.dragState.initialY - dy);

            widget.data.position = `${newX}, ${newY}`;
            this.render();
            // Debounce property panel update?
            const panel = document.getElementById('properties-panel');
            // Updating inputs directly is hard without ID refs, just re-rendering panel on drop or throttling
        };

        const onUp = () => {
            this.dragState.active = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            // Final update of properties panel
            this.renderPropertiesPanel(widget);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    setupDragAndDrop() {
        const toolboxItems = document.querySelectorAll('.draggable-widget');
        toolboxItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('type', item.dataset.type);
            });
        });

        this.canvas.addEventListener('dragover', (e) => e.preventDefault());
        this.canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            const type = e.dataTransfer.getData('type');
            if (type) this.addWidget(type);
        });
    }

    addWidget(type) {
        const defaults = {
            'label': {
                monitor: '',
                text: 'Sample Text',
                text_align: 'center',
                color: 'rgba(254, 254, 254, 1.0)',
                font_size: 16,
                font_family: 'Sans',
                rotate: 0,
                shadow_passes: 0,
                shadow_size: 3,
                shadow_color: 'rgb(0,0,0)',
                shadow_boost: 1.2,
                zindex: 0
            },
            'input-field': {
                monitor: '',
                size: '400, 90',
                outline_thickness: 4,
                dots_size: 0.25,
                dots_spacing: 0.15,
                dots_center: true,
                dots_rounding: -1,
                outer_color: 'rgba(17, 17, 17, 1.0)',
                inner_color: 'rgba(200, 200, 200, 1.0)',
                font_color: 'rgba(10, 10, 10, 1.0)',
                font_family: 'Noto Sans',
                fade_on_empty: true,
                fade_timeout: 2000,
                placeholder_text: '<i>Input Password...</i>',
                hide_input: false,
                rounding: -1,
                check_color: 'rgba(204, 136, 34, 1.0)',
                fail_color: 'rgba(204, 34, 34, 1.0)',
                fail_text: '<i>$FAIL <b>($ATTEMPTS)</b></i>',
                shadow_passes: 0,
                shadow_size: 3,
                shadow_color: 'rgb(0,0,0)',
                shadow_boost: 1.2,
                zindex: 0
            },
            'shape': {
                monitor: '',
                size: '100, 100',
                color: 'rgba(17, 17, 17, 1.0)',
                rounding: -1,
                rotate: 0,
                border_size: 0,
                border_color: 'rgba(0, 207, 230, 1.0)',
                xray: false,
                shadow_passes: 0,
                shadow_size: 3,
                shadow_color: 'rgb(0,0,0)',
                shadow_boost: 1.2,
                zindex: 0
            },
            'image': {
                monitor: '',
                path: '',
                size: 150,
                rounding: -1,
                border_size: 4,
                border_color: 'rgba(221, 221, 221, 1.0)',
                rotate: 0,
                reload_time: -1,
                reload_cmd: '',
                shadow_passes: 0,
                shadow_size: 3,
                shadow_color: 'rgb(0,0,0)',
                shadow_boost: 1.2,
                zindex: 0
            },
            'background': {
                monitor: '',
                path: '',
                color: 'rgba(17, 17, 17, 1.0)',
                blur_passes: 0,
                blur_size: 7,
                noise: 0.0117,
                contrast: 0.8916,
                brightness: 0.8172,
                vibrancy: 0.1696,
                vibrancy_darkness: 0.05,
                reload_time: -1,
                reload_cmd: '',
                crossfade_time: -1.0,
                zindex: -1
            }
        };

        this.widgets.push({
            id: `w-${Date.now()}`,
            type,
            data: {
                ...defaults[type],
                position: '0, 0',
                halign: 'center',
                valign: 'center'
            }
        });
        this.render();
    }

    setupCanvasInteractions() {
        // Get the scrollable container (parent of centering wrapper)
        const container = this.canvas.closest('.overflow-auto');

        let isPanning = false;
        let panStartX = 0;
        let panStartY = 0;
        let scrollStartX = 0;
        let scrollStartY = 0;

        // Click to deselect - only if clicked on canvas layers directly, not on widgets
        this.canvas.onclick = (e) => {
            // Check if we clicked directly on the canvas or its layer containers (not a widget)
            const clickedLayerOrCanvas =
                e.target === this.canvas ||
                e.target.id === 'canvas-background-layer' ||
                e.target.id === 'canvas-widgets-layer';

            // Check if we clicked on a widget (including background widgets)
            const clickedWidget = e.target.closest('[id^="w-"]');

            if (clickedLayerOrCanvas && !clickedWidget) {
                this.selectedId = null;
                this.render();
                this.renderPropertiesPanel(null);
            }
        };

        // Pan on mouse drag in container
        if (container) {
            container.onmousedown = (e) => {
                // Only pan if clicking directly on container or canvas background, not widgets
                const isOnWidget = e.target.closest('.absolute.transition-shadow');
                if (isOnWidget) return;

                isPanning = true;
                panStartX = e.clientX;
                panStartY = e.clientY;
                scrollStartX = container.scrollLeft;
                scrollStartY = container.scrollTop;
                container.style.cursor = 'grabbing';
                e.preventDefault();
            };

            container.onmousemove = (e) => {
                if (!isPanning) return;
                const dx = e.clientX - panStartX;
                const dy = e.clientY - panStartY;
                container.scrollLeft = scrollStartX - dx;
                container.scrollTop = scrollStartY - dy;
            };

            container.onmouseup = () => {
                isPanning = false;
                container.style.cursor = 'default';
            };

            container.onmouseleave = () => {
                isPanning = false;
                container.style.cursor = 'default';
            };

            // Set default cursor
            container.style.cursor = 'grab';
        }
    }

    updateSelectionAttributes() {
        this.widgets.forEach(w => {
            if (this.selectedId === w.id) {
                w.element.classList.add('ring-2', 'ring-teal-500', 'z-50');
            } else {
                w.element.classList.remove('ring-2', 'ring-teal-500', 'z-50');
            }
        });
    }

    renderPropertiesPanel(widget) {
        const panel = document.getElementById('properties-panel');
        if (!widget) {
            panel.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-zinc-500 gap-2 opacity-60"><span class="text-4xl">👆</span><p class="text-sm">Select a widget to edit</p></div>`;
            return;
        }

        // Define property groups by widget type
        const propertyGroups = this.getPropertyGroups(widget.type);

        let html = `
            <div class="space-y-4">
                <div class="flex items-center justify-between pb-2 border-b border-zinc-800">
                     <span class="text-xs font-bold text-teal-500 uppercase">${widget.type}</span>
                     <button class="text-xs text-red-500 hover:text-red-400" onclick="hyprlockEditor.deleteWidget('${widget.id}')">Delete</button>
                </div>
        `;

        for (const group of propertyGroups) {
            const groupFields = group.fields.map(key => {
                const value = widget.data[key] ?? this.getDefaultValue(widget.type, key);
                return this.renderField(key, value, widget);
            }).join('');

            if (groupFields.trim()) {
                html += `
                    <div class="space-y-2">
                        <div class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">${group.name}</div>
                        ${groupFields}
                    </div>
                `;
            }
        }

        html += `</div>`;
        panel.innerHTML = html;
    }

    getPropertyGroups(type) {
        const common = [
            { name: 'Position', fields: ['position', 'halign', 'valign', 'zindex'] }
        ];

        const shadow = { name: 'Shadow', fields: ['shadow_passes', 'shadow_size', 'shadow_color', 'shadow_boost'] };

        switch (type) {
            case 'background':
                return [
                    { name: 'Appearance', fields: ['path', 'color'] },
                    { name: 'Blur', fields: ['blur_passes', 'blur_size', 'noise', 'contrast', 'brightness', 'vibrancy', 'vibrancy_darkness'] },
                    { name: 'Options', fields: ['reload_time', 'reload_cmd', 'crossfade_time', 'zindex'] }
                ];
            case 'image':
                return [
                    { name: 'Source', fields: ['path', 'size'] },
                    { name: 'Style', fields: ['rounding', 'border_size', 'border_color', 'rotate'] },
                    ...common, shadow
                ];
            case 'shape':
                return [
                    { name: 'Appearance', fields: ['size', 'color', 'rounding', 'rotate'] },
                    { name: 'Border', fields: ['border_size', 'border_color', 'xray'] },
                    ...common, shadow
                ];
            case 'input-field':
                return [
                    { name: 'Size & Shape', fields: ['size', 'outline_thickness', 'rounding'] },
                    { name: 'Colors', fields: ['outer_color', 'inner_color', 'font_color', 'check_color', 'fail_color'] },
                    { name: 'Dots', fields: ['dots_size', 'dots_spacing', 'dots_center', 'dots_rounding'] },
                    { name: 'Text', fields: ['font_family', 'placeholder_text', 'fail_text'] },
                    { name: 'Behavior', fields: ['fade_on_empty', 'fade_timeout', 'hide_input'] },
                    ...common, shadow
                ];
            case 'label':
                return [
                    { name: 'Content', fields: ['text', 'text_align'] },
                    { name: 'Style', fields: ['color', 'font_size', 'font_family', 'rotate'] },
                    ...common, shadow
                ];
            default:
                return [{ name: 'Properties', fields: Object.keys(this.widgets.find(w => w.type === type)?.data || {}) }];
        }
    }

    getDefaultValue(type, key) {
        const defaults = {
            'zindex': type === 'background' ? -1 : 0,
            'halign': 'center',
            'valign': 'center',
            'position': '0, 0',
            'rounding': -1,
            'shadow_passes': 0,
            'shadow_size': 3,
            'shadow_color': 'rgb(0,0,0)',
            'shadow_boost': 1.2,
            'blur_passes': 0,
            'blur_size': 7,
            'rotate': 0,
            'border_size': 0,
            'size': type === 'image' ? 150 : '100, 100',
        };
        return defaults[key] ?? '';
    }

    renderField(key, value, widget) {
        let input = '';
        const inputClass = "w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:border-teal-500 outline-none";
        const val = value ?? '';

        // Color fields
        if (key.includes('color')) {
            input = `
                <div class="flex gap-2">
                    <input type="color" class="w-8 h-6 bg-transparent border-0 cursor-pointer rounded" value="${this.rgbToHex(val)}" onchange="hyprlockEditor.handleColorChange('${widget.id}', '${key}', this.value)">
                    <input type="text" class="${inputClass} flex-1" value="${val}" onchange="hyprlockEditor.updateWidget('${widget.id}', '${key}', this.value)">
                </div>`;
        }
        // Path fields with image picker
        else if (key === 'path') {
            input = `
                <div class="flex gap-2">
                     <input type="text" class="${inputClass} flex-1" value="${val}" onchange="hyprlockEditor.updateWidget('${widget.id}', '${key}', this.value)">
                     <button class="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 text-xs shrink-0" onclick="hyprlockEditor.openImagePicker('${widget.id}')">📁</button>
                </div>`;
        }
        // Text/multiline fields
        else if (key === 'text' || key === 'placeholder_text' || key === 'fail_text') {
            input = `<textarea class="${inputClass}" rows="2" onchange="hyprlockEditor.updateWidget('${widget.id}', '${key}', this.value)">${val}</textarea>`;
        }
        // Alignment dropdowns
        else if (key === 'halign') {
            input = this.renderSelect(widget.id, key, val, ['left', 'center', 'right', 'none']);
        }
        else if (key === 'valign') {
            input = this.renderSelect(widget.id, key, val, ['top', 'center', 'bottom', 'none']);
        }
        else if (key === 'text_align') {
            input = this.renderSelect(widget.id, key, val, ['left', 'center', 'right']);
        }
        // Boolean fields
        else if (['fade_on_empty', 'hide_input', 'dots_center', 'xray'].includes(key)) {
            input = `
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" class="w-4 h-4 accent-teal-500" ${val ? 'checked' : ''} onchange="hyprlockEditor.updateWidget('${widget.id}', '${key}', this.checked)">
                    <span class="text-xs text-zinc-300">${val ? 'Enabled' : 'Disabled'}</span>
                </label>`;
        }
        // Number fields
        else if (['zindex', 'rotate', 'font_size', 'border_size', 'outline_thickness', 'blur_passes', 'blur_size',
            'shadow_passes', 'shadow_size', 'shadow_boost', 'rounding', 'dots_rounding', 'fade_timeout',
            'contrast', 'brightness', 'vibrancy', 'vibrancy_darkness', 'noise', 'reload_time', 'crossfade_time',
            'dots_size', 'dots_spacing'].includes(key)) {
            input = `<input type="number" step="any" class="${inputClass}" value="${val}" onchange="hyprlockEditor.updateWidget('${widget.id}', '${key}', parseFloat(this.value) || 0)">`;
        }
        // Default text input
        else {
            input = `<input type="text" class="${inputClass}" value="${val}" onchange="hyprlockEditor.updateWidget('${widget.id}', '${key}', this.value)">`;
        }

        return `
            <div class="space-y-1">
                <label class="text-xs text-zinc-400 capitalize">${key.replace(/_/g, ' ')}</label>
                ${input}
            </div>
        `;
    }

    renderSelect(widgetId, key, value, options) {
        const inputClass = "w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:border-teal-500 outline-none";
        return `
            <select class="${inputClass}" onchange="hyprlockEditor.updateWidget('${widgetId}', '${key}', this.value)">
                ${options.map(o => `<option value="${o}" ${value === o ? 'selected' : ''}>${o}</option>`).join('')}
            </select>`;
    }

    updateWidget(id, key, value) {
        const w = this.widgets.find(x => x.id === id);
        if (w) {
            // Auto-convert numbers (only if value is a string)
            if (typeof value === 'string' && !isNaN(value) && value.trim() !== '' &&
                !key.includes('color') && !key.includes('text') && !key.includes('position') && !key.includes('path')) {
                value = Number(value);
            }
            w.data[key] = value;
            this.render();
            // Re-render properties panel to show updated values
            this.renderPropertiesPanel(w);
            // Trigger autosave
            this.triggerAutosave();
        }
    }

    deleteWidget(id) {
        this.widgets = this.widgets.filter(w => w.id !== id);
        this.selectedId = null;
        this.render();
        this.renderPropertiesPanel(null);
        showToast('Widget deleted', 'info');
        this.triggerAutosave();
    }

    openImagePicker(widgetId) {
        ImagePicker.open({
            multiselect: false,
            onSelect: (items) => {
                if (items.length > 0) {
                    // We store the full path if possible, or ID if we want to resolve later?
                    // Config needs specific path.
                    // items[0] = { id, name, path }
                    this.updateWidget(widgetId, 'path', items[0].path);
                    // Force re-render properties to show new path
                    const w = this.widgets.find(x => x.id === widgetId);
                    this.renderPropertiesPanel(w);
                }
            }
        });
    }

    rgbToHex(str) {
        return ColorUtils.toHex(str);
    }

    handleColorChange(widgetId, key, hexValue) {
        const widget = this.widgets.find(w => w.id === widgetId);
        if (!widget) return;

        const originalValue = widget.data[key];
        const newValue = ColorUtils.formatUpdate(originalValue, hexValue);

        this.updateWidget(widgetId, key, newValue);
    }

    // =========================================================================
    // PRESET MANAGEMENT
    // =========================================================================

    async loadPresets() {
        try {
            const response = await fetch('/presets/hyprlock');
            const data = await response.json();
            this.presets = data.presets || [];
            this.activePreset = data.active_preset;
        } catch (error) {
            console.error('Failed to load presets:', error);
            this.presets = [];
            this.activePreset = null;
        }
    }

    renderPresetSelector() {
        const container = document.getElementById('preset-selector');
        if (!container) return;

        const activePresetData = this.presets.find(p => p.id === this.activePreset);

        container.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-zinc-500 uppercase">Preset:</span>
                <select id="preset-dropdown" onchange="hyprlockEditor.handlePresetChange(this.value)" 
                    class="bg-zinc-800 border-none text-zinc-200 text-sm rounded-md px-2 py-1 focus:ring-1 focus:ring-teal-500 cursor-pointer outline-none hover:bg-zinc-700">
                    <option value="">-- No Preset --</option>
                    ${this.presets.map(p => `
                        <option value="${p.id}" ${p.id === this.activePreset ? 'selected' : ''}>
                            ${p.name}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="flex items-center gap-1">
                <button class="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded transition-colors" 
                    onclick="hyprlockEditor.showSavePresetModal()" title="Save as new preset">
                    💾 Save As
                </button>
                ${this.presets.length > 0 ? `
                    <button class="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded transition-colors"
                        onclick="hyprlockEditor.showManagePresetsModal()" title="Manage presets">
                        ⚙️
                    </button>
                ` : ''}
            </div>
        `;
    }

    async handlePresetChange(presetId) {
        if (!presetId) {
            // Deactivate current preset
            try {
                await fetch('/presets/hyprlock/deactivate', { method: 'POST' });
                this.activePreset = null;
                this.renderPresetSelector();
                showToast('Preset deactivated', 'info');
            } catch (e) {
                showToast('Failed to deactivate preset', 'error');
            }
            return;
        }

        await this.activatePreset(presetId);
    }

    async activatePreset(presetId) {
        try {
            const response = await fetch(`/presets/hyprlock/${presetId}/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ backup_current: true })
            });

            if (!response.ok) throw new Error('Activation failed');

            this.activePreset = presetId;

            // Reload config to reflect changes
            await this.loadConfig();
            this.render();
            this.renderPresetSelector();

            const preset = this.presets.find(p => p.id === presetId);
            showToast(`Preset "${preset?.name || presetId}" activated!`, 'success');
        } catch (e) {
            showToast('Failed to activate preset', 'error');
            document.getElementById('preset-dropdown').value = this.activePreset || '';
        }
    }

    showSavePresetModal() {
        openModal(`
            <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-bold text-zinc-100">Save Preset</h2>
                <button onclick="closeModal()" class="text-zinc-400 hover:text-white">✕</button>
            </div>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm text-zinc-400 mb-1">Preset Name</label>
                    <input type="text" id="preset-name" placeholder="My Lockscreen Theme"
                        class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:border-teal-500 outline-none">
                </div>
                <div>
                    <label class="block text-sm text-zinc-400 mb-1">Description (optional)</label>
                    <textarea id="preset-description" placeholder="Dark theme with blurred background..."
                        class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:border-teal-500 outline-none h-20 resize-none"></textarea>
                </div>
                <div class="flex justify-end gap-2 mt-6">
                    <button onclick="closeModal()" class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg">Cancel</button>
                    <button onclick="hyprlockEditor.saveNewPreset()" class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg">Save Preset</button>
                </div>
            </div>
        `);
    }

    async saveNewPreset() {
        const name = document.getElementById('preset-name')?.value?.trim();
        const description = document.getElementById('preset-description')?.value?.trim() || '';

        if (!name) {
            showToast('Preset name is required', 'error');
            return;
        }

        try {
            // First save current config to file
            await this.saveConfig();

            // Then create preset from current config
            const response = await fetch('/presets/hyprlock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description })
            });

            if (!response.ok) throw new Error('Failed to create preset');

            const preset = await response.json();
            this.presets.push(preset);
            this.activePreset = preset.id;
            this.renderPresetSelector();

            closeModal();
            showToast(`Preset "${name}" saved!`, 'success');
        } catch (e) {
            showToast('Failed to save preset', 'error');
        }
    }

    showManagePresetsModal() {
        const presetRows = this.presets.map(p => `
            <div class="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg ${p.id === this.activePreset ? 'ring-1 ring-teal-500' : ''}">
                <div>
                    <div class="font-medium text-zinc-200">${p.name}</div>
                    <div class="text-xs text-zinc-500">${p.description || 'No description'}</div>
                </div>
                <div class="flex items-center gap-2">
                    ${p.id !== this.activePreset ? `
                        <button onclick="hyprlockEditor.activatePreset('${p.id}'); closeModal();" 
                            class="px-2 py-1 bg-teal-600 hover:bg-teal-500 text-white text-xs rounded">Activate</button>
                    ` : '<span class="text-xs text-teal-400">Active</span>'}
                    <button onclick="hyprlockEditor.deletePreset('${p.id}')" 
                        class="px-2 py-1 bg-red-900/50 hover:bg-red-800 text-red-300 text-xs rounded">Delete</button>
                </div>
            </div>
        `).join('');

        openModal(`
            <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-bold text-zinc-100">Manage Presets</h2>
                <button onclick="closeModal()" class="text-zinc-400 hover:text-white">✕</button>
            </div>
            <div class="space-y-2 max-h-80 overflow-y-auto">
                ${presetRows || '<p class="text-zinc-500 text-center py-4">No presets saved yet</p>'}
            </div>
            <div class="flex justify-end gap-2 mt-6">
                <button onclick="closeModal()" class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg">Close</button>
            </div>
        `);
    }

    async deletePreset(presetId) {
        if (!confirm('Delete this preset? This cannot be undone.')) return;

        try {
            const response = await fetch(`/presets/hyprlock/${presetId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Delete failed');

            this.presets = this.presets.filter(p => p.id !== presetId);
            if (this.activePreset === presetId) this.activePreset = null;

            this.renderPresetSelector();
            this.showManagePresetsModal(); // Refresh modal
            showToast('Preset deleted', 'success');
        } catch (e) {
            showToast('Failed to delete preset', 'error');
        }
    }

    // =========================================================================
    // FULL SCREEN PREVIEW
    // =========================================================================

    toggleFullScreen() {
        const editor = document.getElementById('hyprlock-editor');
        const container = document.getElementById('canvas-container');
        const exitBtn = document.getElementById('exit-fullscreen-btn');

        // Check if we are currently in our internal "preview mode" state
        const isFullScreen = document.body.classList.contains('hyprlock-fullscreen');

        if (!isFullScreen) {
            // ENTER Full Screen
            document.body.classList.add('hyprlock-fullscreen');

            // Auto-fit zoom logic
            const screenW = window.screen.width;
            const screenH = window.screen.height;
            // Assuming default canvas size 1920x1080, or get from current settings
            // Ideally we'd read current canvas dims if dynamic, but fixed for now/safe default
            const scaleX = screenW / 1920;
            const scaleY = screenH / 1080;
            const fitScale = Math.min(scaleX, scaleY);

            // Store previous scale to restore later
            this.prevScale = this.scale;
            this.setZoom(fitScale);

            // Try to make browser go full screen
            if (container.requestFullscreen) container.requestFullscreen();
            else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();

            if (exitBtn) exitBtn.classList.remove('hidden');

        } else {
            // EXIT Full Screen
            document.body.classList.remove('hyprlock-fullscreen');

            // Restore previous scale
            if (this.prevScale) this.setZoom(this.prevScale);
            else this.setZoom(0.5); // Default fallback

            // Exit browser full screen
            if (document.exitFullscreen) document.exitFullscreen().catch(e => { });
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen().catch(e => { });

            if (exitBtn) exitBtn.classList.add('hidden');
        }

        // Force resize update to ensure canvas centers correctly
        setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
    }
}
