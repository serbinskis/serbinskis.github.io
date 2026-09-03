// @ts-check

import { CStyleCleaner } from "./cstyle_cleaner.js";
import { HtmlCleaner } from "./html_cleaner.js";
import { TextCleaner } from "./text_cleaner.js";

export class HtmlCssJsCleaner extends TextCleaner {
    constructor() {
        super("html_css_js", "HTML + CSS + JS", [".html", ".htm"]);
    }

    /**
     * @param {string} text
     */
    _calculateDensity(text) {
        return new HtmlCleaner()._calculateDensity(text);
    }

    /**
     * @param {string} code
     */
    processText(code) {
        const first = new CStyleCleaner().processText(code);
        const next = new HtmlCleaner().processText(first);
        return next;
    }
}