

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