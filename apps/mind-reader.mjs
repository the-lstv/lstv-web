class MindReader extends website.ContentContext {
    constructor() {
        super({
            title: "Mind Reader",
            id: "mind-reader-app"
        });

        const self = this;
        this.content = LS.Create({
            style: "display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px;",
            inner: [
                "Think of a number between 1 and 10",
                {
                    tag: "ls-group",
                    style: "width: 100%;margin-top: 8px",
                    inner: [
                    { tag: "input", type: "number", min: 1, max: 10, placeholder: "Your number here", style: "flex: 1" },
                    { tag: "button", text: "Read My Mind", onclick() {
                        const input = this.previousElementSibling;
                        this.ogtext = this.textContent;
                        const number = parseInt(input.value);
                        if(isNaN(number) || number < 1 || number > 10) {
                            LS.Modal.buildEphemeral({
                                content: "Enter a number between 1 and 10.",
                                buttons: [{ label: "Ok" }]
                            });
                            return;
                        }

                        this.disabled = true;
                        self.progress.value = 0;
                        self.progress.style.display = "block";

                        const texts = ["Analyzing...", "Reading Brainwaves...", "Decoding Thoughts...", "Hacking the Matrix...", "Consulting the Oracle...", "Summoning the Spirits...", "Aligning the Stars...", "Calculating Probability...", "Decoding thoughts..."];
                        const f = () => {
                            self.progress.value+=.5;
                            if (self.progress.value < 100) {
                                if(self.progress.value % 20 === 0 || self.progress.value === 0) {
                                    this.textContent = texts[Math.floor(Math.random() * texts.length)];
                                }
                                self.requestAnimationFrame(f);
                                return;
                            }
                            this.textContent = this.ogtext;

                            LS.Modal.buildEphemeral({
                                content: "You were thinking of the number " + number + ".",
                                buttons: [{ label: "I'm blown away" }]
                            });

                            this.disabled = false;
                            self.progress.value = 0;
                            self.progress.style.display = "none";
                        }

                        self.requestAnimationFrame(f);
                    } }
                    ]
                }
            ]
        });

        this.progress = LS.Create("progress", { max: 100, value: 0, style: "display: none; width: 100%; margin-top: 20px;" });
        this.content.appendChild(this.progress);

        this.fromElement(this.content);
        const win = this.createWindow({
            title: "Mind Reader",
            width: 400,
            height: 180,
            resizable: false
        });

        this.addDestroyable(win, this.content);
    }

    destroy() {
        super.destroy();
    }
}

export default MindReader;