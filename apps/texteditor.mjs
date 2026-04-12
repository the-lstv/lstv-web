class TextEditor extends website.ContentContext {
    static TINYMDE_JS = "https://unpkg.com/tiny-markdown-editor/dist/tiny-mde.min.js";
    static TINYMDE_CSS = "https://unpkg.com/tiny-markdown-editor/dist/tiny-mde.min.css";

    static #loaderPromise = null;
    static #styleElement = null;
    static #scriptElement = null;

    /**
     * Simple text editor with tabs, which allows you to create, open and edit notes.
     * TODO: Implement user storage.
     */
    constructor() {
        super({
            id: "text-editor",
            title: "Text Editor",
            icon: "a8364c67b10f30d6.svg",
            description: "A simple text editor with tabs, which allows you to create, open and edit notes.",
        });

        this.tabMeta = new Map();
        this.wordWrapEnabled = true;
        this.activeTabId = null;
        this.editorReady = false;
        this.suppressEditorChange = false;
        this.tabSwitchToken = 0;

        this.fromElement(LS.Create({
            class: "text-editor",
            attributes: {
                "data-ls-state": "loading"
            },
            inner: [
                {
                    tag: "nav",
                    class: "editor-header level-2",
                    inner: [
                        {
                            tag: "div",
                            inner: [
                                { tag: "div", class: "header-menu-category", tabindex: "0", text: "File" },
                                { tag: "div", class: "header-menu-category", tabindex: "0", text: "Options" },
                                { tag: "div", class: "header-menu-category", tabindex: "0", text: "Help" }
                            ]
                        }
                    ]
                },
                {
                    class: "text-editor-workspace",
                    inner: [
                        (this.tabsHost = LS.Create({ class: "text-editor-tabs-host" })),
                        {
                            class: "text-editor-editor-host",
                            inner: [
                                (this.toolbarContainer = LS.Create({ })),
                                (this.editorTextarea = LS.Create({ tag: "textarea" }))
                            ]
                        }
                    ]
                }
            ]
        }));

        this.tabs = this.addDestroyable(new LS.Tabs(this.tabsHost, {
            list: true,
            closeable: true,
            listButtons: true
        }));

        this.addExternalEventListener(this.tabs, "button", () => this.addTab());
        this.addExternalEventListener(this.tabs, "close", (id) => this.#handleTabClose(id));
        this.addExternalEventListener(this.tabs, "change", (id, oldId) => this.#switchTab(id, oldId));

        this.#setupMenus();

        this.window = this.createWindow({
            title: "Text Editor",
            width: 600,
            height: 400
        });

        this.addExternalEventListener(this.window, "resize", () => this.#syncEditorSize());

        if(typeof ResizeObserver !== "undefined") {
            this.resizeObserver = this.addDestroyable(new ResizeObserver(() => this.#syncEditorSize()));
            this.resizeObserver.observe(this.editorTextarea.parentElement);
        }

        this.addTab();
        this.tabs.set(0);

        this.#loadTinyMDE().then(() => {
            if(this.destroyed) return;
            this.content.setAttribute("data-ls-state", "ready");
            this.#initializeEditor();
            this.#syncEditorSize();
        }).catch((error) => {
            if(this.destroyed) return;

            this.content.setAttribute("data-ls-state", "error");
            console.error("Failed to load TinyMDE", error);
            LS.Toast.show("Failed to load editor library.", { accent: "red" });
        });
    }

    addTab() {
        const tab = LS.Create({
            class: "text-editor-tab",
            inner: [
                { class: "text-editor-tab-placeholder" }
            ]
        });

        const id = this.tabs.add(tab, { title: "Untitled" });
        if(!id) return null;

        this.tabMeta.set(id, {
            id,
            element: tab,
            fileHandle: null,
            fileName: null,
            dirty: false,
            lastValue: ""
        });

        this.tabs.set(id);
        this.#updateWindowTitle();
        return id;
    }

    async openFile() {
        if(typeof window.showOpenFilePicker === "function") {
            try {
                const [handle] = await window.showOpenFilePicker({
                    types: [{
                        description: "Text and Markdown files",
                        accept: {
                            "text/plain": [".txt", ".md", ".markdown", ".json", ".js", ".ts", ".mjs", ".html", ".css", ".scss"]
                        }
                    }],
                    multiple: false
                });

                if(!handle) return;
                await this.#openHandleInTab(handle);
                return;
            } catch (error) {
                if(error?.name === "AbortError") return;
                console.error("Open file picker failed", error);
            }
        }

        await this.#openFileFallback();
    }

    async saveCurrentFile(saveAs = false) {
        const tab = this.#getCurrentTab();
        if(!tab) return false;

        const content = this.#getEditorContent();

        if(!saveAs && tab.fileHandle && typeof tab.fileHandle.createWritable === "function") {
            try {
                const writable = await tab.fileHandle.createWritable();
                await writable.write(content);
                await writable.close();
                this.#markTabSaved(tab.id, content);
                return true;
            } catch (error) {
                console.error("Save failed", error);
                LS.Toast.show("Failed to save file.", { accent: "red" });
                return false;
            }
        }

        if(typeof window.showSaveFilePicker === "function") {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: tab.fileName || "untitled.md",
                    types: [{
                        description: "Text and Markdown files",
                        accept: {
                            "text/plain": [".txt", ".md", ".markdown"]
                        }
                    }]
                });

                if(!handle) return false;
                const writable = await handle.createWritable();
                await writable.write(content);
                await writable.close();

                tab.fileHandle = handle;
                tab.fileName = handle.name || tab.fileName || "Untitled";
                this.#markTabSaved(tab.id, content);
                this.#setTabTitle(tab.id, tab.fileName);
                return true;
            } catch (error) {
                if(error?.name === "AbortError") return false;
                console.error("Save as failed", error);
            }
        }

        this.#downloadFallback(tab.fileName || "untitled.md", content);
        this.#markTabSaved(tab.id, content);
        return true;
    }

    suspend() {
        if(this.content) this.content.setAttribute("data-ls-state", "suspended");
    }

    resume() {
        if(this.content && this.content.getAttribute("data-ls-state") === "suspended") {
            this.content.setAttribute("data-ls-state", "ready");
        }
        this.#syncEditorSize();
    }

    destroy() {
        if(this.editor && this.changeListener && typeof this.editor.removeEventListener === "function") {
            this.editor.removeEventListener("change", this.changeListener);
        }

        this.editor = null;
        this.changeListener = null;
        this.tabMeta.clear();
        this.#releaseTinyMDE();

        this.window.destroy();
        super.destroy();
    }

    #setupMenus() {
        const menus = {
            file: [
                { text: "New", action: () => this.addTab() },
                { text: "Open...", action: () => this.openFile() },
                { type: "separator" },
                { text: "Save", action: () => this.saveCurrentFile(false) },
                { text: "Save As...", action: () => this.saveCurrentFile(true) },
                { type: "separator" },
                { text: "Close Tab", action: () => this.#closeActiveTab() }
            ],

            options: [
                {
                    text: "Word Wrap",
                    type: "checkbox",
                    checked: true,
                    action: (item) => this.#setWordWrap(!!item.checked)
                }
            ],

            help: [
                {
                    text: "About",
                    action: () => {
                        LS.Modal.buildEphemeral({
                            title: "Text Editor",
                            content: "Simple note editor with tabs and Markdown support.",
                            buttons: [{ label: "Close" }]
                        });
                    }
                }
            ]
        };

        for(const menuCategoryElement of this.content.querySelectorAll(".header-menu-category")) {
            const menuTitle = menuCategoryElement.innerText.toLowerCase();
            const menuItems = menus[menuTitle] || [];
            if(menuItems.length === 0) continue;

            this.addDestroyable(new LS.Menu({
                adjacentElement: menuCategoryElement,
                items: menuItems,
                group: "ls-text-editor-header-menu"
            }));
        }
    }

    #switchTab(id, oldId) {
        if(this.destroyed) return;

        if(oldId) {
            const oldTab = this.tabMeta.get(oldId);
            if(oldTab) {
                oldTab.lastValue = this.#getEditorContent();
                oldTab.dirty = oldTab.lastValue !== (oldTab.savedValue || "");
                this.#setTabTitle(oldId, oldTab.fileName || "Untitled");
            }
        }

        this.activeTabId = id;
        const tab = this.tabMeta.get(id);
        if(!tab) return;

        if(this.editor) {
            const token = ++this.tabSwitchToken;
            this.suppressEditorChange = true;
            this.editor.setContent(tab.lastValue || "");
            this.requestAnimationFrame(() => {
                if(this.tabSwitchToken === token) {
                    this.suppressEditorChange = false;
                }
            });
            this.#syncEditorSize();
        }

        this.#updateWindowTitle();
    }

    #handleTabClose(id) {
        const tab = this.tabMeta.get(id);
        if(!tab) return true;

        if(tab.dirty) {
            const shouldClose = window.confirm("This tab has unsaved changes. Close it anyway?");
            if(!shouldClose) return false;
        }

        if(this.activeTabId === id) {
            tab.lastValue = this.#getEditorContent();
        }

        this.tabMeta.delete(id);
        if(this.activeTabId === id) this.activeTabId = null;

        if(this.tabMeta.size === 0) {
            this.addTab();
        }

        return true;
    }

    #closeActiveTab() {
        if(!this.tabs?.activeTab) return;

        const id = this.tabs.activeTab;
        if(this.#handleTabClose(id) === false) return;

        this.tabs.setClosestNextTo(id);
        this.tabs.remove(id);
        this.tabs.renderList();

        if(this.tabs.order.length === 0) {
            this.addTab();
        }
    }

    #initializeEditor() {
        if(this.editor || !window.TinyMDE) return;

        this.editor = new window.TinyMDE.Editor({
            textarea: this.editorTextarea,
            content: ""
        });

        this.toolbar = new window.TinyMDE.CommandBar({
            element: this.toolbarContainer,
            editor: this.editor
        });

        this.changeListener = (event) => {
            if(this.suppressEditorChange) return;
            const activeTab = this.#getCurrentTab();
            if(!activeTab) return;

            const content = typeof event?.content === "string" ? event.content : this.#getEditorContent();
            activeTab.lastValue = content;
            activeTab.savedValue ??= "";
            activeTab.dirty = content !== activeTab.savedValue;
            this.#setTabTitle(activeTab.id, activeTab.fileName || "Untitled");
        };

        this.editor.addEventListener("change", this.changeListener);
        this.editorReady = true;
        this.#syncActiveEditor();
    }

    #syncActiveEditor() {
        const tab = this.#getCurrentTab();
        if(!tab || !this.editor) return;

        const token = ++this.tabSwitchToken;
        this.suppressEditorChange = true;
        this.editor.setContent(tab.lastValue || "");
        this.requestAnimationFrame(() => {
            if(this.tabSwitchToken === token) {
                this.suppressEditorChange = false;
            }
        });
        this.#syncEditorSize();
    }

    #getEditorContent() {
        if(this.editor?.getContent) return this.editor.getContent();
        return this.editorTextarea?.value || "";
    }

    #markTabSaved(id, content) {
        const tab = this.tabMeta.get(id);
        if(!tab) return;

        tab.lastValue = content;
        tab.savedValue = content;
        tab.dirty = false;
        this.#setTabTitle(id, tab.fileName || "Untitled");
    }

    #setTabTitle(id, baseTitle) {
        const target = this.tabs.tabs.get(id);
        if(!target) return;

        const tab = this.tabMeta.get(id);
        const suffix = tab?.dirty ? " *" : "";
        target.title = (baseTitle || "Untitled") + suffix;
        this.tabs.renderList();
        if(id === this.activeTabId) this.#updateWindowTitle();
    }

    #updateWindowTitle() {
        const tab = this.#getCurrentTab();
        const title = tab ? (tab.fileName || "Untitled") + (tab.dirty ? " *" : "") : "Text Editor";
        if(this.window) this.window.setTitle("Text Editor - " + title);
    }

    #getCurrentTab() {
        if(!this.tabs?.activeTab) return null;
        return this.tabMeta.get(this.tabs.activeTab) || null;
    }

    #setWordWrap(enabled) {
        this.wordWrapEnabled = !!enabled;
        this.content.classList.toggle("text-editor-nowrap", !this.wordWrapEnabled);

        if(this.editor?.setContent && this.editorReady) {
            this.#syncActiveEditor();
        }
    }

    #downloadFallback(name, content) {
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = LS.Create("a", {
            href: url,
            download: name || "untitled.md"
        });

        link.click();
        URL.revokeObjectURL(url);
    }

    async #openHandleInTab(handle) {
        const file = await handle.getFile();
        const text = await file.text();
        const id = this.addTab();
        if(!id) return;

        const tab = this.tabMeta.get(id);
        if(!tab) return;

        tab.fileHandle = handle;
        tab.fileName = file.name || "Untitled";
        tab.lastValue = text;
        tab.savedValue = text;
        tab.dirty = false;
        this.#setTabTitle(id, tab.fileName);
        if(this.tabs.activeTab === id) {
            this.#syncActiveEditor();
        }
    }

    async #openFileFallback() {
        const input = LS.Create("input", {
            type: "file",
            accept: ".txt,.md,.markdown,.json,.js,.ts,.mjs,.html,.css,.scss"
        });

        this.addDestroyable(input);

        const result = await new Promise((resolve) => {
            this.addExternalEventListener(input, "change", () => {
                const file = input.files?.[0];
                if(!file) return resolve(null);
                resolve(file);
            });
            input.click();
        });

        if(!result) return;

        const text = await result.text();
        const id = this.addTab();
        if(!id) return;

        const tab = this.tabMeta.get(id);
        if(!tab) return;

        tab.fileName = result.name || "Untitled";
        tab.lastValue = text;
        tab.savedValue = text;
        tab.dirty = false;
        this.#setTabTitle(id, tab.fileName);
        if(this.tabs.activeTab === id) {
            this.#syncActiveEditor();
        }
    }

    #syncEditorSize() {
        if(!this.editorTextarea || !this.editorTextarea.parentElement) return;

        const host = this.editorTextarea.parentElement;
        const height = host.clientHeight;
        const editorElement = host.querySelector(".TinyMDE");

        if(editorElement && height > 0) {
            editorElement.style.height = height + "px";
            editorElement.style.maxHeight = height + "px";
        }
    }

    async #loadTinyMDE() {
        if(window.TinyMDE) return;

        if(!TextEditor.#loaderPromise) {
            TextEditor.#loaderPromise = new Promise((resolve, reject) => {
                const style = LS.Create("link", {
                    rel: "stylesheet",
                    href: TextEditor.TINYMDE_CSS
                });

                const script = LS.Create("script", {
                    src: TextEditor.TINYMDE_JS
                });

                TextEditor.#styleElement = style;
                TextEditor.#scriptElement = script;

                script.onload = () => resolve();
                script.onerror = (error) => reject(error);

                document.head.append(style, script);
            });
        }

        await TextEditor.#loaderPromise;
    }

    #releaseTinyMDE() {
        // if(TextEditor.#styleElement?.isConnected) TextEditor.#styleElement.remove();
        if(TextEditor.#scriptElement?.isConnected) TextEditor.#scriptElement.remove();

        TextEditor.#styleElement = null;
        TextEditor.#scriptElement = null;
        TextEditor.#loaderPromise = null;
    }

    static destroy() {
        if(TextEditor.#styleElement?.isConnected) TextEditor.#styleElement.remove();
    }
}

export default TextEditor;