class FileManagerState {
    pwd = "/";
}

const STYLE = `
.file-manager-body {
    display: flex;
}

.file-manager-sidebar {
    width: 200px;
    flex-shrink: 0;
}

.file-manager-content {
    flex-grow: 1;
}
`;

class FileManager extends website.ContentContext {
    states = new Set;

    async getEntries(path) {
        path = RootFs.normalize(path);

        const entries = await this.fs.readDir(path);

        // todo: async (ill do that when we have actually filesystems that need async, tmpfs is always sync (i mean duh))
        for(let i = 0; i < entries.length; i++) {
            const name = entries[i];
            const fpath = RootFs.join(path, name);
            try {
                entries[i] = await this.fs.stat(fpath);
                entries[i].label = name;
                entries[i].path = fpath;

                if(entries[i].isDirectory()) {
                    entries[i].lazy = true;
                }
            } catch(e) {
                entries[i] = {
                    label: name,
                    path: fpath,
                    invalid: true,
                    error: e
                };
            }
        }

        return entries;
    }

    constructor() {
        super({
            title: "File Manager",
            id: "file-manager"
        });

        this.fs = kernel.fileSystem; // later this should be through Process

        this.tree = new LS.Tree({
            lazy: true,
            // createNode: (node)          => {
            //     return document.createElement("div");
            // },

            loadData: async (node)      => {
                if(node.path) {
                    const entries = await this.getEntries(node.path);
                    return entries;
                }

                return [];
            },

            updateNode: (node, element) => {
                
            },
        });

        this.content = LS.Create("div", {
            class: "file-manager-container",

            style: {
                width: "100%",
                height: "100%"
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
                    class: "file-manager-body",
                    inner: [
                        {
                            class: "file-manager-sidebar"
                        },
                        {
                            class: "file-manager-content",
                            inner: this.tree
                        },
                    ]
                },

                { tag: "style", inner: STYLE }
            ]
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

        this.navigateTo("/");
    }

    async navigateTo(path) {
        const entries = await this.getEntries(path);
        this.tree.loadData(entries);
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