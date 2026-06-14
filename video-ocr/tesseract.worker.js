importScripts('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');

let currentLangStr = null;
let workerInstance = null;

self.onmessage = async (e) => {
    const { msgId, image, language, minConfidence, init } = e.data; // msgId not used anymore, but I kept it just in case
    const confThreshold = minConfidence ?? -1; // Default to -1 if not provided, meaning no filtering based on confidence
    const langStr = language.join('+');

    try {
        if (!workerInstance) { workerInstance = await Tesseract.createWorker(); }

        if (currentLangStr !== langStr) {
            await workerInstance.reinitialize(language);
            console.log(`Tesseract worker initialized with language: ${language}`);
            currentLangStr = langStr;
        }

        if (init) { return self.postMessage({ msgId, result: { status: 'ready' } }); }
        const ret = await workerInstance.recognize(image);

        // Instead of returning ret.data.words (which contains massive recursive objects), 
        // we strip it down to raw primitives and filter out bad confidence matches.
        const strippedFragments = [];
        let cleanText = "";

        // Iterate through lines to preserve line breaks when reconstructing text
        if (ret.data && ret.data.lines) {
            ret.data.lines.forEach(line => {
                let lineTextArray = [];

                line.words.forEach(w => {
                    if (w.confidence < confThreshold) { return; } // Skip low confidence words
                    strippedFragments.push({ text: w.text, confidence: w.confidence, bbox: w.bbox, language: w.language });
                    lineTextArray.push(w.text);
                });

                if (lineTextArray.length > 0) {
                    cleanText += lineTextArray.join(' ') + '\n';
                }
            });
        }

        self.postMessage({ msgId, result: { text: cleanText.trim(), fragments: strippedFragments }});
    } catch (err) {
        self.postMessage({ msgId, error: err.message || "Unknown OCR Error" });
    }
}