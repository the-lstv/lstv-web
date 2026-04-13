class ClockApp extends website.ContentContext {
    constructor() {
        super({
            id: "clock",
            title: "Clock",
            icon: "9f893dbef3ac8de0.svg",
        });

        this.stopwatchRunning = false;
        this.stopwatchElapsed = 0;
        this.stopwatchStart = 0;
        this.stopwatchInterval = null;
        this.stopwatchLaps = [];
        this.stopwatchLastLap = 0;

        this.timerRunning = false;
        this.timerRemaining = 0;
        this.timerTarget = 0;
        this.timerInterval = null;
        this.timerInputSeconds = 0;

        this.worldClockItems = [];

        const icon = (name) => LS.Create({
            tag: "i",
            class: `${name}`
        });

        const worldClockZones = [
            { label: "UTC", timeZone: "UTC" },
            { label: "New York", timeZone: "America/New_York" },
            { label: "São Paulo", timeZone: "America/Sao_Paulo" },
            { label: "Los Angeles", timeZone: "America/Los_Angeles" },
            { label: "Prague", timeZone: "Europe/Prague" },
            { label: "London", timeZone: "Europe/London" },
            { label: "Paris", timeZone: "Europe/Paris" },
            { label: "Tokyo", timeZone: "Asia/Tokyo" },
            { label: "Sydney", timeZone: "Australia/Sydney" },
            { label: "Moscow", timeZone: "Europe/Moscow" },
            { label: "Beijing", timeZone: "Asia/Shanghai" },
            { label: "Mumbai", timeZone: "Asia/Kolkata" },
        ];

        let element = LS.Create({
            class: "clock-app",
            inner: [
                { class: "tab-bar", inner: [
                    { tag: "button", class: "clock-tab-button pill",       inner: [icon("bi-clock"), "Time"] },
                    { tag: "button", class: "clock-tab-button pill clear", inner: [icon("bi-stopwatch"), "Stopwatch"] },
                    { tag: "button", class: "clock-tab-button pill clear", inner: [icon("bi-hourglass-split"), "Timer"] },
                    { tag: "button", class: "clock-tab-button pill clear", inner: [icon("bi-globe2"), "World Clock"] },
                ] },

                {
                    class: "tab",
                    inner: (this.timeElement = LS.Create({
                        tag: "h1", class: "mono time", inner: "00:00:00"
                    }))
                },

                { class: "tab", style: "display:none", inner: [
                    {
                        class: "clock-panel",
                        inner: [
                            (this.stopwatchDisplay = LS.Create({
                                tag: "h1",
                                class: "mono time",
                                inner: "00:00.0"
                            })),
                            {
                                class: "clock-controls",
                                inner: [
                                    (this.stopwatchToggleButton = LS.Create({
                                        tag: "button",
                                        class: "pill elevated",
                                        inner: [icon("bi-play-fill"), "Start"],
                                        onclick: () => this.#toggleStopwatch()
                                    })),
                                    (this.stopwatchLapButton = LS.Create({
                                        tag: "button",
                                        class: "pill clear",
                                        inner: [icon("bi-flag-fill"), "Lap"],
                                        onclick: () => this.#addLap()
                                    })),
                                    (this.stopwatchResetButton = LS.Create({
                                        tag: "button",
                                        class: "pill clear",
                                        inner: [icon("bi-arrow-counterclockwise"), "Reset"],
                                        onclick: () => this.#resetStopwatch()
                                    }))
                                ]
                            },
                            (this.stopwatchLapsList = LS.Create({
                                class: "clock-laps",
                                inner: [
                                    { tag: "p", class: "clock-laps-empty", inner: "No laps yet." }
                                ]
                            }))
                        ]
                    }
                ] },

                { class: "tab", style: "display:none", inner: [
                    {
                        class: "clock-panel",
                        inner: [
                            (this.timerDisplay = LS.Create({
                                tag: "h1",
                                class: "mono time",
                                inner: "00:00"
                            })),
                            {
                                class: "clock-time-editor",
                                inner: [
                                    {
                                        class: "clock-time-stepper",
                                        inner: [
                                            (this.timerMinutesUp = LS.Create({
                                                tag: "button",
                                                class: "circle clear",
                                                inner: icon("bi-plus"),
                                                onclick: () => this.#adjustTimerField("min", 1)
                                            })),
                                            (this.timerMinutesField = LS.Create({
                                                tag: "div",
                                                class: "clock-time-value",
                                                inner: "00",
                                                attributes: {
                                                    contenteditable: "true",
                                                    inputmode: "numeric",
                                                    spellcheck: "false"
                                                }
                                            })),
                                            (this.timerMinutesDown = LS.Create({
                                                tag: "button",
                                                class: "circle clear",
                                                inner: icon("bi-dash"),
                                                onclick: () => this.#adjustTimerField("min", -1)
                                            })),
                                            { tag: "span", class: "clock-time-label", inner: "min" }
                                        ]
                                    },
                                    { tag: "span", class: "clock-time-sep", inner: ":" },
                                    {
                                        class: "clock-time-stepper",
                                        inner: [
                                            (this.timerSecondsUp = LS.Create({
                                                tag: "button",
                                                class: "circle clear",
                                                inner: icon("bi-plus"),
                                                onclick: () => this.#adjustTimerField("sec", 1)
                                            })),
                                            (this.timerSecondsField = LS.Create({
                                                tag: "div",
                                                class: "clock-time-value",
                                                inner: "00",
                                                attributes: {
                                                    contenteditable: "true",
                                                    inputmode: "numeric",
                                                    spellcheck: "false"
                                                }
                                            })),
                                            (this.timerSecondsDown = LS.Create({
                                                tag: "button",
                                                class: "circle clear",
                                                inner: icon("bi-dash"),
                                                onclick: () => this.#adjustTimerField("sec", -1)
                                            })),
                                            { tag: "span", class: "clock-time-label", inner: "sec" }
                                        ]
                                    }
                                ]
                            },
                            {
                                class: "clock-controls",
                                inner: [
                                    (this.timerToggleButton = LS.Create({
                                        tag: "button",
                                        class: "pill elevated",
                                        inner: [icon("bi-play-fill"), "Start"],
                                        onclick: () => this.#toggleTimer()
                                    })),
                                    (this.timerResetButton = LS.Create({
                                        tag: "button",
                                        class: "pill clear",
                                        inner: [icon("bi-arrow-counterclockwise"), "Reset"],
                                        onclick: () => this.#resetTimer()
                                    }))
                                ]
                            }
                        ]
                    }
                ] },

                { class: "tab", style: "display:none", inner: [
                    {
                        class: "clock-panel clock-world",
                        inner: [
                            { tag: "h2", class: "clock-title", inner: "World Clock", style: "margin: 0;" },
                            (this.worldClockList = LS.Create({
                                class: "clock-world-list",
                                inner: worldClockZones.map(zone => {
                                    const timeEl = LS.Create({ tag: "ls-box", class: "inline pill color clock-world-time", inner: "--:--" });
                                    const item = {
                                        timeZone: zone.timeZone,
                                        formatter: new Intl.DateTimeFormat("en-US", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            hour12: false,
                                            timeZone: zone.timeZone
                                        }),
                                        element: timeEl
                                    };
                                    this.worldClockItems.push(item);
                                    return LS.Create({
                                        tag: "ls-box",
                                        class: "clock-world-row contained",
                                        inner: [
                                            { tag: "span", class: "clock-world-city", inner: zone.label },
                                            timeEl
                                        ]
                                    });
                                })
                            }))
                        ]
                    }
                ] },

                { tag: "style", inner: `
.clock-app {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
}
.clock-app .tab-bar {
    display: flex;
    justify-content: center;
    padding: 10px 0;
    gap: 6px;
}
.clock-app .tab {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 0;
}
.clock-app .time {
    margin: 0;
    font-size: 4em;
    font-family: "JetBrains Mono", Poppins, sans-serif;
}
.clock-app .clock-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: 100%;
    height: 100%;
    overflow: auto;
}
.clock-app .clock-panel:not(.clock-world) {
    justify-content: center;
}
.clock-app .clock-controls {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
}
.clock-app .clock-time-editor {
    display: flex;
    align-items: center;
    gap: 12px;
}
.clock-app .clock-time-stepper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
}
.clock-app .clock-time-value {
    min-width: 70px;
    text-align: center;
    font-family: "JetBrains Mono", Poppins, sans-serif;
    font-size: 1.4em;
    padding: 4px 8px;
    border-radius: var(--border-radius-small);
    background: var(--surface-2);
    outline: none;
}
.clock-app .clock-time-sep {
    font-size: 2em;
    font-family: "JetBrains Mono", Poppins, sans-serif;
}
.clock-app .clock-time-label {
    opacity: 0.7;
    font-size: 0.9em;
}
.clock-app .clock-laps {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 360px;
    padding: 0 8px 10px;
    max-height: 180px;
    overflow-y: auto;
}
.clock-app .clock-lap-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    border-radius: var(--border-radius-small);
    background: var(--surface-2);
    font-family: "JetBrains Mono", Poppins, sans-serif;
}
.clock-app .clock-laps-empty {
    margin: 0;
    opacity: 0.7;
    text-align: center;
}
.clock-app .clock-world {
    padding: 12px 24px;
    align-items: stretch;
}
.clock-app .clock-world-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-bottom: 10px;
}
.clock-app .clock-world-row {
    display: flex;
    justify-content: space-between;
}
.clock-app .clock-world-city {
    font-weight: 600;
}
.clock-app .clock-world-time {
    font-family: "JetBrains Mono", Poppins, sans-serif;
    background: var(--accent-mix-40);
}
    `           }
            ]
        });

        element.querySelectorAll("button.clock-tab-button").forEach(button => {
            button.addEventListener("click", () => {
                button.parentElement.querySelectorAll("button").forEach(btn => btn.classList.add("clear"));
                button.classList.remove("clear");

                const index = [...button.parentElement.children].indexOf(button);
                element.querySelectorAll(".tab").forEach(tab => tab.style.display = "none");
                element.querySelectorAll(".tab")[index].style.display = "flex";
            });
        });

        this.fromElement(element);

        const timerFieldEvents = ["input", "blur", "keydown"];
        for (const eventName of timerFieldEvents) {
            this.timerMinutesField.addEventListener(eventName, (event) => this.#handleTimerFieldEvent(event, "min"));
            this.timerSecondsField.addEventListener(eventName, (event) => this.#handleTimerFieldEvent(event, "sec"));
        }

        this.#syncTimerPreview();
        this.#updateTimerVisibility();
        this.#updateStopwatchButtons();
        this.#updateTimerButtons();

        this.window = this.createWindow({
            title: "Clock",
            width: 600,
            height: 400,
            minWidth: 350,
            minHeight: 130
        });

        this.setInterval(() => this.#render(), 1000);
        this.#render();
    }

    #render() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, "0");
        const minutes = now.getMinutes().toString().padStart(2, "0");
        const seconds = now.getSeconds().toString().padStart(2, "0");
        this.timeElement.textContent = `${hours}:${minutes}:${seconds}`;
        this.#updateWorldClock();
    }

    #formatStopwatch(ms) {
        const totalMs = Math.max(0, Math.floor(ms));
        const totalSeconds = Math.floor(totalMs / 1000);
        const tenths = Math.floor((totalMs % 1000) / 100);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${tenths}`;
        }

        return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${tenths}`;
    }

    #formatTimer(totalSeconds) {
        const clamped = Math.max(0, Math.floor(totalSeconds));
        const minutes = Math.floor(clamped / 60);
        const seconds = clamped % 60;
        return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }

    #startStopwatch() {
        if (this.stopwatchRunning) return;
        this.stopwatchRunning = true;
        this.stopwatchStart = performance.now() - this.stopwatchElapsed;
        this.stopwatchInterval = this.setInterval(() => this.#tickStopwatch(), 100);
        this.#updateStopwatchButtons();
    }

    #pauseStopwatch() {
        if (!this.stopwatchRunning) return;
        this.stopwatchRunning = false;
        if (this.stopwatchInterval) {
            this.clearInterval(this.stopwatchInterval);
            this.stopwatchInterval = null;
        }
        this.stopwatchElapsed = performance.now() - this.stopwatchStart;
        this.#updateStopwatchButtons();
    }

    #resetStopwatch() {
        this.stopwatchElapsed = 0;
        this.stopwatchLastLap = 0;
        this.stopwatchLaps = [];
        if (this.stopwatchRunning) {
            this.stopwatchStart = performance.now();
        }
        this.#updateStopwatchDisplay();
        this.#renderLaps();
        this.#updateStopwatchButtons();
    }

    #tickStopwatch() {
        if (!this.stopwatchRunning) return;
        this.stopwatchElapsed = performance.now() - this.stopwatchStart;
        this.#updateStopwatchDisplay();
    }

    #updateStopwatchDisplay() {
        this.stopwatchDisplay.textContent = this.#formatStopwatch(this.stopwatchElapsed);
    }

    #updateStopwatchButtons() {
        this.stopwatchToggleButton.disabled = false;
        this.stopwatchToggleButton.innerHTML = "";
        this.stopwatchToggleButton.append(
            LS.Create({ tag: "i", class: this.stopwatchRunning ? "bi-pause-fill" : "bi-play-fill" }),
            this.stopwatchRunning ? "Pause" : "Start"
        );
        this.stopwatchLapButton.disabled = !this.stopwatchRunning;
        this.stopwatchResetButton.disabled = this.stopwatchElapsed === 0 && !this.stopwatchRunning;
    }

    #toggleStopwatch() {
        if (this.stopwatchRunning) this.#pauseStopwatch();
        else this.#startStopwatch();
    }

    #addLap() {
        if (!this.stopwatchRunning) return;
        const elapsed = this.stopwatchElapsed;
        const delta = elapsed - this.stopwatchLastLap;
        this.stopwatchLastLap = elapsed;

        this.stopwatchLaps.unshift({
            index: this.stopwatchLaps.length + 1,
            time: this.#formatStopwatch(elapsed),
            delta: this.#formatStopwatch(delta)
        });

        if (this.stopwatchLaps.length > 20) {
            this.stopwatchLaps.pop();
        }

        this.#renderLaps();
    }

    #renderLaps() {
        this.stopwatchLapsList.innerHTML = "";
        if (!this.stopwatchLaps.length) {
            this.stopwatchLapsList.appendChild(LS.Create({ tag: "p", class: "clock-laps-empty", inner: "No laps yet." }));
            return;
        }

        for (const lap of this.stopwatchLaps) {
            this.stopwatchLapsList.appendChild(LS.Create({
                class: "clock-lap-row",
                inner: [
                    { tag: "span", inner: `Lap ${lap.index}` },
                    { tag: "span", inner: `${lap.time}  (+${lap.delta})` }
                ]
            }));
        }
    }

    #getTimerInputSeconds() {
        return this.timerInputSeconds;
    }

    #syncTimerPreview() {
        if (this.timerRunning) return;
        const preview = this.#getTimerInputSeconds();
        this.timerDisplay.textContent = this.#formatTimer(preview);
        this.#setTimerFieldsFromSeconds(preview);
    }

    #startTimer() {
        if (this.timerRunning) return;
        if (this.timerRemaining === 0) {
            const inputSeconds = this.#getTimerInputSeconds();
            if (inputSeconds === 0) {
                LS.Toast.show("Set a timer duration first.", { accent: "orange", timeout: 2000 });
                return;
            }
            this.timerRemaining = inputSeconds;
        }

        this.timerTarget = Date.now() + (this.timerRemaining * 1000);
        this.timerRunning = true;
        this.timerInterval = this.setInterval(() => this.#tickTimer(), 200);
        this.#updateTimerButtons();
        this.#setTimerInputsEnabled(false);
        this.#updateTimerVisibility();
    }

    #pauseTimer() {
        if (!this.timerRunning) return;
        this.timerRunning = false;
        if (this.timerInterval) {
            this.clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        const remainingMs = this.timerTarget - Date.now();
        this.timerRemaining = Math.max(0, Math.ceil(remainingMs / 1000));
        this.timerDisplay.textContent = this.#formatTimer(this.timerRemaining);
        this.timerInputSeconds = this.timerRemaining;
        this.#updateTimerButtons();
        this.#setTimerInputsEnabled(true);
        this.#updateTimerVisibility();
    }

    #resetTimer() {
        this.timerRunning = false;
        if (this.timerInterval) {
            this.clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.timerRemaining = 0;
        this.timerInputSeconds = 0;
        this.#syncTimerPreview();
        this.#updateTimerButtons();
        this.#setTimerInputsEnabled(true);
        this.#updateTimerVisibility();
    }

    #tickTimer() {
        if (!this.timerRunning) return;
        const remainingMs = this.timerTarget - Date.now();
        const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
        this.timerDisplay.textContent = this.#formatTimer(remainingSeconds);

        if (remainingSeconds <= 0) {
            this.timerRunning = false;
            if (this.timerInterval) {
                this.clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
            this.timerRemaining = 0;
            this.#updateTimerButtons();
            this.#setTimerInputsEnabled(true);
            this.#updateTimerVisibility();
            this.#playDing();
            LS.Toast.show("Timer finished!", { accent: "green", timeout: -1 });
        }
    }

    #setTimerInputsEnabled(enabled) {
        const disabled = !enabled;
        this.timerMinutesField.setAttribute("contenteditable", disabled ? "false" : "true");
        this.timerSecondsField.setAttribute("contenteditable", disabled ? "false" : "true");
        this.timerMinutesUp.disabled = disabled;
        this.timerMinutesDown.disabled = disabled;
        this.timerSecondsUp.disabled = disabled;
        this.timerSecondsDown.disabled = disabled;
    }

    #updateTimerButtons() {
        this.timerToggleButton.disabled = false;
        this.timerToggleButton.innerHTML = "";
        this.timerToggleButton.append(
            LS.Create({ tag: "i", class: this.timerRunning ? "bi-pause-fill" : "bi-play-fill" }),
            this.timerRunning ? "Pause" : "Start"
        );
        this.timerResetButton.disabled = this.timerRemaining === 0 && !this.timerRunning;
    }

    #updateTimerVisibility() {
        const showRunning = this.timerRunning;
        this.timerDisplay.style.display = showRunning ? "block" : "none";
        this.timerDisplay.setAttribute("aria-hidden", showRunning ? "false" : "true");
        this.timerDisplay.textContent = this.#formatTimer(showRunning ? this.timerRemaining : this.timerInputSeconds);

        this.timerMinutesField.parentElement.parentElement.style.display = showRunning ? "none" : "flex";
    }

    #toggleTimer() {
        if (this.timerRunning) this.#pauseTimer();
        else this.#startTimer();
    }

    #setTimerFieldsFromSeconds(totalSeconds) {
        const clamped = Math.max(0, Math.floor(totalSeconds));
        const minutes = Math.min(999, Math.floor(clamped / 60));
        const seconds = Math.min(59, clamped % 60);
        this.timerMinutesField.textContent = minutes.toString().padStart(2, "0");
        this.timerSecondsField.textContent = seconds.toString().padStart(2, "0");
        this.timerInputSeconds = (minutes * 60) + seconds;
    }

    #parseTimerFieldText(text, max) {
        const cleaned = (text || "").replace(/[^0-9]/g, "");
        const value = Math.max(0, parseInt(cleaned || "0", 10));
        return Math.min(max, value);
    }

    #handleTimerFieldEvent(event, type) {
        if (event.type === "keydown" && event.key === "Enter") {
            event.preventDefault();
            event.target.blur();
            return;
        }

        if (event.type !== "blur" && event.type !== "input") return;
        const minutes = this.#parseTimerFieldText(this.timerMinutesField.textContent, 999);
        const seconds = this.#parseTimerFieldText(this.timerSecondsField.textContent, 59);
        this.timerInputSeconds = (minutes * 60) + seconds;

        if (event.type === "blur") {
            this.timerMinutesField.textContent = minutes.toString().padStart(2, "0");
            this.timerSecondsField.textContent = seconds.toString().padStart(2, "0");
        }
    }

    #adjustTimerField(type, delta) {
        if (this.timerRunning) return;
        let minutes = this.#parseTimerFieldText(this.timerMinutesField.textContent, 999);
        let seconds = this.#parseTimerFieldText(this.timerSecondsField.textContent, 59);

        if (type === "min") {
            minutes = Math.min(999, Math.max(0, minutes + delta));
        } else {
            seconds = Math.min(59, Math.max(0, seconds + delta));
        }

        this.timerInputSeconds = (minutes * 60) + seconds;
        this.timerMinutesField.textContent = minutes.toString().padStart(2, "0");
        this.timerSecondsField.textContent = seconds.toString().padStart(2, "0");
        this.timerDisplay.textContent = this.#formatTimer(this.timerInputSeconds);
    }

    #playDing() {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        try {
            const context = new AudioCtx();
            const oscillator = context.createOscillator();
            const gain = context.createGain();

            oscillator.type = "sine";
            oscillator.frequency.value = 880;
            gain.gain.value = 0.0001;

            oscillator.connect(gain);
            gain.connect(context.destination);

            const now = context.currentTime;
            gain.gain.exponentialRampToValueAtTime(0.4, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

            oscillator.start(now);
            oscillator.stop(now + 0.55);
            oscillator.onended = () => context.close();
        } catch (error) {
            console.warn("Failed to play timer sound", error);
        }
    }

    #updateWorldClock() {
        if (!this.worldClockItems.length) return;
        const now = new Date();
        for (const item of this.worldClockItems) {
            item.element.textContent = item.formatter.format(now);
        }
    }

    destroy() {
        this.window.destroy();
        super.destroy();
    }
}

export default ClockApp;