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

    // --- Lifecycle

    // -- Suspend gets called when the app should pause or limit activity (eg. when the app is minimized, out of view, in cache, hibernating or hidden).
    // The suspend call is usually rather eager, so you are allowed to add a small timeout before doing heavier suspend work if it would be beneficial in cases where the app is suspended only for a short period of time.
    // In this state it is somewhat permissible to keep certain background tasks running, but it is expected that everything non-essential is paused or stopped.
    // While keeping things running may not instantly break things, never assume that you can keep running things in the background indefinitely, as there is no guarantee that certain things will work when suspended.
    // If you need background tasks, consider using the background thread API.
    suspend() {
        // Suspend any non-essential app activity here
    }

    // -- Resume gets called when the app should resume normal activity.
    resume() {
        // Resume any suspended activity
    }

    // -- Destroy gets called when the app is being closed and should cleanup all resources.
    // This callback must cleanup everything and free all resources, including any timeouts, events, animations, or anything else that may be running in your app. This includes removing any in-memory references to anything your app created.
    // After this callback, you must not do anything or touch any system resources. You should assume the app is PERMANENTLY GONE (not just reset) and any further interaction with it is illegal.
    // LS.Context, which this class extends, provides a wide variety of helpers to make this easier and safer.
    // But if this is too much to keep track of, you may consider using sandboxed contexts, though limited, they provide safer cleanup if you aren't able to manage it yourself.
    // Failing to cleanup properly will lead to memory leaks, crashes, or other unexpected behavior.
    destroy() {
        // Cleanup anything here

        // Don't forget to call super.destroy(), which cleans up the context and all destroyables you added.
        super.destroy();
    }

}

// Export the application class as default
export default MyHelloWorldApp;