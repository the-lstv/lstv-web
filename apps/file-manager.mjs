class FileManagerState {
    pwd = "/";
}

class FileManager extends website.ContentContext {
    states = new Set;

    constructor() {
        super({
            title: "File Manager",
            id: "file-manager"
        });

        this.content = LS.Create("div", {
            class: "file-manager-container",
            style: {
                width: "100%",
                height: "100%"
            }
        });

        this.fromElement(this.content);

        // Now let's create a window
        // The window will automatically show our content because we created it from here.
        // But since a window is an instance of viewport, we can also use it like any other viewport.
        const win = this.createWindow({
            title: "File Manager",
            width: 400,
            height: 300
        });

        this.addDestroyable(win, this.content);

        this.states.add(new FileManagerState());
    }

    suspend() {}

    resume() {}

    destroy() {
        this.content.remove();
        this.content = null;

        super.destroy();
    }
}

export default FileManager;