// @ts-check

import { TextCleaner } from "./text_cleaner.js";

export class CStyleCleaner extends TextCleaner {
    constructor() {
        super("c-style", "JS / TS / C-Style", [".js", ".ts", ".tsx", ".java", ".cpp", ".cs", ".css"]);
    }

    /**
     * @param {string} text
     */
    _calculateDensity(text) {
        // Tokens: keywords, arrow functions, comments, block braces
        const tokenRegex = /\b(const|let|var|function|export|import|class|return|if|for|while|switch|await|async|yield|true|false|null|undefined|this)\b|=>|[{}]|\/\/|\/\*|\*\/|;|===/g;
        return this._computeMatchDensity(text, tokenRegex);
    }

    /**
     * @param {string} code
     */
    processText(code) {
        let result = [];
        let i = 0;
        let inString = null;
        let inRegex = false;
        let inSingle = false;
        let inMulti = false;

        while (i < code.length) {
            const char = code[i];
            const next = code[i + 1] || "";
            const prev = i > 0 ? code[i - 1] : "";

            // Handle existing multi-line comment state
            if (inMulti) {
                if (char === '*' && next === '/') {
                    inMulti = false;
                    i += 2;
                } else {
                    if (char === '\n') {
                        result.push('\n');
                    }
                    i++;
                }
                continue;
            }

            // Handle existing single-line comment state
            if (inSingle) {
                if (char === '\n') {
                    inSingle = false;
                } else {
                    i++;
                    continue;
                }
            }

            // Enter comment states (Only if not currently in a string or regex)
            if (!inString && !inRegex) {
                if (char === '/' && next === '*') {
                    inMulti = true;
                    i += 2;
                    continue;
                }
                if (char === '/' && next === '/' && prev !== ':') {
                    inSingle = true;
                    i += 2;
                    continue;
                }
            }

            // Helper to check for escape characters (handles double backslash \\ correctly)
            const isEscaped = () => {
                let backslashCount = 0;
                let j = i - 1;
                while (j >= 0 && code[j] === '\\') {
                    backslashCount++;
                    j--;
                }
                // If the number of backslashes is odd, the character is escaped.
                return (backslashCount % 2) !== 0;
            };

            // String and Regex protection logic
            if (!inSingle && !inMulti) {
                
                // String tracking
                if (!inRegex && (char === "'" || char === '"' || char === '`')) {
                    if (inString === char) {
                        if (!isEscaped()) {
                            inString = null;
                        }
                    } else if (!inString) {
                        inString = char;
                    }
                }

                // Regex tracking
                if (!inString) {
                    if (!inRegex && char === '/' && next !== '/' && next !== '*') {
                        
                        // Find the first non-whitespace character before the slash
                        let j = i - 1;
                        while (j >= 0 && (code[j] === ' ' || code[j] === '\t' || code[j] === '\r' || code[j] === '\n')) {
                            j--;
                        }
                        const p = j >= 0 ? code[j] : "";
                        
                        // Characters that typically precede a regex literal in JS
                        const regexPrerequisites = ['(', '=', ':', ',', '[', '!', '&', '|', '?', '{', '>', '<', ';', '+', '-', '*', '%', '~', '^'];
                        if (regexPrerequisites.includes(p) || p === "") {
                            inRegex = true;
                        }
                    } else if (inRegex && char === '/') {
                        if (!isEscaped()) {
                            inRegex = false;
                        }
                    } else if (inRegex && char === '\n') {
                        // Regex literals cannot span multiple lines in JS
                        inRegex = false;
                    }
                }
            }

            result.push(char);
            i++;
        }

        const stripped = result.join('');
        return this._postProcess(code, stripped);
    }
}