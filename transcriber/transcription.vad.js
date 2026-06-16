import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.0/dist/ort.mjs';
import { FfmpegAdapter } from './transcription.ffmpeg.js';
import { EventEmitter } from './transcription.emitter.js';

// Configure WASM paths for Worker context
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.0/dist/';
ort.env.wasm.numThreads = 1;

export class VADAdapter extends EventEmitter {
    /** @type {FfmpegAdapter} */
    ffmpeg = null;
    /** @type {boolean} */
    initalized = false;
    /** @type {number} */
    hardCutSeconds = 60;
    /** @type {number} */
    minSilenceSeconds = 5;
    /** @type {number} */
    silenceThreshold = 0.3
    /** @type {number} */
    currentTime = 0;

    // VAD Adapter variables
    accumulatedAudio = new Float32Array(0);
    processedSamples = 0;
    probHistory = [];
    session = null;
    state = null; 
    sr = null;

    constructor(audioData, chunkDurationSeconds = 30, hardCutSeconds = 60, minSilenceSeconds = 5, silenceThreshold = 0.3) {
        super();
        this.ffmpeg = new FfmpegAdapter(audioData, chunkDurationSeconds);
        this.ffmpeg.on("time", (t) => this.emit("time", t));
        this.hardCutSeconds = hardCutSeconds;
        this.minSilenceSeconds = minSilenceSeconds;
        this.silenceThreshold = silenceThreshold;
    }

    /** Helper for UI and Worker to format time strings */
    static formatTime(seconds) {
        return FfmpegAdapter.formatTime(seconds);
    }

    getTotalSeconds() {
        return this.ffmpeg.getTotalSeconds();
    }

    async initVad() {
        if (this.initalized) { return; } else { this.initalized = true; }
        await this.ffmpeg.initFfmpeg();

        // Silero v5: [2, 1, 128] based on your model's expected dimension
        this.state = new ort.Tensor('float32', new Float32Array(2 * 1 * 128), [2, 1, 128]);
        this.sr = new ort.Tensor('int64', new BigInt64Array([BigInt(16000)]), [1]);

        // Official Silero v5 ONNX path
        const modelUrl = 'https://cdn.jsdelivr.net/gh/snakers4/silero-vad@master/src/silero_vad/data/silero_vad.onnx';
        this.session = await ort.InferenceSession.create(modelUrl);
    }

    async startVad(callback = async () => {}) {
        await this.initVad();

        // Run FFmpeg and feed into processChunk
        await this.ffmpeg.startFfmpeg(async (float32Data, _) => await this.processChunk(float32Data, callback));

        // Flush remaining audio at end of file
        if (this.accumulatedAudio.length > 0) {
            await callback(this.accumulatedAudio, this.currentTime);
            this.currentTime += this.accumulatedAudio.length / 16000;
            this.accumulatedAudio = new Float32Array(0);
        }
    }

    async processChunk(float32Data, callback = async () => {}) {
        // Accumulate new PCM data
        const newBuffer = new Float32Array(this.accumulatedAudio.length + float32Data.length);
        newBuffer.set(this.accumulatedAudio);
        newBuffer.set(float32Data, this.accumulatedAudio.length);
        this.accumulatedAudio = newBuffer;

        const frameSize = 512;
        const sampleRate = 16000;
        const framesForSilence = Math.floor(this.minSilenceSeconds * sampleRate / frameSize);
        const framesForHardCut = Math.floor(this.hardCutSeconds * sampleRate / frameSize);
        const silenceThreshold = this.silenceThreshold;

        // Sliding window over audio buffer
        while (this.processedSamples + frameSize <= this.accumulatedAudio.length) {
            const frame = this.accumulatedAudio.slice(this.processedSamples, this.processedSamples + frameSize);
            const input = new ort.Tensor('float32', frame, [1, frameSize]);
            const out = await this.session.run({ input: input, sr: this.sr, state: this.state }); // Run neural inference

            // Silero v5 usually names this 'stateN', but some exports vary.
            this.state = out.stateN;
            this.probHistory.push(out.output.data[0]);
            this.processedSamples += frameSize;
            let splitFrame = -1;

            // Logic A: Hard cut reached
            if (this.probHistory.length >= framesForHardCut) {
                splitFrame = this.probHistory.length;
            }

            // Logic B: 5 seconds of silence detected
            if ((splitFrame <= 0) && (this.probHistory.length >= framesForSilence)) {
                let isSilent = true;
                for (let i = this.probHistory.length - framesForSilence; i < this.probHistory.length; i++) {
                    if (this.probHistory[i] >= silenceThreshold) {
                        isSilent = false;
                        break;
                    }
                }
                if (isSilent) {
                    // Split at the exact midpoint of the silence
                    splitFrame = this.probHistory.length - Math.floor(framesForSilence / 2);
                }
            }

            // Perform the slice and call the transcriber
            if (splitFrame !== -1) {
                const splitSample = splitFrame * frameSize;
                const chunkToSend = this.accumulatedAudio.slice(0, splitSample);
                const chunkStartTime = this.currentTime;
                this.currentTime += chunkToSend.length / sampleRate;
                this.accumulatedAudio = this.accumulatedAudio.slice(splitSample);
                this.probHistory = this.probHistory.slice(splitFrame);
                this.processedSamples = this.processedSamples - splitSample; 
                await callback(chunkToSend, chunkStartTime);
            }
        }
    }
}