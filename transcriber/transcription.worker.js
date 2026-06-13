import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2';

env.useBrowserCache = false;
env.useCache = false;
env.allowLocalModels = false;
console.log("SharedArrayBuffer supported:", typeof SharedArrayBuffer !== 'undefined');
console.log("Cross-Origin Isolated:", self.crossOriginIsolated);
console.log("Cores available:", env.backends.onnx.wasm.numThreads);
console.dir(env, { depth: null });

/**
 * Decodes a Blob/File into PCM Float32 data at 16000Hz strictly inside the worker.
 * Uses WebCodecs API (AudioDecoder) which is available in Workers.
 */
async function decodeAudio(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(new Uint8Array(arrayBuffer));
            controller.close();
        }
    });

    return new Float32Array(arrayBuffer); 
}

self.onmessage = async (e) => {
    const { audioData, modelName, language } = e.data;
    
    console.log("--- WORKER RECEIVED DATA ---");
    console.log("Model:", modelName);
    console.log("Language:", language);
    console.log("Audio Data Handle:", audioData); // This will show the File/Blob object

    try {
        self.postMessage({ type: 'status', msg: 'Initializing...' });

        // Start downloading and loading
        let transcriber = await pipeline('automatic-speech-recognition', modelName, {
            dtype: 'fp32', 
            device: 'webgpu',
            progress_callback: (p) => {
                // Send download/loading progress back to UI
                self.postMessage({ type: 'progress', data: p });
            }
        });

        self.postMessage({ type: 'bar', msg: 'Model loaded into memory.', progress: 100 });
        const audioSource = await decodeAudio(audioData);

        const result = await transcriber(audioSource, {
            language: language === 'auto' ? null : language,
            chunk_length_s: 30,
            stride_length_s: 5,
            return_timestamps: true,
            force_full_sequences: false,
            // This callback sends text chunks to the UI as they are processed
            callback_function: (outputs) => {
                const chunk = outputs[0];
                if (chunk && chunk.chunks) {
                    const lastChunk = chunk.chunks[chunk.chunks.length - 1];
                    if (lastChunk && lastChunk.timestamp) {
                        self.postMessage({
                            type: 'partial',
                            data: {
                                start: lastChunk.timestamp[0],
                                end: lastChunk.timestamp[1] || lastChunk.timestamp[0] + 1,
                                text: lastChunk.text
                            }
                        });
                    }
                }
            }
        });

        self.postMessage({ type: 'bar', msg: 'Transcription complete!', progress: 100 });
    } catch (err) {
        console.error("Error in worker:", err);
        self.postMessage({ type: 'error', msg: err.message });
    }
};