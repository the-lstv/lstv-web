

const operators = [
    ";;&",
    "<<<",
    "<<-",
    "&>>",
    ">>",
    "<<",
    "&&",
    "||",
    ";;",
    ";&",
    "&>",
    ">&",
    "<&",
    ">|",
    "<>",
    "|",
    "&",
    ";",
    ">",
    "<",
    "(",
    ")",
    "{",
    "}"
];
    
/**
 * LinuxJS bash interpreter.
 */
function tokenizeBash(code) {
    const tokens = [];

    let i = 0;
    let word = "";
    let wordStart = -1;

    function startWord() {
        if (wordStart === -1) {
            wordStart = i;
        }
    }

    function flushWord() {
        if (word.length === 0) {
            wordStart = -1;
            return;
        }

        tokens.push({
            type: "word",
            value: word,
            start: wordStart,
            end: i
        });

        word = "";
        wordStart = -1;
    }

    function add(value) {
        startWord();
        word += value;
    }

    function isWhitespace(c) {
        return c === " " ||
               c === "\t" ||
               c === "\r" ||
               c === "\n";
    }

    function readOperator() {
        for (const operator of operators) {
            if (code.startsWith(operator, i)) {
                return operator;
            }
        }

        return null;
    }

    function readSingleQuote() {
        startWord();

        const start = i++;
        let value = "'";

        while (i < code.length) {
            const c = code[i++];

            value += c;

            if (c === "'") {
                break;
            }
        }

        word += value;

        return i - start;
    }

    function readDoubleQuote() {
        startWord();

        word += code[i++]; // "

        while (i < code.length) {
            const c = code[i];

            if (c === '"') {
                word += c;
                i++;
                return;
            }

            if (c === "\\") {
                word += c;
                i++;

                if (i < code.length) {
                    word += code[i++];
                }

                continue;
            }

            if (c === "$") {
                readExpansion();
                continue;
            }

            word += c;
            i++;
        }
    }

    function readExpansion() {
        startWord();

        // $((...))
        if (code.startsWith("$((", i)) {
            const start = i;

            i += 3;
            let depth = 1;

            while (i < code.length && depth > 0) {
                if (code.startsWith("((", i)) {
                    depth++;
                    i += 2;
                    continue;
                }

                if (code.startsWith("))", i)) {
                    depth--;
                    i += 2;
                    continue;
                }

                if (code[i] === "\\") {
                    i += 2;
                    continue;
                }

                i++;
            }

            word += code.slice(start, i);
            return;
        }

        // $(...)
        if (code.startsWith("$(", i)) {
            const start = i;

            i += 2;
            let depth = 1;
            let quote = null;

            while (i < code.length && depth > 0) {
                const c = code[i];

                if (quote === "'") {
                    i++;

                    if (c === "'") {
                        quote = null;
                    }

                    continue;
                }

                if (quote === '"') {
                    if (c === "\\") {
                        i += 2;
                        continue;
                    }

                    i++;

                    if (c === '"') {
                        quote = null;
                    }

                    continue;
                }

                if (c === "'" || c === '"') {
                    quote = c;
                    i++;
                    continue;
                }

                if (c === "\\") {
                    i += 2;
                    continue;
                }

                if (c === "(") {
                    depth++;
                } else if (c === ")") {
                    depth--;
                }

                i++;
            }

            word += code.slice(start, i);
            return;
        }

        // ${...}
        if (code.startsWith("${", i)) {
            const start = i;

            i += 2;
            let depth = 1;

            while (i < code.length && depth > 0) {
                if (code[i] === "{") {
                    depth++;
                } else if (code[i] === "}") {
                    depth--;
                }

                i++;
            }

            word += code.slice(start, i);
            return;
        }

        // $?, $!, $#, $@, $*, $$, $-, $0-$9
        if (
            i + 1 < code.length &&
            "$?!#@*$-0123456789".includes(code[i + 1])
        ) {
            word += code.slice(i, i + 2);
            i += 2;
            return;
        }

        // $VARIABLE
        if (
            i + 1 < code.length &&
            /[A-Za-z_]/.test(code[i + 1])
        ) {
            const start = i++;

            while (
                i < code.length &&
                /[A-Za-z0-9_]/.test(code[i])
            ) {
                i++;
            }

            word += code.slice(start, i);
            return;
        }

        // Bare $
        word += "$";
        i++;
    }

    while (i < code.length) {
        const c = code[i];

        // Whitespace terminates a word.
        if (isWhitespace(c)) {
            flushWord();

            if (c === "\n") {
                tokens.push({
                    type: "newline",
                    value: "\n",
                    start: i,
                    end: i + 1
                });
            }

            i++;
            continue;
        }

        // Comment.
        // A # inside a word is ordinary text.
        if (c === "#" && word.length === 0) {
            const start = i;

            while (
                i < code.length &&
                code[i] !== "\n"
            ) {
                i++;
            }

            tokens.push({
                type: "comment",
                value: code.slice(start, i),
                start,
                end: i
            });

            continue;
        }

        // Single quoted string.
        if (c === "'") {
            readSingleQuote();
            continue;
        }

        // Double quoted string.
        if (c === '"') {
            readDoubleQuote();
            continue;
        }

        // Backslash escape.
        if (c === "\\") {
            startWord();

            word += c;
            i++;

            if (i < code.length) {
                word += code[i++];
            }

            continue;
        }

        // Expansion.
        if (c === "$") {
            readExpansion();
            continue;
        }

        // Shell operator.
        const operator = readOperator();

        if (operator) {
            flushWord();

            tokens.push({
                type: "operator",
                value: operator,
                start: i,
                end: i + operator.length
            });

            i += operator.length;
            continue;
        }

        // Ordinary character.
        add(c);
        i++;
    }

    flushWord();

    return tokens;
}

/**
 * Quick interpreter. This is not a full bash parser.
 */
function simpleShell(code) {
    const c = [];

    const tokens = tokenizeBash(code);
    for (const token of tokens) {
        if (token.type === "comment") continue;
        if (token.type === "word") c.push(token.value);

        if(c.length === 1) {
            
        }
    }
}

window.tokenizeBash = tokenizeBash;

/**
 * GlitterShell interpreter.
 */
// tba