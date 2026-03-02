class MindReader extends website.ContentContext {
    constructor() {
        super({
            title: "Mind Reader Application",
            id: "mind-reader-app"
        });

        this.content = LS.Create({
            inner: [
                { tag: "h1", text: "Mind Reader!" },
                { tag: "p", text: "Think of a number between 1 and 10, and I'll read your mind!" },
                { tag: "input", props: { type: "number", min: 1, max: 10, placeholder: "Your number here" } },
                { tag: "button", text: "Read My Mind", onclick() {
                    const input = this.previousElementSibling;
                    const number = parseInt(input.value);
                    this.disabled = true;

                    const f = () => {
                        this.progress.value++;
                        if (this.progress.value <= 100) {
                            requestAnimationFrame(f);
                            LS.Modal.buildEphemeral({
                                content: "You were thinking of the number " + number + ".",
                                buttons: [{ label: "Ok" }]
                            });
                        }
                    }

                    requestAnimationFrame(f);
                } }
            ]
        });

        this.progress = LS.Create("progress", { props: { max: 100, value: 0 } });
        this.content.appendChild(this.progress);

        this.fromElement(this.content);
        const win = this.createWindow({
            title: "Mind Reader",
            width: 400,
            height: 300
        });

        this.addDestroyable(win, this.content);
    }

    destroy() {
        super.destroy();
    }
}

export default MindReader;