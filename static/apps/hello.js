class MyHelloWorldApp extends LS.Context {
    constructor() {
        super();


        // Create application content context
        const app = new website.ContentContext({ id: "myhelloworldapp" });


        // Setup HTML - this can be any HTML element
        // To make it from a string (though usually not recommended) you can do LS.Create({ html: "HTML here" })
        this.content = LS.Create("h1", {
            inner: "Hello world!"
        });


        // Load it into our content context
        app.fromElement(this.content);


        // Create a window
        // The window will already render our content context because we created it from there.
        // But since a window is an instance of viewport, we can use it like any other viewport
        const win = app.createWindow({
            title: "Hello World App",
            width: 400,
            height: 300
        });


        // Remember to add anything you create (including timeouts, events, animations...) under this app to destroyables, which makes cleanup predictable.
        // Always better to overdo it than to forget something.
        // If we call destroy on this context (eg. window closed), it will cleanup everything with it.
        this.addDestroyable(app);
        this.addDestroyable(win);


        // We can also sync destruction events if we want to; now the window closing or kernel can also destroy this context.
        // This is not necessary if you want the app or window to live independently, but recommended for simple apps.
        app.on("destroy", () => this.destroy());
        win.on("destroy", () => this.destroy());
    }
}

// Instantiate the app
new MyHelloWorldApp();
// A window saying "Hello world!" should now appear