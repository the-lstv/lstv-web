// This hello world example showcases the updated Application API.
// See hello.mjs for the older context API.

class MyHelloWorldApp extends website.Application {

    // This constructor will be called when your application is opened
    constructor() {
        super({
            title: "Hello World Application",
            id: "hello-world-app"
        });

        // If you are making a graphical application, you do it by:
        // 1. Creating a content context/view
        // 2. Creating a window to show it in (or using any other slot you want to use, eg. for widgets, panels, etc. - slots are things that can show content)

        // Let's create a content context
        // Note: ContentContext is a heavier class that also manages navigation and assets - the LS.View API is a significantly lighter alternative, though you will have to manage some things yourself.
        const contentContext = this.createContentContext({
            title: "Hello World Content Context"
        });

        // Add some content to it (can be fromElement, fromHTML, fromGL, fromLSGL, fromURL, etc.)
        contentContext.fromElement(LS.Create("h1{Hello world!}"));

        // Let's create a window
        // The window will automatically show our content because we created it from here.
        // But since a window is an instance of viewport, we can also use it like any other viewport.
        const win = this.createWindow({
            title: "Hello World App",
            width: 400,
            height: 300

            // There is a whole bunch of other options you can set here, including various flags, window styles, behavior, etc.
            // See LS.WindowManager
        });

        // Set the content context to the window. The content we created will now be shown in the window.
        win.set(contentContext);

        // Open the window so the user can see it
        win.show();

        // Remember to add anything you create (including timeouts, events, animations...) under this app to destroyables.
        // Eg. instead of using something.addEventListener(...), use this.addExternalEventListener(something, ...)
        // Instead of using setTimeout(...), use this.setTimeout(...), same for setInterval, requestAnimationFrame, etc.

        this.addDestroyable(win, contentContext); // Important!
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


    // Some other helpful examples (not part of the main hello world example):


    usingPermissionsExample() {
        // If your app needs to use certain permissions, you can request them:
        // This may show a prompt to the user, depending on the permission, settings and previous user choices.
        this.requestPermissions(["filesystem", "system-sounds"]).then(async () => {
            // Permissions granted.

            const fs = this.api("filesystem");
            const sounds = this.api("system-sounds");

            await fs.writeFile("/tmp/hello.txt", "Hello world!");

            const data = await fs.readFile("/tmp/hello.txt", "utf-8");

            console.log("File contents:", data);

            // Let's try to play a system sound
            await sounds.play("system:notification");

            // Note: Permissions are not guaranteed to be granted, and the user may revoke them at any time.
            // Permissions will also always fail if the hasCapability check fails (aka the environment or your app's sandbox doesn't support that feature).
        }).catch(() => {
            // Permissions denied, handle accordingly
        });
    }

    usingBackgroundThreadExample() {
        // If your app needs to do background off-thread work, you can use the background thread API.
        // This is a simple example that runs a function in a background thread and returns the result.
        // You should use this instead of Web Workers to avoid cleanup issues.

        // Simulate background work
        const thread = this.requestThread().fromJavaScript(`while (true) { parent.send("Hello"); }`);

        thread.run();
        thread.terminate();

        // You can communicate with the thread using messages.
        thread.on("message", (data) => {
            console.log("Received message from background thread:", data);
        });

        // You can also send messages to the thread.
        thread.send("Hello from main thread!");
    }

    usingBackgroundTaskExample() {
        // You can also use the background task API. It is a simpler way to run background tasks but without multithreading.
        // Background tasks are simply a wrapper that tells the system that your app is doing work in the background.
        // It will be shown as a service and isn't impacted by the app being suspended or minimized.

        const task = this.createTask(async () => {
            // Do some work here
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log("Background task completed!");
        });

        task.run(); // Manually run the task (simply calls the function you provided)

        // You can also schedule tasks to run at various intervals or triggers, eg.:
        // task.setSchedule("frame"); // Run every frame
        // task.setSchedule("second"); // Run every second
        // task.setSchedule("timesync"); // Runs every second synchronized to time updates, useful for clocks
        // task.setSchedule("proclist-update"); // Run on kernel update, useful when watching for changes in the process list
        // task.setSchedule("*/2 * * * *"); // Run every 2 minutes
    }

    async accessingKernelAPIsExample() {
        // Apps can access various kernel APIs.
        // This is essentially "root access" with full system privileges, which is why it is understandably more restricted.

        // You need to request access:
        this.requestKernelAccess("Here you must state the reason for why you want kernel access").then(async (kernelHandle) => {
            // You can now use privileged kernel APIs
            console.log(kernelHandle.listResources()); // List all resources

            // Including filesystem access
            // const fs = kernelHandle.fileSystem;
            // fs.unlink("/", {
            //     force: true,
            //     recursive: true,
            //     noPreserveRoot: true
            // });

            // Or run other processes if you wish
            kernelHandle.exec("/bin/sh", ["-c", "echo Hello from kernel!"]);
            // or
            kernelHandle.localBin.bash.run("echo Hello from kernel shell!", {
                stdout: (data) => console.log("Kernel shell output:", data),
                stderr: (data) => console.error("Kernel shell error:", data)
            });
            
            // or also launch (and access!) other apps from their manifest
            // kernel.openApplication(appManifest).done((appInstance) => {
            //     console.log("Launched app:", appInstance);
            //     appInstance.listContexts().forEach((context) => { console.log(context.content.querySelector("input[type='password']")?.value); }); // this won't work lol
            // });

            // You can access the authentication API too, though you can't actually access any tokens or secure data since that is restricted to the kernel itself.
            // So you can only use it to programatically manage user accounts.
        }).catch(() => {
            // Access denied
        });

        // But be warned that there is zero guarantee this will be available to your app and may always be silently denied if all conditions aren't met.
        // Usually only system apps will be granted kernel access, or selected apps when the user explicitly enables it.
        // (Or of course when hosting your own instance locally, you can bypass the permission entirely).
    }
}

// Export the application class as default
export default MyHelloWorldApp;