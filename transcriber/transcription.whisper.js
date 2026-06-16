import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.0';
import { EventEmitter } from './transcription.emitter.js';
import { VADAdapter } from './transcription.vad.js';

env.allowLocalModels = true;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = navigator.hardwareConcurrency || 1 // Require some stupid headers to work
console.log("SharedArrayBuffer supported:", typeof SharedArrayBuffer !== 'undefined');
console.log("Cross-Origin Isolated:", self.crossOriginIsolated);
console.log("Cores available:", env.backends.onnx.wasm.numThreads);

export class WhisperAdapter extends EventEmitter {
    /** @type {VADAdapter} */
    vadAdapter = null;
    transcriber = null;
    /** @type {string} */
    language = null;
    /** @type {string} */
    modelName = null;
    modelProgress = {};
    /** @type {number} */
    maxProgress = 0;

    constructor(audioData, language, modelName, chunkDurationSeconds = 60, hardCutSeconds = 60, minSilenceSeconds = 5) {
        super();
        this.vadAdapter = new VADAdapter(audioData, chunkDurationSeconds, hardCutSeconds, minSilenceSeconds);
        this.vadAdapter.on("time", (t) => this.emit("time", t));
        this.language = language;
        this.modelName = modelName;
    }

    async initWhisper(callback = async () => {}) {
        if (this.transcriber) { return; }

        await callback(0); // 0-10% is loading vad & ffmpeg
        await this.vadAdapter.initVad();
        await callback(10);

        this.transcriber = await pipeline('automatic-speech-recognition', this.modelName, {
            device: 'webgpu',
            dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
            progress_callback: async (data) => {
                if (data.progress) { this.modelProgress[data.file] = data.progress; }

                // Calculate average progress across all files currently downloading
                const keys = Object.keys(this.modelProgress);
                const sum = keys.reduce((a, b) => a + this.modelProgress[b], 0);
                const avg = sum / Math.max(keys.length, 8);

                // Update current max progress and send callback
                if (avg > this.maxProgress) { await callback(10 + ((this.maxProgress = avg) * 0.9)) }
            },
        });

        await callback(100);
    }

    async startWhisper(callback = async () => {}) {
        await this.initWhisper();
        this.maxProgress = 0;

        await this.vadAdapter.startVad(async (float32Data, currentTime) => {
            const result = await this.transcriber(float32Data, {
                language: this.language === 'auto' ? null : this.language,
                chunk_length_s: 30, // Internal stride logic
                stride_length_s: 5,
                return_timestamps: true,
                force_full_sequences: false,
                chunk_callback: (chunk) => console.log("Streamed segment:", chunk.text),
            });

            // Send data back to the callback
            if (!result?.chunks) { return; }

            for (let chunk of result.chunks) {
                const start = currentTime + chunk.timestamp[0];
                const end = currentTime + (chunk.timestamp[1] || chunk.timestamp[0] + 1);
                const totalSeconds = this.getTotalSeconds();
                const format = (t) => VADAdapter.formatTime(t);
                this.maxProgress = Math.min(Math.max(this.maxProgress, (end / totalSeconds * 100)), 100);

                await callback({
                    text: chunk.text, start: start, end: end, totalSeconds: totalSeconds, percent: this.maxProgress,
                    startFormatted: format(start), endFormatted: format(end), totalSecondsFormatted: format(totalSeconds)
                })
            }
        });
    }

    getTotalSeconds() {
        return this.vadAdapter.getTotalSeconds();
    }

    static formatTime(t) {
        return VADAdapter.formatTime(t);
    }
}