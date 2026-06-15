import { FfmpegAdapter } from './transcription.ffmpeg.js';
import { EventEmitter } from './transcription.emitter.js';

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
    currentTime = 0;
    /** @type {Float32Array} */
    accumulatedAudio = [];

    constructor(audioData, chunkDurationSeconds = 60, hardCutSeconds = 60, minSilenceSeconds = 5) {
        super();
        this.ffmpeg = new FfmpegAdapter(audioData, chunkDurationSeconds);
        this.ffmpeg.on("time", (t) => this.emit("time", t));
        this.hardCutSeconds = hardCutSeconds;
        this.minSilenceSeconds = minSilenceSeconds;
    }

    getTotalSeconds() {
        return this.ffmpeg.getTotalSeconds();
    }

    async initVad() {
        if (this.initalized) { return; } else { this.initalized = true; }
        await this.ffmpeg.initFfmpeg();
    }

    async startVad(callback = () => {}) {
        await this.initVad();

        // Feed FFmpeg chunks into the VAD processor
        await this.ffmpeg.startFfmpeg(async (float32Data, _) => await this.processChunk(float32Data, callback));

        // When FFmpeg finishes, flush whatever audio is left in the buffer to the transcriber
        if (this.accumulatedAudio.length > 0) {
            await callback(this.accumulatedAudio, this.currentTime);
            this.currentTime += this.accumulatedAudio.length / 16000;
            this.accumulatedAudio = new Float32Array(0);
        }
    }

    async processChunk(float32Data, callback = () => {}) {
        // Callback is callback(buffer as float32Data, current time as seconds (beggining of the chunk seocnds not the end))
        // TODO: Implement VAD & silence splitting

        await callback(float32Data, this.currentTime);
        this.currentTime += this.ffmpeg.getChunkDurationSeconds();
    }

    static formatTime(t) {
        return FfmpegAdapter.formatTime(t);
    }
}