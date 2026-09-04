// @ts-check

import { TextCleaner } from "./text_cleaner.js";

export class HtmlCleaner extends TextCleaner {
    constructor() {
        super("html", "HTML / XML", [".html", ".htm", ".xml", ".svg"]);
    }

    /**
     * @param {string} text
     */
    _calculateDensity(text) {
        // Tokens: opening/closing tags, entities, comments
        const tokenRegex = /<!DOCTYPE html>|<!--[\s\S]*?-->|<\/?(?:html|head|body|div|span|script|style|link|meta|input|button|p|a|ul|li|table|tr|td|section|nav|footer|header|h[1-6])\b|<\w+\s+[a-z-]+=(?:"[^"]*"|'[^']*')/gi;
        return this._computeMatchDensity(text, tokenRegex);
    }

    /**
     * @param {string} code
     */
    processText(code) {
        let result = [];
        let i = 0, inComment = false;

        while (i < code.length) {
            const char = code[i];
            if (!inComment && code.substring(i, i+4) === "<!--") { inComment = true; i += 4; continue; }
            if (inComment && code.substring(i, i+3) === "-->") { inComment = false; i += 3; continue; }
            if (inComment) { if (char === '\n') { result.push('\n'); } i++; continue; }
            result.push(char); i++;
        }

        return this._postProcess(code, result.join(''));
    }
}