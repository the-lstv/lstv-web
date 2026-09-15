/*
    Author: Lukas (thelstv)
    Copyright: (c) https://lstv.space
    No commercial or training use permitted.
    This code is not open-source.

    Last modified: 2026
    See: https://github.com/the-lstv/lstv-web

    New, better and proper version of the command palette, replacing the previous AI slop trash,
    which in turn replaced the old FOSSHome implementation.
    This one is finally clean and human-written, though still work-in-progress.
    On the bright side, it can finally be worked on again without me wanting to kill myself every time i look at it.

    It is also much, much more efficient than the previous one, while taking HALF the lines of code.
*/

/**
 * @typedef {Object} PaletteOptions
 * @property {Object} [logger] - Custom logger object with info/log/warn/error/fatal methods
 */

class CommandPalette extends LS.Component {
    static { LS.register(this, { name: "CommandPalette", global: true }) }

    #commands = {};
    #abortController = new AbortController();

    #fileInput  = null;
    #colorInput = null;

    #currentCompletions = [];
    #autoCompletionIndex = 0;

    get autoCompletionIndex() {
        return this.#autoCompletionIndex;
    }

    set autoCompletionIndex(value) {
        const itemCount = this.#currentCompletions.length || 0;
        
        value ||= 0;

        if(value < 0) {
            value = itemCount - 1;
        } else if(value >= itemCount) {
            value = 0;
        }

        const selectedItem = this.menuElement.querySelector('.completion-item.selected');
        if (selectedItem) {
            selectedItem.classList.remove('selected');
        }

        for (let i = 0; i < this.menuElement.children.length; i++) {
            const child = this.menuElement.children[i];

            // Stop if we reach hidden items
            if (child.style.display === "none") break;

            child.classList.toggle('selected', i === value);
        }

        this.#autoCompletionIndex = value;
        this.#scrollToSelectedItem();
    }

    /**
     * Creates a new CommandPalette instance
     * @param {PaletteOptions} options - Configuration options
     */
    constructor(options = {}) {
        super();
        this.options = options;

        this.options.defaultIcon ??= "bi-terminal";
        this.options.logger      ??= console;
        this.options.fontWidth   ??= 9.6 * 1.2;

        this.isOpen = false;
        this.StackRef = { close: () => this.close() };

        // --- Elements
        this.wrapperElement = this.options.wrapperElement  || null;
        this.inputElement   = this.options.inputElement    || LS.Create("input");
        this.menuElement    = this.options.menuElement     || LS.Create("div.completion-menu");

        this.menuElement.style.display = "none";
        this.wrapperElement.appendChild(this.menuElement);

        if (!this.wrapperElement && this.inputElement) {
            this.wrapperElement = this.inputElement.parentElement;
        }

        this.hintElement        = this.options.hintElement        || null;
        this.iconElement        = this.options.iconElement        || null;
        this.terminalOutput     = this.options.terminalOutput     || null;
        this.textDisplayElement = this.options.textDisplayElement || null;

        this.caretElement = this.options.caretElement ||
            this.wrapperElement?.querySelector('.command-caret') || null;

        this.selectionHighlight = this.options.selectionHighlight ||
            this.wrapperElement?.querySelector('.command-selection') || null;

        this.#setupHandlers();
    }

    /**
     * Opens the command palette
     */
    open() {
        this.options.onOpen?.();
        this.emit("open");

        this.isOpen = true;
        LS.Stack.push(this.StackRef);
        this.focus();
    }

    /**
     * Closes the command palette
     */
    close() {
        this.options.onClose?.();
        this.emit("close");

        this.isOpen = false;
        LS.Stack.remove(this.StackRef);
        this.blur();
    }

    /**
     * Shows the completions menu
     */
    showCompletions() {
        if (this.menuElement) {
            this.menuElement.style.display = "flex";
        }
    }

    /**
     * Hides the completions menu
     */
    hideCompletions() {
        if (this.menuElement) {
            this.menuElement.style.display = "none";
        }
    }

    get isMenuVisible() {
        return this.menuElement?.style.display !== "none";
    }

    /**
     * Focuses the command input
     */
    focus() {
        if (this.inputElement) {
            this.inputElement.focus();
        }
        this.#updateCaretPosition();
    }

    blur() {
        if (this.inputElement) {
            this.inputElement.blur();
        }
    }

    /**
     * Opens the palette with a pre-filled command
     * @param {string} command - The command to pre-fill the input with
     */
    openWithCommand(command) {
        this.open();
        this.setValue(command);
    }

    setValue(value) {
        if (this.inputElement) {
            this.inputElement.value = value;
            this.#handleInput();
        }
    }

