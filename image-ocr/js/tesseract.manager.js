export class TesseractManager {
    static workers = [];
    static specialWorker = null;
    static availableWorkers = [];
    static stopEventListeners = {};
    static initalizing = false;
    static hasStopped = false;

    /**
     * Initializes the Tesseract workers.
     * @param {number} amount - The number of workers to initialize.
     * @param {string[]} langauge - The languages to initialize the workers with.
     * @param {Function} progressCallback - A callback function to report initialization progress.
     */
    static async initWorkers(amount = 1, langauge = ["eng"], progressCallback = () => {}) {
        if (amount < 1) { throw new Error("Amount of workers must be at least 1"); }
        await TesseractManager.waitInitialization(); // Wait if another initialization is in progress
        TesseractManager.initalizing = true;

        // Terminate existing workers
        TesseractManager.workers.forEach(worker => worker.terminate());
        TesseractManager.workers = [];
        TesseractManager.currentWorkerIndex = 0;

        const initPromises = Array.from({ length: amount }).map((_, i) => {
            return new Promise(async (resolve) => {
                const worker = new Worker('js/tesseract.worker.js');
                worker.postMessage({ language: langauge, init: true });
                await new Promise(r => worker.addEventListener('message', r, { once: true }));
                
                TesseractManager.workers.push(worker);
                TesseractManager.availableWorkers.push(worker);
                progressCallback(TesseractManager.workers.length / amount * 100);
                resolve();
            });
        });

        await Promise.all(initPromises);
        TesseractManager.hasStopped = false;
        TesseractManager.initalizing = false;
    }

    /**
     * Stops all Tesseract workers and resets the manager state.
     */
    static stopWorkers() {
        TesseractManager.hasStopped = true;
        Object.values(TesseractManager.stopEventListeners).forEach(listener => listener());
        TesseractManager.workers.forEach(worker => worker.terminate());
        TesseractManager.specialWorker?.terminate();
        TesseractManager.specialWorker = null;
        TesseractManager.workers = [];
        TesseractManager.availableWorkers = [];
        TesseractManager.stopEventListeners = {};
        TesseractManager.currentWorkerIndex = 0;
    }

    /**
     * Waits until the Tesseract workers have finished initializing.
     */
    static async waitInitialization() {
        while (TesseractManager.initalizing) { await new Promise(resolve => setTimeout(resolve, 1)); }
    }

    /**
     * Waits until at least one worker is free to process a new task.
     */
    static async waitInQueue() {
        while (!TesseractManager.hasStopped && TesseractManager.availableWorkers.length == 0) { await new Promise(resolve => setTimeout(resolve, 1)); }
    }

    /**
     * Recognizes text from an image using a specific Tesseract worker.
     * @param {Worker} worker - The Tesseract worker to use for recognition.
     * @param {string|Blob|ImageData} image - The image to recognize text from.
     * @param {string[]} language - The languages to use for recognition.
     * @param {number} minConfidence - The minimum confidence threshold for recognized words.
     * @param {Function} callback - A callback function to handle progress updates.
     * @returns {Promise<{text: string, fragments: Array}|Error>} - The recognized text and fragments or an error.
     */
    static async recognizeWorker(worker, image, language = ["eng"], minConfidence = -1, callback = (progress) => {}) {
        const handlers = []; // Sneaky little workaround
        const listenerId = Date.now() + Math.random(); // Unique ID for this recognition task

        const result = await new Promise((resolve, _) => {
            TesseractManager.stopEventListeners[listenerId] = resolve; // Add a stop listener for this task
            handlers.push((e) => { if (e.data.progress === undefined) { resolve(e.data.error ? new Error(e.data.error) : e.data.result) } });
            handlers.push((e) => { if (e.data.progress !== undefined) { callback(e.data.progress); } });
            handlers.forEach(h => worker.addEventListener('message', h));
            worker.postMessage({ msgId: undefined, image: image, language: language, minConfidence: minConfidence, init: false });
        });

        handlers.forEach(h => worker.removeEventListener('message', h));
        delete TesseractManager.stopEventListeners[listenerId]; // Remove the stop listener for this task
        return result;
    }

    /**
     * Recognizes text from an image using Tesseract workers.
     * @param {string|Blob|ImageData} image - The image to recognize text from.
     * @param {string[]} language - The languages to use for recognition.
     * @param {number} minConfidence - The minimum confidence threshold for recognized words.
     * @returns {Promise<{text: string, fragments: Array}>} - The recognized text and fragments.
     * @throws {Error} - Throws an error if no workers are available or if recognition fails.
     */
    static async recognize(image, language = ["eng"], minConfidence = -1) {
        await TesseractManager.waitInitialization();
        await TesseractManager.waitInQueue();
        if (TesseractManager.hasStopped) { return; }
        if (TesseractManager.workers.length === 0) { throw new Error("No Tesseract workers available. Please initialize workers first."); }

        const worker = TesseractManager.availableWorkers.pop();
        if (!worker) { throw new Error("No Tesseract workers available. Please initialize workers first."); }
        let hasStopped = false;
        const listenerId = Date.now() + Math.random(); // Unique ID for this recognition task
        TesseractManager.stopEventListeners[listenerId] = () => { hasStopped = true; }; // Add a stop listener for this task
        let result = await TesseractManager.recognizeWorker(worker, image, language, minConfidence);
        delete TesseractManager.stopEventListeners[listenerId]; // Remove the stop listener for this task

        // CHECK: If stopped outside of this function (stopWorkers), we should ensure the worker is NOT RETURNED to the available pool
        if (!hasStopped) { TesseractManager.availableWorkers.push(worker); } else { result = null; } // If stopped, we don't return the worker to the pool and set result to null
        return result instanceof Error ? Promise.reject(result) : result;
    }

    /**
     * Recognizes text from an image using Tesseract workers with a callback.
     * NOTE: YOU ARE AWAITING YOUR POSITION IN THE QUEUE, NOT THE RESULT.
     * @param {string|Blob|ImageData} image - The image to recognize text from.
     * @param {string[]} language - The languages to use for recognition.
     * @param {number} minConfidence - The minimum confidence threshold for recognized words.
     * @param {Function} callback - A callback function to handle the result or error.
     */
    static async recognizeCallback(image, language = ["eng"], minConfidence = -1, callback = (err, result) => {}) {
        await TesseractManager.waitInQueue();
        TesseractManager.recognize(image, language, minConfidence).then(result => callback(null, result)).catch(err => callback(err, null));
    }

    /**
     * Recognizes text from an image using a dedicated special Tesseract worker.
     * @param {string|Blob|ImageData} image - The image to recognize text from.
     * @param {string[]} language - The languages to use for recognition.
     * @param {number} minConfidence - The minimum confidence threshold for recognized words.
     * @param {Function} callback - A callback function to handle progress updates.
     * @returns {Promise<{text: string, fragments: Array}>} - The recognized text and fragments.
     * @throws {Error} - Throws an error if recognition fails.
     */
    static async recognizeSpecial(image, language = ["eng"], minConfidence = -1, callback = (progress) => {}) {
        if (!TesseractManager.specialWorker) { TesseractManager.specialWorker = new Worker('js/tesseract.worker.js'); }
        let result = await TesseractManager.recognizeWorker(TesseractManager.specialWorker, image, language, minConfidence, callback);
        return result instanceof Error ? Promise.reject(result) : result;
    }
}