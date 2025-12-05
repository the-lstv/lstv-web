website.register(document.currentScript, function(context, container) {
    context.setOptions({
        title: "Chat",
        dynamicAccount: true
    });

    website.watchUser((loggedIn, fragment) => {
    });

    LS.Resize.set(O("#chat-right-area"), {
        left: true,
        snapArea: 80,
        snapHorizontal: true,
        snapCollapse: true,
        store: "chat-right-area-width"
    });

    LS.Resize.set(O("#chat-left-area"), {
        right: true,
        snapArea: 80,
        store: "chat-left-area-width",
        snapHorizontal: true,
        snapCollapse: true
    });

});