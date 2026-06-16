import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.0';
import { EventEmitter } from './transcription.emitter.js';
import { VADAdapter } from './transcription.vad.js';

env.allowLocalModels = true; // Allow local models for testing purposes
env.useBrowserCache = true; // Enable caching of models in the browser for faster subsequent loads
env.backends.onnx.wasm.numThreads = navigator.hardwareConcurrency || 1 // Requires SharedArrayBuffer support and cross-origin isolation for multi-threading, aka, headers: Cross-Origin-Opener-Policy: same-origin, Cross-Origin-Embedder-Policy: require-corp
console.log("SharedArrayBuffer supported:", typeof SharedArrayBuffer !== 'undefined');
console.log("Cross-Origin Isolated:", self.crossOriginIsolated);
console.log("Cores available:", env.backends.onnx.wasm.numThreads);

export class WhisperAdapter extends EventEmitter {
    /** @type {VADAdapter} */
    vadAdapter = null;
    /** @type {any} */
    transcriber = null;
    /** @type {string} */
    language = null;
    /** @type {string} */
    modelName = null;
    /** @type {Object.<string, number>} */
    modelProgress = {};
    /** @type {number} */
    maxProgress = 0;

    /**
     * Initializes the Whisper adapter with the provided audio data and configuration.
     * @param {File} audioData - The audio file to transcribe.
     * @param {string} language - The language of the audio.
     * @param {string} modelName - The name of the Whisper model to use.
     * @param {number} chunkDurationSeconds - The duration of each audio chunk in seconds.
     * @param {number} hardCutSeconds - The duration of the hard cut for VAD processing in seconds.
     * @param {number} minSilenceSeconds - The minimum silence duration for VAD processing in seconds.
     * @param {number} silenceThreshold - The threshold for detecting silence in the audio.
     */
    constructor(audioData, language, modelName, chunkDurationSeconds = 60, hardCutSeconds = 60, minSilenceSeconds = 5, silenceThreshold = 0.3) {
        super();
        this.vadAdapter = new VADAdapter(audioData, chunkDurationSeconds, hardCutSeconds, minSilenceSeconds, silenceThreshold);
        this.vadAdapter.on("time", (t) => this.emit("time", t));
        this.language = language;
        this.modelName = modelName;
    }

    /**
     * Initializes the Whisper model and sets up progress tracking.
     * @param {function} callback - A callback function to report progress.
     */
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

    /**
     * Starts the Whisper transcription process.
     * @param {function} callback - A callback function to report progress.
     */
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

    /**
     * Returns the total duration of the audio in seconds.
     * @return {number} The total duration of the audio in seconds.
     */
    getTotalSeconds() {
        return this.vadAdapter.getTotalSeconds();
    }

    /**
     * Formats a given time in seconds to a string in the format HH:MM:SS.
     * @param {number} t - The time in seconds to format.
     * @return {string} The formatted time string.
     */
    static formatTime(t) {
        return VADAdapter.formatTime(t);
    }
}