    getValue() {
        return this.inputElement?.value || "";
    }

    clearValue() {
        this.setValue("");
    }

    execute(value = null) {
        const command = value ?? this.getValue();
        if (!command) return;
    }

    /**
     * Registers commands
     * 
     * @param {CommandConfig|CommandConfig[]|string} definition - Command definition(s)
     * @param {CommandConfig} [config] - Config when definition is a string
     * @returns {CommandPalette} Returns this for chaining
     * 
     * @example
     * palette.register([
     *   { name: 'hello', description: 'Say hello', onCalled: (name) => console.log(`Hello, ${name}!`) },
     *   { name: 'theme', description: 'Theme commands', children: [
     *     { name: 'dark', onCalled: () => setTheme('dark') },
     *     { name: 'light', onCalled: () => setTheme('light') }
     *   ]}
     * ]);
     */
    register(definition, config) {
        if (Array.isArray(definition)) {
            this.#ingestDefinitions(definition, this.#commands);
            return this;
        }

        if (typeof definition === 'string') {
            return this.register([{ name: definition, ...config }]);
        }

        if (definition && typeof definition === 'object') {
            this.#ingestDefinitions([definition], this.#commands);
            return this;
        }

        throw new Error('Invalid command definition');
    }

    #ingestDefinitions(definitions, target) {
        for (const node of definitions) {
            if (!node || typeof node !== 'object') continue;

            if (typeof node.name !== 'string') {
                throw new Error('Command definition requires a name');
            }

            this.#normalizeNode(node);
            node.parent = target;
            target[node.name] = node;
        }

