class MyHelloWorldApp extends website.ContentContext {

    // This constructor will be called when your application is opened
    constructor() {
        super({
            title: "Hello World Application",
            id: "hello-world-app"
        });


        // Setup content - this can be any HTML element
        // To make it from a string (usually not recommended - be careful with user input), you can use LS.Create({ html: "HTML here" })
        this.content = LS.Create("h1", {
            text: "Hello world!"
        });


        // Load it into our context
        this.fromElement(this.content);


        // Now let's create a window
        // The window will automatically show our content because we created it from here.
        // But since a window is an instance of viewport, we can also use it like any other viewport.
        const win = this.createWindow({
            title: "Hello World App",
            width: 400,
            height: 300
        });


        // Remember to add anything you create (including timeouts, events, animations...) under this app to destroyables, which makes cleanup predictable.
        // Always better to overdo it than to forget something.
        // If we call destroy on this context (eg. window closed), it will cleanup everything with it.
        this.addDestroyable(win, this.content);
    }

    destroy() {
        // Cleanup anything here

        // Don't forget to call super.destroy()
        super.destroy();
    }

}

// Export the application class as default
// The kernel will now be able to instantiate it when requested
export default MyHelloWorldApp;