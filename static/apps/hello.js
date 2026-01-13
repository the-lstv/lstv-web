// Create application context
const app = new website.ContentContext({ id: "resourcemanager" });

// Setup HTML
app.fromElement(LS.Create({
    tag: "h1",
    inner: "Hello world!"
}));

// Register module
app.registerModule(class extends LS.Context {
    constructor(context, container) {
        super();
        this.context = context;
        this.container = container;

        container.appendChild(LS.Create({
            tag: "p",
            inner: "This is a hello world app."
        }));
    }

    destroy() {
        super.destroy();
    }
});

// Create window
const win = new website.Window("Hello World App");

// Navigate to app
win.renderFrom(app);