        return target;
    }

    #normalizeNode(node) {
        if (!node || typeof node !== 'object' || typeof node.name !== 'string') return null;

        node.name = node.name.trim();

        if(Array.isArray(node.children)) {
            const children = {};
            for (const child of node.children) {
                if (typeof child === 'string') {
                    children[child] = { name: child };
                } else if (typeof child === 'object' && child !== null) {
                    children[child.name] = child;
                }
            }
            node.children = children;
        }

        node.type        ??= (node.onCalled) ? 'command' : 'group';
        node.alias       ??= [];
        node.inputs      ??= [];
        node.children    ??= {};
        node.parent      ??= null;
        node.description ??= '';

        for (const key in node.children) {
            const child = node.children[key];
            this.#normalizeNode(child);
            child.parent = node;
        }

        return node;
    }

    /**
     * Unregisters a command or group
     * 
     * @param {string} name - Name of command/group to remove
     * @returns {boolean} True if command existed and was removed
     */
    unregister(name) {}

    /**
     * Checks if a command or group exists
     * 
     * @param {string} name - Command/group name
     * @returns {boolean}
     */
    has(name) {
        return name in this.#commands;
    }

    /**
     * Gets a command or group configuration
     * 
     * @param {string} name - Command/group name
     * @returns {CommandConfig|undefined}
     */
    get(name) {
        return this.#commands[name];
    }

    /**
     * Parses a command string into its component parts
     * @param {string} inputValue - The input string to split
     * @param {boolean} expectsEmptySlot - Whether to expect an empty slot at the end if the input ends with a space
     * @returns {string[]}
     */
    splitCommand(inputValue, expectsEmptySlot = false) {
        let stringChar = null, start = 0;
        inputValue = inputValue.trimStart();

        if(!inputValue) return [''];
        let parts = [];

        for (let i = 0; i < inputValue.length; i++) {
            const char = inputValue.charCodeAt(i);

            if(stringChar) {
                if(char === stringChar) {
                    stringChar = null;
                    parts.push(inputValue.slice(start, i));
                    start = i + 1;
                }
                continue;
            }

            if(char === 34 || char === 39) { // " or '
                parts.push(inputValue.slice(start, i));
                stringChar = char;
                start = i + 1;
                continue;
            }

            if(char === 32) { // space
                if (start === i) {
                    start = i + 1;
                    parts.push('');
                    continue;
                }

                parts.push(inputValue.slice(start, i));
                start = i + 1;
            }
        }

        parts.push(inputValue.slice(start));

        if(expectsEmptySlot && inputValue.endsWith(' ')) {
            parts = parts.filter(Boolean);
            parts.push('');
            return parts;
        }

        return parts.filter(Boolean);
    }


    // --- Private methods

    #search(candidates, query, location = null) {
        query = LS.Util.normalize(query);

        if(!query) {
            return candidates.filter(candidate => {
                if (candidate.startsWith('_')) return false;
                if (location && location[candidate]?.hidden) return false;
                return true;
            });
        }

        const results = [];
        for (const candidate of candidates) {
            let text = LS.Util.normalize(candidate);

            if (text.startsWith('_')) continue;

            if (location && location[candidate]) {
                const item = location[candidate];
                if (item.hidden) {
                    continue;
                }

                // if (item.description) {
                //     text += ' ' + LS.Util.normalize(item.description);
                // }
            }

            const idx = text.indexOf(query);
            if (idx === -1) {
                continue;
            }

            let score = 0;

            // Starts with query
            if (idx === 0) score += 100;

            // Starts a word
            if (idx === 0 || text[idx - 1] === ' ') score += 50;

            // Earlier matches are better
            score += Math.max(0, 30 - idx);

            // Shorter strings are slightly preferred
            score -= text.length * 0.01;

            if (score > 0) {
                results.push({ candidate, score });
            }
        }

        return results.sort((a, b) => b.score - a.score).map(r => r.candidate);
    }

    #setupHandlers() {
        if (!this.inputElement) return;

        const eventOpt = { signal: this.#abortController.signal };

        this.inputElement.addEventListener('input',   ()  => this.#handleInput(),         eventOpt);
        this.inputElement.addEventListener('keydown', (e) => this.#handleKeyDown(e),      eventOpt);
        this.inputElement.addEventListener('keyup',   ()  => this.#updateCaretPosition(), eventOpt);
        this.inputElement.addEventListener('select',  ()  => this.#updateCaretPosition(), eventOpt);
        this.inputElement.addEventListener('mouseup', ()  => this.#updateCaretPosition(), eventOpt);
        this.inputElement.addEventListener('scroll',  ()  => this.#updateCaretPosition(), eventOpt);

        this.inputElement.addEventListener('focus',   ()  => this.wrapperElement?.classList.add('focused'),    eventOpt);
        this.inputElement.addEventListener('blur',    ()  => this.wrapperElement?.classList.remove('focused'), eventOpt);

        this.inputElement.addEventListener('touchend', () => {
            requestAnimationFrame(() => this.#updateCaretPosition());
        }, eventOpt);

        document.addEventListener('selectionchange', () => {
            if (document.activeElement === this.inputElement) {
                this.#updateCaretPosition();
            }
        }, eventOpt);

        eventOpt.passive = true;

        document.addEventListener('pointerdown', (e) => {
            if (!this.wrapperElement?.contains(e.target)) {
                this.hideCompletions();
            }
        }, eventOpt);
    }

    #handleKeyDown(event) {
        let preventDefault = true;

        switch (event.key) {
            case 'Enter':
                if (this.isMenuVisible && this.#currentCompletions.length > 0) {
                    this.#acceptCompletion();
                } else {
                    this.execute();
                }
                break;

            case 'Tab':
                this.#acceptCompletion();
                break;

            case 'ArrowDown':
                this.autoCompletionIndex++;
                break;

            case 'ArrowUp':
                this.autoCompletionIndex--;
                break;

            case 'Escape':
                if (this.isMenuVisible) {
                    this.hideMenu();
                } else {
                    this.close();
                }
                break;

            default:
                preventDefault = false;
                break;
        }

        if (preventDefault) {
            event.preventDefault();
            event.stopPropagation();
        }

        requestAnimationFrame(() => this.#updateCaretPosition());
    }

    #handleInput() {
        this.#updateTextDisplay();
        this.#autoCompletion();
        this.#updateCaretPosition();
    }

    #autoCompletion(inputValue = null) {
        inputValue ??= this.getValue() ?? '';

        // Parse command
        const segments = this.splitCommand(inputValue.trim());
        const hasTrailingSpace = inputValue.endsWith(' ');

        const currentPart = (!hasTrailingSpace && segments.length > 0)? segments.pop() : '';

        // Get the command object
        const command = segments.reduce((acc, part) => {
            if (acc && acc.children && acc.children[part]) {
                return acc.children[part];
            }
            return null;
        }, { children: this.#commands });

        console.log(`Current part: "${currentPart}", Command:`, command);

        if(!command) {
            this.hideCompletions();
            return;
        }

        let completions = command.children;
        if(command.inputs && command.inputs.length > 0) {
            completions = this.#inputCompletion(command.inputs[0]);
        }

        if(!completions || completions.length === 0) {
            this.hideCompletions();
            return;
        }

        // Search for matches
        const matches = this.#search(Object.keys(completions), currentPart, completions);

        this.#currentCompletions.length = 0;

        let required = 0;
        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const item = completions[match];

            if(item.hidden) {
                continue;
            }

            this.#currentCompletions.push(item);

            this.#updateMenuItem(item, required);
            required++;
        }

        let removed = 0;
        for(let i = this.menuElement.children.length - 1; i >= required; i--) {
            const child = this.menuElement.children[i];

            // Keep up to 5 hidden items as an extra buffer to avoid creating/removing elements.
            if(removed <= 5) {
                child.style.display = "none";
            } else {
                this.menuElement.removeChild(child);
            }
            removed++;
        }

        this.autoCompletionIndex = 0;
        this.showCompletions();
    }

    #updateMenuItem(command, index) {
        const menuItem = this.menuElement.children[index] || LS.Create("div.completion-item", {
            inner: [
                { tag: "i" },
                { tag: "span" },
                { tag: "span", class: "completion-description" },
            ]
        }).addTo(this.menuElement);

        menuItem.children[0].className   = command.icon || this.options.defaultIcon;
        menuItem.children[1].textContent = command.name;
        menuItem.children[2].textContent = command.description? ` - ${command.description}` : '';

        menuItem.setAttribute("ls-accent", command.accentColor || '');
        menuItem.classList.toggle("has-accent", !!command.accentColor);

        menuItem.style.display = "flex";
        menuItem.dataset.index = index;
        return menuItem;
    }

    #updateTextDisplay() {
        // todo:
        if (this.textDisplayElement) {
            this.textDisplayElement.textContent = this.getValue();
        }
    }

    #acceptCompletion(index = this.autoCompletionIndex) {
        if (!this.menuElement) return;

        const completion = this.#currentCompletions[index];
        if (!completion) return;

        const parts = this.splitCommand(this.inputElement.value, true);
        parts[parts.length - 1] = completion.value || completion.name;

        const cleaned = parts.join(' ').trimEnd();

        if(cleaned) this.setValue(cleaned + ' '); else this.clearValue();
    }

    #inputCompletion(inputDef) {
        const type = inputDef?.type || 'text';

        switch (type) {
            case 'boolean':
                return {
                    true:  { name: 'true', icon: "bi-toggle-on" },
                    false: { name: 'false', icon: "bi-toggle-off" }
                }
            
            case 'number':
                return {
                    '(enter a number)': { value: '', icon: inputDef.icon || "bi-123", description: inputDef.description || "Enter a number" },
                    '0':    { name: '0', icon: inputDef.icon || "bi-123", description: "Zero" },
                    '1':    { name: '1', icon: inputDef.icon || "bi-123", description: "One" },
                    '10':   { name: '10', icon: inputDef.icon || "bi-123", description: "Ten" },
                    '100':  { name: '100', icon: inputDef.icon || "bi-123", description: "One Hundred" },
                    '1000': { name: '1000', icon: inputDef.icon || "bi-123", description: "One Thousand" }
                };
            
            case 'color':
                return {
                    'Pick a color': { value: '', icon: inputDef.icon || "bi-palette", description: inputDef.description || "Pick a color" },
                    '#000000': { name: '#000000', icon: 'bi-circle', description: "Black" },
                    '#FFFFFF': { name: '#FFFFFF', icon: 'bi-circle-fill', description: "White" },
                    '#FF0000': { name: '#FF0000', icon: 'bi-circle-fill', description: "Red", accentColor: 'red' },
                    '#00FF00': { name: '#00FF00', icon: 'bi-circle-fill', description: "Green", accentColor: 'green' },
                    '#0000FF': { name: '#0000FF', icon: 'bi-circle-fill', description: "Blue", accentColor: 'blue' },
                    '#FFFF00': { name: '#FFFF00', icon: 'bi-circle-fill', description: "Yellow", accentColor: 'yellow' },
                    '#FFA500': { name: '#FFA500', icon: 'bi-circle-fill', description: "Orange", accentColor: 'orange' },
                    '#800080': { name: '#800080', icon: 'bi-circle-fill', description: "Purple", accentColor: 'purple' },
                    '#00FFFF': { name: '#00FFFF', icon: 'bi-circle-fill', description: "Cyan", accentColor: 'cyan' },
                    '#FFC0CB': { name: '#FFC0CB', icon: 'bi-circle-fill', description: "Pink", accentColor: 'pink' }
                };
            
            case 'list':
                return (inputDef.list || []).reduce((acc, item) => {
                    const key = item.name || String(item.value);

                    acc[key] = {
                        name: key,
                        value: String(item.value ?? item.name),
                        icon:        item.icon || inputDef.icon || "bi-list",
                        description: item.description || inputDef.description,
                        accentColor: item.accentColor || inputDef.accentColor || null
                    };

                    return acc;
                }, {});
            
            case 'file':
                return {
                    'Choose a file': { value: '', icon: inputDef.icon || "bi-file-earmark", description: inputDef.description || "Choose a file" }
                };

            case 'text': case 'string':
                return {
                    '(enter text)': { value: '""', icon: inputDef.icon || "bi-type", description: inputDef.description || "Enter text" }
                };

            default:
                return {};
        }
    }

    #scrollToSelectedItem() {
        if (!this.menuElement) return;

        const selectedItem = this.menuElement.querySelector('.completion-item.selected');
        if (selectedItem) {
            selectedItem.scrollIntoView({
                block: 'center',
                inline: 'nearest',
                behavior: 'smooth'
            });
        }
    }

    #updateCaretPosition() {
        if (!this.inputElement) return;

        const fontWidth = this.options.fontWidth;
        const selectionStart = this.inputElement.selectionStart ?? 0;
        const selectionEnd = this.inputElement.selectionEnd ?? 0;
        const hasSelection = selectionEnd !== selectionStart;
        const scrollLeft = this.inputElement.scrollLeft || 0;
        const caretLeft = Math.max(0, (selectionEnd * fontWidth) - scrollLeft);

        if (this.caretElement) {
            this.caretElement.style.transform = `translateX(${caretLeft}px)`;
        }

        if (this.selectionHighlight) {
            if (hasSelection) {
                const selectionLeft = Math.max(0, (selectionStart * fontWidth) - scrollLeft);
                const selectionWidth = Math.max(0, (selectionEnd - selectionStart) * fontWidth);
                this.selectionHighlight.style.transform = `translateX(${selectionLeft}px)`;
                this.selectionHighlight.style.width = `${selectionWidth}px`;
            } else {
                this.selectionHighlight.style.width = '0';
            }
        }

        if (this.wrapperElement) {
            this.wrapperElement.classList.toggle('selection', hasSelection);
        }
    }

    destroy() {
        this.inputElement = null;
        this.menuElement = null;
        this.hintElement = null;
        this.iconElement = null;
        this.textDisplayElement = null;
        this.caretElement = null;
        this.selectionHighlight = null;

        this.#abortController.abort();
        this.#commands = null;
        this.options = null;
        this.StackRef = null;

        this.#currentCompletions = null;

        if (this.#fileInput) {
            this.#fileInput.remove();
            this.#fileInput = null;
        }

        if (this.#colorInput) {
            this.#colorInput.remove();
            this.#colorInput = null;
        }

        super.destroy();
    }
}

