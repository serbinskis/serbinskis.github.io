/**
 * @callback EventCallback
 * @param {any} data - The data payload associated with the event.
 */

/**
 * @typedef {Object} EventListener
 * @property {EventCallback} callback - The function to execute.
 * @property {boolean} once - Whether the listener should be removed after one call.
 */

/**
 * A lightweight Event Emitter for managing custom asynchronous events.
 */
export class EventEmitter {
    /** 
     * Internal registry of event listeners.
     * @type {Object.<string, EventListener[]>} 
     * @private
     */
    events = {};

    /**
     * Registers a listener for a specific event.
     * 
     * @param {string} event - The name of the event to listen for.
     * @param {EventCallback} callback - The function to call when the event is triggered.
     * @param {Object} [options] - Configuration for the event listener.
     * @param {boolean} [options.once=false] - If true, the listener will be automatically removed after the first time the event is emitted.
     * @returns {void}
     */
    on(event, callback, { once = false } = {}) {
        if (!this.events[event]) { this.events[event] = []; }
        this.events[event].push({ callback, once });
    }

    /**
     * Triggers all listeners registered for the given event.
     * 
     * @param {string} event - The name of the event to emit.
     * @param {any} [data] - Optional data payload to pass to the callbacks.
     * @returns {void}
     */
    emit(event, data) {
        if (!this.events[event]) { return; }

        // Iterate and filter out 'once' listeners in a single pass
        this.events[event] = this.events[event].filter(listener => {
            // Execute the callback
            listener.callback(data);

            // If once is true, return false to remove from the array
            return !listener.once;
        });
    }

    /**
     * Removes all listeners for a specific event, or a specific callback.
     * 
     * @param {string} event - The name of the event.
     * @param {EventCallback} [callback] - If provided, only this specific function will be removed.
     * @returns {void}
     */
    off(event, callback) {
        if (!this.events[event]) { return; }
        if (!callback) { delete this.events[event]; }
        if (callback) { this.events[event] = this.events[event].filter(l => l.callback !== callback); }
    }
}