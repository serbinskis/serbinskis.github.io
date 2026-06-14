export class TesseractManager {
    static workers = [];
    static currentWorkerIndex = 0;
    static currentAmount = 0;
    static freeWorkers = 0;
    static initalizing = false;

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
                const worker = new Worker('tesseract.worker.js');
                worker.postMessage({ language: langauge, init: true });
                await new Promise(r => worker.addEventListener('message', r, { once: true }));
                
                TesseractManager.workers.push(worker);
                progressCallback(TesseractManager.workers.length / amount);
                resolve();
            });
        });

        await Promise.all(initPromises);
        TesseractManager.currentAmount = amount;
        TesseractManager.freeWorkers = amount;
        TesseractManager.initalizing = false;
    }

    /**
     * Stops all Tesseract workers and resets the manager state.
     */
    static stopWorkers() {
        TesseractManager.workers.forEach(worker => worker.terminate());
        TesseractManager.workers = [];
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
        while (TesseractManager.freeWorkers == 0) { await new Promise(resolve => setTimeout(resolve, 1)); }
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
        if (TesseractManager.workers.length === 0) { throw new Error("No Tesseract workers available. Please initialize workers first."); }

        TesseractManager.freeWorkers--;
        const worker = TesseractManager.workers[TesseractManager.currentWorkerIndex];
        TesseractManager.currentWorkerIndex = (TesseractManager.currentWorkerIndex + 1) % TesseractManager.workers.length;

        const result = await new Promise((resolve, _) => {
            const handler = (e) => resolve(e.data.error ? new Error(e.data.error) : e.data.result);
            worker.addEventListener('message', handler, { once: true });
            worker.postMessage({ msgId: undefined, image: image, language: language, minConfidence: minConfidence, init: false });
        });

        TesseractManager.freeWorkers++;
        return result instanceof Error ? Promise.reject(result) : result;
    }
}