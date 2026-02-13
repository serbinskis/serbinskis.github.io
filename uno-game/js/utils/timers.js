/**
 * Defines the optional configuration for a timer.
 * @typedef {Object} TimerOptions
 * @property {number|string} [id]
 * @property {boolean} [immediate]
 * @property {boolean} [interval]
 * @property {number} [amount] // how many times to run (interval only)
 */

/**
 * Defines the structure for an internally stored timer instance.
 * @internal
 * @typedef {Object} TimerInstance
 * @property {NodeJS.Timeout} timeoutId
 * @property {(immediate?: boolean) => void | Promise<void>} callback
 * @property {number} gap
 * @property {TimerOptions} options
 */

/**
 * A utility class for managing timers (setTimeout).
 * Allows for creating, stopping, and changing stoppable, interval-based timers.
 */
export class Timer {
    static { // @ts-ignore
        window.Timer = Timer;
    }

    // A dictionary to hold all active timer instances, keyed by their ID.
    /** @type {{ [id: number|string]: TimerInstance }} */
    static timers = {};

    /** @type {number} */
    static counter = 0;

    /**
     * @param {(timer?: TimerOptions) => void | Promise<void>} cb
     * @param {number} gap
     * @param {TimerOptions} [opts]
     * @returns {number|string|Promise<number|string>}
     */

    // ---------------- async callback + immediate: true ----------------
    // ---------------- async callback + immediate: false / missing ----
    // ---------------- sync callback (any immediate) ------------------
    // ---------------- implementation --------------------------------
    static start(cb, gap, opts = {}) {
        opts.id = opts.id ?? ++this.counter; // Assign a new unique ID if one isn't provided.
        this.stop(opts.id); // Stop any existing timer with the same ID before starting a new one.

        opts.amount = (typeof opts.amount === 'number') ? opts.amount : undefined;
        let promise = null; // To hold the result of the callback if it's a promise.
        let result = opts.id; // Default result is the timer ID.

        // Store the timer instance with the callback and options before executing the callback, so that it can be accessed if 'immediate' is true.
        this.timers[opts.id] = { callback: cb, gap, options: opts };

        if (opts.immediate) { promise = cb(JSON.parse(JSON.stringify(opts))); } // If 'immediate' is true, execute the callback right away.
        if (promise instanceof Promise) { result = promise.then(() => opts.id); } // If the callback returns a promise, wait for it to resolve.
        if (opts.immediate && opts.amount != null) { opts.amount--; } // Decrement the amount if immediate execution occurred.
        delete opts.immediate; // The 'immediate' flag is then removed to prevent it from running again on intervals.

        this.timers[opts.id] = { // Schedule the timer to execute the callback after we execute the immediate call (if any).
            timeoutId: setTimeout(() => this.finish(opts.id), gap),
            callback: cb, gap, options: opts
        };

        return result;
    }

    /**
     * Internal function called by setTimeout when a timer's duration is complete.
     * It executes the callback and either restarts the timer (if interval) or removes it.
     * @param {number|string} id The ID of the timer that has finished.
     */
    static finish(id) {
        if (!this.timers[id]) { return; }

        try {
            this.timers[id].callback(JSON.parse(JSON.stringify(this.timers[id].options)));
        } catch (e) {
            console.error(e);
        }

        // Check again if the timer still exists, as the callback might have stopped it.
        if (!this.timers[id]) { return; }

        // If a limited run amount is set, decrement it and stop the timer once exhausted
        if (typeof this.timers[id].options.amount === 'number') {
            this.timers[id].options.amount--;
        }

        // Update remaining before callback, but check after it
        if (this.timers[id].options.amount <= 0) { return this.stop(id); }

        // If it's an interval timer, restart it. Otherwise, delete it.
        if (!this.timers[id].options.interval) { return delete this.timers[id]; }
        this.change(id, this.timers[id].gap);
    }

    /**
     * Stops and removes an active timer.
     * @param {number|string} id The ID of the timer to stop.
     */
    static stop(id) {
        if (!this.timers[id]) { return; }
        clearTimeout(this.timers[id].timeoutId);
        delete this.timers[id];
    }

    /**
     * Changes the duration (gap) and/or options of an existing timer.
     * @param {number|string} id The ID of the timer to change.
     * @param {number} gap The new duration in milliseconds.
     * @param {Partial<TimerOptions>} [opts] Additional options to merge with the existing ones.
     */
    static change(id, gap, opts) {
        if (!this.timers[id]) { return; }

        // Prevent infintie call stack in case of changing the timer while it's executing its callback.
        delete this.timers[id].options.immediate;

        // Combine the old and new options, with the new ones taking precedence.
        const newOptions = { ...this.timers[id].options, ...opts };

        // Restart the timer with the original callback and the new settings.
        this.start(this.timers[id].callback, gap, newOptions);
    }

    /**
     * Resets an existing timer by rescheduling it with the same gap.
     * This keeps the same ID, callback, and options, but restarts
     * the countdown from the beginning.
     *
     * @param {number|string} id The ID of the timer to reset.
     */
    static reset(id) {
        if (!this.timers[id]) { return; }

        // Reschedule the timer with the same gap.
        this.change(id, this.timers[id].gap);
    }

    /**
     * Checks if a timer with the given ID exists.
     * @param {number|string} id The ID of the timer to check.
     * @returns {boolean} True if the timer exists, false otherwise.
     */
    static exists(id) {
        return Boolean(this.timers[id]);
    }

    /**
     * Gets the remaining amount of executions for a timer with the given ID.
     * @param {number|string} id The ID of the timer to check.
     * @returns {number|null} The remaining executions, or null if the timer does not exist or has no limit.
     */
    static getRemaining(id) {
        if (!this.timers[id]) { return null; }
        return this.timers[id].options?.amount ?? null;
    }

    /**
     * Pauses the execution for a specified number of milliseconds.
     */
    static wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
