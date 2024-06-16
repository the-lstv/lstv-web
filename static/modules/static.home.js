app.module("static.home", (app, source, container) => {

    container.on("scroll", () => {
        let scroll = container.scrollTop;

        container.get("#chevron").class("visible", scroll < 160)
    })

    if(!localStorage["ls.visited"]){
        LS.Toast.show("Warning: This site is in beta.", {accent: "lstv-red", timeout: 2000})
        localStorage["ls.visited"] = true
    }

})