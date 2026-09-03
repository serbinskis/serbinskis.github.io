// @ts-check

/**
 * @typedef {Object} CleanerMatch
 * @property {TextCleaner} cleaner
 * @property {number} score
 */

/**
 * Base class for all code comment strippers.
 * Provides a registry system and density-based language detection.
 */
export class TextCleaner {
    /** 
     * Internal registry of initialized cleaner instances.
     * @type {TextCleaner[]} 
     */
    static #registry = [];

    static { // @ts-ignore
        window.TextCleaner = TextCleaner;
    }

    /**
     * @param {string} id - Unique identifier for the cleaner (e.g., 'python').
     * @param {string} title - Human-readable name (e.g., 'Python').
     * @param {string[]} extensions - Array of file extensions including the dot.
     */
    constructor(id, title, extensions) {
        /** @type {string} */
        this.id = id;
        /** @type {string} */
        this.title = title;
        /** @type {string[]} */
        this.extensions = extensions;
    }

    /**
     * Now accepts instances to avoid circular imports
     * @param {TextCleaner[]} cleaners 
     */
    static registerAll(cleaners) {
        this.#registry = cleaners;
    }

    /**
     * Core logic to strip comments. Must be implemented by subclasses.
     * @param {string} text - The raw source code.
     * @returns {string} - The cleaned source code.
     * @abstract
     */
    processText(text) {
        throw new Error("Subclass must implement processText");
    }

    /**
     * Calculates a confidence score for whether this cleaner matches the input.
     * Extension matches return a score > 1.0 to prioritize them over content detection.
     * @param {string|null} filename - The name of the file if available.
     * @param {string} text - The raw source code.
     * @returns {number} - A confidence score (usually 0.0 to 1.5).
     */
    getScore(filename, text) {
        if (filename) {
            const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
            if (this.extensions.includes(ext)) { return 1.5; }
        }

        return this._calculateDensity(text);
    }

    /**
     * Helper to calculate the percentage of text that matches specific language tokens.
     * @param {string} text - The raw source code.
     * @param {RegExp} regex - Global regex containing language-specific fingerprints.
     * @returns {number} - Density ratio between 0.0 and 1.0.
     * @protected
     */
    _computeMatchDensity(text, regex) {
        if (!text) { return 0; }
        const matches = text.match(regex);
        if (!matches) { return 0; }
        const totalMatchedChars = matches.reduce((sum, m) => sum + m.length, 0);
        return totalMatchedChars / text.length;
    }

    /**
     * Calculates language-specific syntax density. Must be implemented by subclasses.
     * @param {string} text - The raw source code.
     * @returns {number} - Density ratio.
     * @abstract
     * @protected
     */
    _calculateDensity(text) {
        return 0;
    }

    /**
     * Iterates through the registry to find the most suitable cleaner for the input.
     * @param {string|null} filename - File name or null.
     * @param {string} text - Source code content.
     * @returns {TextCleaner|null} - The best matching cleaner instance or null.
     */
    static findCleaner(filename, text) {
        let best = null;
        let topScore = -1;
        for (const cleaner of this.#registry) {
            const score = cleaner.getScore(filename, text);
            if (score > topScore && score > 0) {
                topScore = score;
                best = cleaner;
            }
        }
        return best;
    }

    /**
     * Returns a copy of the registered cleaner instances.
     * @returns {TextCleaner[]}
     */
    static getAllCleaners() {
        return [...this.#registry];
    }

    /**
     * Post-processing logic to remove lines that become entirely empty after stripping comments.
     * It compares line-by-line to distinguish between intentional empty lines and "ghost" lines 
     * left behind by removed comments.
     * @param {string} original - The source code before stripping.
     * @param {string} stripped - The source code after stripping.
     * @returns {string} - Final output with cleaned line structure.
     * @protected
     */
    _postProcess(original, stripped) {
        const originalLines = original.split(/\r?\n/);
        const strippedLines = stripped.split(/\r?\n/);
        const finalLines = [];

        for (let i = 0; i < strippedLines.length; i++) {
            const orig = originalLines[i] || "";
            const strip = strippedLines[i];
            
            // If the line was originally NOT empty but is NOW empty, it was 100% comments.
            if (orig.trim() !== "" && strip.trim() === "") { continue; }
            finalLines.push(strip.trimEnd());
        }
        
        let output = finalLines.join('\n');
        if (original.endsWith('\n')) { output += '\n'; }
        return output;
    }
}