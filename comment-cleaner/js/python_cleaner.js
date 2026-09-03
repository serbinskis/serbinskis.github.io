// @ts-check

import { TextCleaner } from "./text_cleaner.js";

export class PythonCleaner extends TextCleaner {
    constructor() {
        super("python", "Python", [".py", ".pyw"]);
    }

    /**
     * @param {string} text
     */
    _calculateDensity(text) {
        // Tokens: Python keywords, hash comments, triple quotes, colons at line ends
        const tokenRegex = /\b(def|class|import|from|elif|if|else|while|for|try|except|with|as|return|yield|None|True|False|and|or|not|in|is|pass)\b|#|'''|"""|:\s*$/gm;
        return this._computeMatchDensity(text, tokenRegex);
    }

    /**
     * @param {string} code
     */
    processText(code) {
        let result = [];
        let i = 0, inString = null, inTriple = null, inComment = false;

        while (i < code.length) {
            const char = code[i], next3 = code.substring(i, i+3), prev = result[result.length - 1] || "";
            if (inComment) { if (char === '\n') { inComment = false; result.push('\n'); } i++; continue; }

            if (!inComment && !inString) {
                if (inTriple) { if (next3 === inTriple && prev !== '\\') { result.push(next3); inTriple = null; i += 3; continue; }
                } else if (next3 === "'''" || next3 === '"""') { inTriple = next3; result.push(next3); i += 3; continue; }
            }

            if (!inComment && !inTriple) {
                if (["'", '"'].includes(char)) {
                    if (inString === char) { if (prev !== '\\') inString = null; }
                    else if (!inString) { inString = char; }
                }
            }

            if (!inString && !inTriple && char === '#') { inComment = true; i++; continue; }
            result.push(char); i++;
        }

        return this._postProcess(code, result.join(''));
    }
}