importScripts('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');

let currentLangStr = null;
let workerInstance = null;
let activeMsgId = null;

self.onmessage = async (e) => {
    const { msgId, image, language, minConfidence, init } = e.data; // msgId not used anymore, but I kept it just in case
    const confThreshold = minConfidence ?? -1; // Default to -1 if not provided, meaning no filtering based on confidence
    const langStr = language.join('+');
    activeMsgId = msgId; // Store the active message ID for progress updates (NOT USED BTW)

    try {
        if (!workerInstance) { 
            workerInstance = await Tesseract.createWorker('eng', 1, {
                logger: m => {
                    if (m.status != 'recognizing text') { return; }
                    self.postMessage({ msgId: activeMsgId, progress: m.progress * 100 });
                }
            });
        }

        if (currentLangStr !== langStr) {
            await workerInstance.reinitialize(language);
            console.log(`Tesseract worker initialized with language: ${language}`);
            currentLangStr = langStr;
        }

        if (init) { return self.postMessage({ msgId, result: { status: 'ready' } }); }
        self.postMessage({ msgId, progress: 0 });
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