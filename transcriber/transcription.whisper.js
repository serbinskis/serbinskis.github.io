import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.0';
import { EventEmitter } from './transcription.emitter.js';
import { FfmpegAdapter } from './transcription.ffmpeg.js';

env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = navigator.hardwareConcurrency || 1 // Require some stupid headers to work
console.log("SharedArrayBuffer supported:", typeof SharedArrayBuffer !== 'undefined');
console.log("Cross-Origin Isolated:", self.crossOriginIsolated);
console.log("Cores available:", env.backends.onnx.wasm.numThreads);

export class WhisperAdapter extends EventEmitter {
    /** @type {FfmpegAdapter} */
    ffmpeg = null;
    transcriber = null;
    /** @type {string} */
    language = null;
    /** @type {string} */
    modelName = null;
    modelProgress = {};
    /** @type {number} */
    maxProgress = 0;

    constructor(audioData, language, modelName) {
        super();
        this.ffmpeg = new FfmpegAdapter(audioData, 60);
        this.ffmpeg.on("time", (t) => this.emit("time", t));
        this.language = language;
        this.modelName = modelName;
    }

    async initWhisper(callback = () => {}) {
        if (this.transcriber) { return; }

        await callback(0); // 0-10% is loading ffmpeg
        await this.ffmpeg.initFfmpeg();
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

    async startWhisper(callback = () => {}) {
        await this.initWhisper();

        await this.ffmpeg.startFfmpeg(async (float32Data, currentTime) => {
            const result = await this.transcriber(float32Data, {
                language: this.language === 'auto' ? null : this.language,
                chunk_length_s: 30, // Internal stride logic
                stride_length_s: 5,
                return_timestamps: true,
                force_full_sequences: false
            });

            // Send data back to the callback
            if (!result?.chunks) { return; }

            for (let chunk of result.chunks) {
                const start = currentTime + chunk.timestamp[0];
                const end = currentTime + (chunk.timestamp[1] || chunk.timestamp[0] + 1);
                const totalSeconds = this.getTotalSeconds();
                const percent = (end / totalSeconds * 100);
                const format = (t) => FfmpegAdapter.formatTime(t);

                await callback({
                    text: chunk.text, start: start, end: end, totalSeconds: totalSeconds, percent: percent,
                    startFormatted: format(start), endFormatted: format(end), totalSecondsFormatted: format(totalSeconds)
                })
            }
        });
    }

    getTotalSeconds() {
        return this.ffmpeg.getTotalSeconds();
    }

    static formatTime(t) {
        return FfmpegAdapter.formatTime(t);
    }
}