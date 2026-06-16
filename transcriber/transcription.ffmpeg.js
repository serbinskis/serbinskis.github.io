import { FFmpeg } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
import { toBlobURL } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js';
import { EventEmitter } from './transcription.emitter.js';

export class FfmpegAdapter extends EventEmitter {
    static FFMPEG_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm';
    static CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
    ffmpeg = new FFmpeg();
    /** @type {File} */
    audioData = null;
    /** @type {boolean} */
    keepProcessing = true;
    /** @type {number} */
    chunkDurationSeconds = 0;
    /** @type {number} */
    totalSeconds = 0;
    /** @type {number} */
    currentTime = 0;

    /**
     * Initializes the FfmpegAdapter with the provided audio data and chunk duration.
     * @param {File} audioData - The audio file to process.
     * @param {number} chunkDurationSeconds - The duration of each audio chunk in seconds.
     */
    constructor(audioData, chunkDurationSeconds = 300) {
        super();
        this.audioData = audioData;
        this.chunkDurationSeconds = chunkDurationSeconds;

        // Listen to FFmpeg logs to extract the total duration of the media file
        this.ffmpeg.on('log', ({ message }) => {
            if (!message.includes('Duration:')) { return; }
            const match = message.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
            if (!match) { return; }
            const h = parseInt(match[1]);
            const m = parseInt(match[2]);
            const s = parseInt(match[3]);
            const totalSeconds = (h * 3600) + (m * 60) + s;
            if (this.totalSeconds != totalSeconds) { this.emit("time", totalSeconds); }
            if (this.totalSeconds != totalSeconds) { console.log("Total file duration (seconds):", totalSeconds); }
            this.totalSeconds = totalSeconds;
        });
    }

    /**
     * Returns the total duration of the audio in seconds.
     * @return {number} The total duration of the audio in seconds.
     */
    getTotalSeconds() {
        return this.totalSeconds;
    }

    /**
     * Returns the duration of each audio chunk in seconds.
     * @return {number} The duration of each audio chunk in seconds.
     */
    getChunkDurationSeconds() {
        return this.chunkDurationSeconds;
    }

    /**
     * Initializes the FFmpeg instance and loads the necessary core files.
     */
    async initFfmpeg() {
        // If audioData is blob convert to file
        if (!this.audioData.name) { this.audioData = new File([this.audioData], "massive_input.media"); }

        // If ffmpeg not loaded yet, load it
        if (!this.ffmpeg.loaded) {
            try {
                await this.ffmpeg.load({
                    coreURL: await toBlobURL(`${FfmpegAdapter.CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
                    wasmURL: await toBlobURL(`${FfmpegAdapter.CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
                    classWorkerURL: await FfmpegAdapter.getFFmpegWorkerBlob()
                });
            } catch (err) {
                console.error(err);
            }
        }
    }

    /**
     * Starts processing the audio file in chunks using FFmpeg.
     * @param {Function} callback - A callback function that receives each processed chunk as a Float32Array and the current time in seconds.
     */
    async startFfmpeg(callback = async () => {}) {
        console.log("FfmpegAdapter.audioData: " + this.audioData);
        if (!this.ffmpeg.loaded) { await this.initFfmpeg(); }

        // Mount the file via WORKERFS (Consumes no RAM because it streams directly from the disk)
        await this.ffmpeg.createDir('/mnt');
        await this.ffmpeg.mount('WORKERFS', { files: [this.audioData] }, '/mnt');
        const inputPath = `/mnt/${this.audioData.name}`;

        while (this.keepProcessing) {
            const outName = `chunk_${this.currentTime}.raw`;

            // Instruct FFmpeg to extract exactly n-amount minutes of audio as raw PCM
            await this.ffmpeg.exec([
                '-ss', this.currentTime.toString(),
                '-t', this.chunkDurationSeconds.toString(),
                '-i', inputPath,
                '-ar', '16000', // 16kHz
                '-ac', '1',     // Mono
                '-f', 'f32le',  // Float32 Little Endian
                outName
            ]);

            try {
                // Read the output chunk into memory
                const rawData = await this.ffmpeg.readFile(outName);

                // If the byte length is 0, we've successfully reached the end of the 5GB file
                if (rawData.byteLength === 0) { this.keepProcessing = false; break; }

                // Safely cast the Uint8 raw data into a Float32 array for Whisper
                const float32Data = new Float32Array(rawData.buffer, rawData.byteOffset, rawData.length / 4);

                // Callback with extarcted data
                await callback(float32Data, this.currentTime);

                // Delete the chunk from memory so RAM stays flat
                await this.ffmpeg.deleteFile(outName);
                this.currentTime += this.chunkDurationSeconds;
            } catch (err) {
                // readFile throws an error when FFmpeg generates no output (End of media reached)
                console.error(err);
                this.keepProcessing = false;
            }
        }

        // Cleanup
        await this.ffmpeg.unmount('/mnt');
    }

    // Fetches the FFmpeg worker, rewrites its relative imports to absolute CDN URLs, 
    // and creates a safe local Blob to bypass strict Browser CORS rules.
    static async getFFmpegWorkerBlob() {
        const res = await fetch(`${FfmpegAdapter.FFMPEG_BASE}/worker.js`);
        let code = await res.text();
        code = code.replace(/from\s+["']\.\/(.*?)["']/g, `from "${FfmpegAdapter.FFMPEG_BASE}/$1"`);
        return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    }

    /**
     * Formats a time in seconds into a human-readable string (MM:SS).
     * @param {number} seconds - The time in seconds to format.
     * @returns {string} - The formatted time string.
     */
    static formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
}