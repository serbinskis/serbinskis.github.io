import { FfmpegAdapter } from './extraction.ffmpeg.js';

self.onmessage = async (e) => {
    let { mediaData, startTime, endTime } = e.data;
    console.log(`Worker -> start: ${startTime}s, end: ${endTime}s`);

    try {
        const extractor = new FfmpegAdapter(mediaData);

        self.postMessage({ type: 'bar', msg: 'Loading FFmpeg Engine...', progress: 0 });
        await extractor.initFfmpeg();

        self.postMessage({ type: 'bar', msg: 'Extracting audio stream...', progress: 0 });

        const audioBytes = await extractor.extractAudio(startTime, endTime, (percent) => {
            self.postMessage({ type: 'bar', msg: `Extracting: ${percent.toFixed(1)}%`, progress: percent });
        });

        self.postMessage({ type: 'done', buffer: audioBytes });
    } catch (err) {
        console.error("Worker Error:", err);
        self.postMessage({ type: 'error', msg: err.message });
    }
};