// --- lstv.space specific (todo: move out)

/**
 * Initialize the command palette and terminal.
 * @param {Kernel} kernel 
 * @param {LiDesktop} desktop 
 * @param {LoggerContext} LoggerContext 
 */
function init(kernel, desktop, LoggerContext) {
    const topBar = LS.SelectOne("#topOverlay");

    topBar.innerHTML = `<div id="commandTerminal" class="level-n3" style="display: none">
    <div class="terminal-output"></div>
</div>

<div id="commandPaletteBar" class="level-n3">
    <div id="commandPalette" onclick="this.querySelector('.command-input').focus()">
        <div class="completion-menu"></div>

        <i class="bi-terminal command-icon"></i>

        <div class="textContainer">
            <span class="command-selection"></span>
            <span class="command-caret"></span>
            <span class="command-text"></span><span class="command-hint"></span>
            <input type="text" class="command-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Command palette input">
        </div>
    </div>

    <div class="command-palette-buttons">
        <button ls-tooltip="Close" class="square clear" aria-label="Close command palette"><i class="bi-x-lg"></i></button>
    </div>
</div>`;

    const paletteBar = LS.SelectOne("#commandPaletteBar");
    const paletteContainer = LS.SelectOne("#commandPalette");
    const terminalContainer = LS.SelectOne("#commandTerminal");
    const terminalOutput = terminalContainer.querySelector(".terminal-output");

    const paletteLogger = new LoggerContext("Command Palette");

    desktop.commandPalette = new CommandPalette({
        wrapperElement: paletteContainer,
        menuElement: paletteContainer.querySelector(".completion-menu"),
        iconElement: paletteContainer.querySelector(".command-icon"),
        textDisplayElement: paletteContainer.querySelector(".command-text"),
        hintElement: paletteContainer.querySelector(".command-hint"),
        inputElement: paletteContainer.querySelector(".command-input"),
        terminalOutput: terminalOutput,

        fontWidth: 9.6 * 1.2,

        onClose(){
            LS.Animation.fadeOut(topBar, 300, "down");
        },

        onOpen(){
            LS.Animation.fadeIn(topBar, 300, "up");
        },

        logger: paletteLogger
    });

    let terminalHidden = true;
    const terminalObserver = new MutationObserver(() => {
        const hasContent = terminalOutput.children.length > 0;
        if (hasContent) {
            if (terminalHidden) {
                LS.Animation.fadeIn(terminalContainer, 200, "up");
                terminalHidden = false;
            }
        } else {
            if (!terminalHidden) {
                LS.Animation.fadeOut(terminalContainer, 200, "down");
                terminalHidden = true;
            }
        }
    });

    terminalObserver.observe(terminalOutput, { childList: true });

    const terminalWriter = {
        info : (...a) => desktop.commandPalette.info (...a),
        log  : (...a) => desktop.commandPalette.log  (...a),
        warn : (...a) => desktop.commandPalette.warn (...a),
        error: (...a) => desktop.commandPalette.error(...a),
        fatal: (...a) => desktop.commandPalette.fatal(...a),
    }

    kernel.terminalWriter = terminalWriter;
    paletteLogger.writer = terminalWriter;

    paletteBar.querySelector("button").onclick = () => {
        desktop.commandPalette.close();
    };

    /**
     * This should later be inline, so we don't waste client memory & cpu. 
     * That's when we use Glitter<3
     */

    /*comptime*/ const kVersionMeta = {
        1: {
            codename: "Zen",
            color: "#B5FFEE"
        },
        2: {
            codename: "Aether",
            color: "#FFA680"
        },
        3: {
            codename: "Forge",
            color: "#8C80FF"
        }
    }

    const major = LS.Util.fast.sliceUntil(kernel.version, ".");

    /*comptime*/ const ckMeta = kVersionMeta[major] || { codename: "Unknown", color: "var(--accent)" };

    desktop.commandPalette.register([
        {
            name: "fetch",
            alias: ["kernel-info", "kernel-version", "version"],
            icon: 'bi-pc-display-horizontal',
            description: "Information about system & environment",
            async onCalled() {
                terminalOutput.appendChild(LS.Create({
                    innerHTML: `<img src="/~/assets/image/kernel-icons/${major}x.png" width="180" style="position:absolute;top:20px;pointer-events:none"><svg xmlns="http://www.w3.org/2000/svg" width="200" height="180" viewBox="0 0 200 180" fill="none">
<rect x="59" y="63" width="82" height="28.9828" fill="black"/>
<rect x="59" y="91.9828" width="82" height="24.7414" fill="${ckMeta.color}"/>
<text fill="black" style="white-space: pre" xml:space="preserve" font-family="JetBrains Mono" font-size="16.9655" font-weight="300" letter-spacing="0em"><tspan x="70.0855" y="110.504">v${LS.Util.fast.sliceUntil(kernel.version, "-")}</tspan></text>
<text fill="${ckMeta.color}" style="white-space: pre" xml:space="preserve" font-family="JetBrains Mono" font-size="22.6207" font-weight="500" letter-spacing="0em"><tspan x="66.0693" y="86.1434">[${ckMeta.codename}]</tspan></text>
</svg>`,
                    style: 'margin:auto;display:flex;justify-content:center;position:relative',

                    effectsVersion: 1,
                    effects: "spring:x,push",
                }));

                const uname = await kernel.env.proc.uname();
                const rootMount = kernel?.fileSystem?.lsmount?.()?.at(-1)?.[1];

                const t = (kernel?.fileSystem?.constructor?.toHuman) || (v=>v);

                terminalWriter.log(
                    `%clstv.space%c kernel`,
                    "color:var(--accent);font-weight:bold;font-size:1.2em",
                    "color:inherit;font-weight:bold;font-size:1.2em"
                );
                terminalWriter.log(
                    `%cKernel:%c ${uname.sysname} ${uname.release} (${ckMeta.codename})`,
                    "color:var(--accent);font-weight:bold", "color:inherit"
                );
                terminalWriter.log(
                    `%cLS version:%c ${LS.version}`,
                    "color:var(--accent);font-weight:bold", "color:inherit"
                );
                if(rootMount) {
                    terminalWriter.log(
                        `%cDisk (/):%c ${t(rootMount.used, 1)} / ${t(rootMount.size)} (${Math.round((rootMount.used || -1) / (rootMount.size || 1) * 100)}%) - ${rootMount.type || "Unknown"}`,
                        "color:var(--accent);font-weight:bold", "color:inherit"
                    );
                }
                if(app.desktop) {
                    terminalWriter.log(
                        `%cDesktop:%c ${app.desktop.name || "Unknown"} ${app.desktop.version}`,
                        "color:var(--accent);font-weight:bold", "color:inherit"
                    );
                    // terminalWriter.log(
                    //     `%cWindow Manager:%c LS.WindowManager`, // well hm
                    //     "color:var(--accent);font-weight:bold", "color:inherit"
                    // );
                    terminalWriter.log(
                        `%cWindows:%c ${app.desktop.windowManager.windows.size}`,
                        "color:var(--accent);font-weight:bold", "color:inherit"
                    );
                }
                terminalWriter.log(
                    `%cViewports:%c ${kernel.viewports.size}`,
                    "color:var(--accent);font-weight:bold", "color:inherit"
                );
                terminalWriter.log(
                    `%cPages:%c ${kernel.pageCache.size} / 20`,
                    "color:var(--accent);font-weight:bold", "color:inherit"
                );
                terminalWriter.log(
                    `%cThreads:%c ${kernel.threads.size + 1} / ${kernel.MAX_THREADS}`, // +1 for main thread
                    "color:var(--accent);font-weight:bold", "color:inherit"
                );
                terminalWriter.log(
                    `%cSigned in:%c ${await kernel.auth.isLoggedIn() ? "Yes" : "No"}`,
                    "color:var(--accent);font-weight:bold", "color:inherit"
                );
                terminalWriter.log(
                    `%cLoadtime:%c ${Math.round(kernel.ttl)}ms (${Math.round(kernel.ttl_scripting)}ms without network)`,
                    "color:var(--accent);font-weight:bold", "color:inherit"
                );
                const uptimeMs = Date.now() - window.__loadTime;
                const uptimeSec = Math.floor(uptimeMs / 1000);
                const hours = Math.floor(uptimeSec / 3600);
                const minutes = Math.floor((uptimeSec % 3600) / 60);
                const seconds = uptimeSec % 60;
                const prettyUptime =
                    (hours > 0 ? hours + "h " : "") +
                    (minutes > 0 ? minutes + "m " : "") +
                    seconds + "s";
                terminalWriter.log(
                    `%cUptime:%c ${prettyUptime}`,
                    "color:var(--accent);font-weight:bold", "color:inherit"
                );
            }
        },

        {
            name: "settings",
            alias: ["config", "configure", "options"],
            icon: "bi-gear",
            description: "Configuration",
            children: [
                {
                    name: "open",
                    icon: "bi-sliders",
                    description: "Open settings UI"
                },

                {
                    name: "notifications",
                    icon: "bi-bell",
                    description: "Enable or disable notifications",
                    children: [
                        {
                            name: "enable",
                            icon: "bi-bell-fill"
                        },
                        {
                            name: "disable",
                            icon: "bi-bell-slash"
                        }
                    ]
                },

                {
                    name: "privacy",
                    icon: "bi-shield-lock",
                    description: "Privacy settings",
                    children: [
                        {
                            name: "statistics",
                            icon: "bi-bar-chart",
                            description: "Toggle anonymous statistics sharing",
                            onCalled(enabled) {
                                localStorage.setItem("DISABLE_STATS", !enabled);
                                terminalWriter.log("Statistics sharing " + (enabled ? "enabled - Thank you!" : "disabled - No statistics data will be sent from this browser from now on."));

                                if(!enabled) {
                                    terminalWriter.warn("Warning: This setting is not saved to your account and is specific to this browser. Make sure to update this setting on other devices.");
                                }
                            },
                            inputs: [
                                {
                                    name: "enabled",
                                    type: "boolean",
                                    default: true
                                }
                            ]
                        }
                    ]
                },

                {
                    name: "performance-mode",
                    icon: "bi-speedometer",
                    description: "Set performance mode",

                    onCalled(value) {
                        window.LOW_PERFORMANCE_MODE = value === "low";
                        localStorage.setItem("LOW_PERFORMANCE_MODE", window.LOW_PERFORMANCE_MODE);
                        terminalWriter.log("Warning: It is recommended to reload the page for this setting to take effect");
                    },

                    inputs: [ {
                        name: "mode",
                        type: "list",
                        list: [
                            { name: "Normal", description: "Recommended", value: "normal" },
                            { name: "Low", description: "Disables some visual effects", value: "low" },
                        ]
                    } ]
                },

                {
                    name: "desktop.config",
                    icon: "bi-pencil-square",
                    description: "Edit desktop config.conf"
                },
            ]
        },

        {
            name: "lock",
            icon: "bi-lock",
            description: "Lock the desktop",

            onCalled() {
                desktop.lock();
            }
        },

        {
            name: "set-accent",
            icon: "bi-palette2",
            description: "Set an accent color",

            onCalled(color) {
                LS.Color.setAccent(color);
            },

            inputs: [
                { name: "preset", type: "list", list: [
                    { name: "custom", icon: "bi-palette2", type: "color" },

                    { name: "random", icon: "bi-shuffle", onCalled() {
                        LS.Color.setAccent(LS.Color.random());
                    }},

                    ...app.ACCENT_COLORS.map(accent => ({
                        name: accent,
                        icon: `bi-circle-fill`,
                        accentColor: accent,
                        value: accent
                    })
                )] }
            ]
        },

        {
            name: "set-theme",
            icon: "bi-palette",
            description: "Set user theme",
            onCalled(theme) {
                if (theme === "system") {
                    localStorage.removeItem("ls-theme"); LS.Color.setAdaptiveTheme();
                } else {
                    app.theme = theme;
                }
            },
            inputs: [
                {
                    name: "theme",
                    type: "list",
                    list: [
                        { name: "Light", value: "light", icon: "bi-brightness-high" },
                        { name: "Dark", value: "dark", icon: "bi-moon" },
                        { name: "System", value: "system", icon: "bi-laptop" }
                    ]
                }
            ]
        },

        {
            name: "toolbar",
            icon: "bi-tools",
            description: "Toolbars",
            onCalled(toolbar) {
                desktop.openToolbar(toolbar);
                desktop.commandPalette.close();
            },

            inputs: [
                {
                    name: "toolbar",
                    type: "list",
                    list: [
                        { name: "Accounts", value: "login", icon: "bi-person-circle" },
                        { name: "Apps", value: "apps", icon: "bi-app" },
                        { name: "Music Player", value: "musicPlayer", icon: "bi-music-note" },
                        { name: "Customize website", value: "theme", icon: "bi-brush" },
                        { name: "Assistant", value: "assistant", icon: "bi-robot" }
                    ]
                }
            ]
        },

        {
            name: "apps",
            icon: "bi-window",
            description: "Applications",

            children: [
                {
                    name: "open",
                    icon: "bi-box-arrow-up-right",
                    description: "Open an app",
                    children() {
                        return [...kernel.appManifests.values()].map(app => ({ name: app.name.replace(/\s+/g, '_'), value: app.id, icon: app.icon, onCalled() {
                            kernel.openApplication(app, { source: "palette" })
                                // .loading(() => {}) // TODO: loading mark for the palette
                                .done((instance) => {
                                    instance.open?.();
                                    desktop.commandPalette.close();
                                })
                                .catch(error => {
                                    terminalWriter.log("Failed to open app: " + (error.message || error.error || "Unknown error"));
                                });
                        }}));
                    }
                },

                {
                    name: "uninstall",
                    icon: "bi-trash",
                    description: "Uninstall an app",
                },

                {
                    name: "install",
                    icon: "bi-download",
                    description: "Install an app",
                },

                {
                    name: "sync",
                    icon: "bi-arrow-repeat",
                    description: "Enable sync for an app",
                },

                {
                    name: "unsync",
                    icon: "bi-x-lg",
                    description: "Disable sync for an app",
                },

                {
                    name: "auth",
                    icon: "bi-shield-lock",
                    description: "Authenticate"
                },

                {
                    name: "manage-permissions",
                    icon: "bi-shield-lock",
                    description: "Manage app permissions",
                }
            ]
        },

        {
            name: "echo",
            alias: ["print"],
            icon: "bi-chat",
            description: "Echo input",
            onCalled(text) { terminalWriter.log(text || "") },
            inputs: [
                { name: "text", type: "string", description: "Text to echo" }
            ]
        },

        {
            name: "version-info",
            icon: "bi-info-circle",
            description: "Get copyable version information",
            async onCalled() {
                const uname = await kernel.env.proc.uname();
                terminalWriter.log(`${uname.sysname} ${uname.release} LS:${LS.version} DE:${app.desktop?.name} (${ckMeta.codename})`);
            }
        },

        {
            name: "clear",
            icon: "bi-trash",
            alias: ["clear-terminal", "cls"],
            description: "Clear the terminal output",
            onCalled() { terminalOutput.innerHTML = "" }
        },

        {
            name: "close",
            alias: ["exit"],
            icon: "bi-x-circle",
            description: "Close the command palette",
            onCalled() { desktop.commandPalette.close() }
        },

        {
            name: "logout",
            icon: "bi-box-arrow-right",
            description: "Log out of the desktop",
            onCalled() {
                desktop.logout();
            }
        }
    ]);
}

export { CommandPalette, init };