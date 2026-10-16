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
     */
    on(event, callback, { once = false } = {}) {
        if (!this.events[event]) { this.events[event] = []; }
        this.events[event].push({ callback, once });
    }

    /**
     * Triggers all listeners registered for the given event.
     */
    emit(event, data) {
        if (!this.events[event]) { return; }
        this.events[event] = this.events[event].filter(listener => {
            listener.callback(data);
            return !listener.once;
        });
    }

    /**
     * Removes all listeners for a specific event, or a specific callback.
     */
    off(event, callback) {
        if (!this.events[event]) { return; }
        if (!callback) { delete this.events[event]; }
        if (callback) { this.events[event] = this.events[event].filter(l => l.callback !== callback); }
    }
}