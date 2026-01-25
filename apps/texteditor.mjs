class TextEditor extends website.ContentContext {
    constructor() {
        super({
            id: "text-editor",
            title: "Text Editor",
            icon: "a8364c67b10f30d6.svg",
        });

        this.fromElement(LS.Create({
            tag: "div",
            class: "text-editor",
            inner: [
                { tag: "textarea", class: "text-area", style: "width: 100%; height: 100%; box-sizing: border-box;", placeholder: "Start typing..." }
            ]
        }));

        this.window = this.createWindow({
            title: "Text Editor",
            width: 600,
            height: 400,
        });
    }

    destroy() {
        this.window.destroy();
        super.destroy();
    }
}

export default TextEditor;