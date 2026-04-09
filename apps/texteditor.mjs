class TextEditor extends website.ContentContext {
    constructor() {
        super({
            id: "text-editor",
            title: "Text Editor",
            icon: "a8364c67b10f30d6.svg",
        });

        this.fromElement(LS.Create({
            class: "text-editor",
            inner: [],
            onclick: () => this.addTab()
        }));

        this.tabs = this.addDestroyable(new LS.Tabs(this.content, {
            list: true,
            closeable: true
        }));

        this.window = this.createWindow({
            title: "Text Editor",
            width: 600,
            height: 400,
        });
    }

    addTab() {
        const tab = LS.Create({
            class: "text-editor-tab"
        });

        this.tabs.add(tab);
    }

    destroy() {
        this.window.destroy();
        super.destroy();
    }

    static postInstall(env) {
        // env.registerCommand({});
        env.log("Text Editor installed successfully.");
    }
}

export default TextEditor;