import { FFmpeg } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
import { toBlobURL } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js';
import { EventEmitter } from './extraction.emitter.js';

export class FfmpegAdapter extends EventEmitter {
    static FFMPEG_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm';
    static CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
    ffmpeg = new FFmpeg();

    /** @type {File} */
    mediaData = null;

    constructor(mediaData) {
        super();
        this.mediaData = mediaData;
    }

    async initFfmpeg() {
        if (!this.mediaData.name) { this.mediaData = new File([this.mediaData], "input_media.webm"); }

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
     * Extracts audio from the media file.
     * @param {number} start - Start time in seconds.
     * @param {number} end - End time in seconds.
     * @param {Function} progressCallback - Callback for extraction progress (0-100).
     * @returns {Promise<Uint8Array>} Extracted audio as MP3 bytes.
     */
    async extractAudio(start, end, progressCallback = async () => {}) {
        if (!this.ffmpeg.loaded) { await this.initFfmpeg(); }
        await this.ffmpeg.createDir('/mnt');
        await this.ffmpeg.mount('WORKERFS', { files: [this.mediaData] }, '/mnt');

        const inputPath = `/mnt/${this.mediaData.name}`;
        const outName = `output.mp3`;
        const duration = end - start;

        // Listen to FFmpeg's internal chunk processing progress
        this.ffmpeg.on('progress', ({ progress, time }) => {
            // time is in microseconds. Calculate based on the total requested duration.
            const currentSecs = time / 1000000;
            let percent = (currentSecs / duration) * 100;
            // Fallback to internal progress ratio if duration tracking acts up
            if (percent < 0 || isNaN(percent)) { percent = progress * 100; }
            progressCallback(Math.min(Math.max(percent, 0), 100));
        });

        // Fast-seek to start (-ss), set duration (-t), remove video (-vn), output MP3
        await this.ffmpeg.exec([
            '-ss', start.toString(),
            '-t', duration.toString(),
            '-i', inputPath,
            '-vn',              // Drop video stream
            '-acodec', 'libmp3lame', // Encode to MP3
            '-q:a', '1',        // High quality VBR (0: ~245 kbps, 1: ~225 kbps, 2: ~190 kbps)
            outName
        ]);

        const rawData = await this.ffmpeg.readFile(outName);
        await this.ffmpeg.deleteFile(outName);
        await this.ffmpeg.unmount('/mnt');

        // Remove listener to prevent memory leaks in multiple runs
        this.ffmpeg.off('progress');

        return rawData;
    }

    static async getFFmpegWorkerBlob() {
        const res = await fetch(`${FfmpegAdapter.FFMPEG_BASE}/worker.js`);
        let code = await res.text();
        code = code.replace(/from\s+["']\.\/(.*?)["']/g, `from "${FfmpegAdapter.FFMPEG_BASE}/$1"`);
        return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    }
}