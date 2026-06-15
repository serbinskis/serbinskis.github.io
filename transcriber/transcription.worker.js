import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.0';
import { FfmpegAdapter } from './transcription.ffmpeg.js';
env.allowLocalModels = false;

// Helper to format timestamps for UI status
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

self.onmessage = async (e) => {
    let { audioData, modelName, language } = e.data;
    console.log(`Worker -> audioData: ${audioData}, language: ${language}, modelName: ${modelName}`);

    try {
        self.postMessage({ type: 'bar', msg: 'Loading FFmpeg engine...', progress: 0, });
        const ffmpeg = new FfmpegAdapter(audioData, 300);
        await ffmpeg.initFfmpeg();

        self.postMessage({ type: 'bar', msg: 'Loading Whisper model...', progress: 0, });
        const transcriber = await pipeline('automatic-speech-recognition', modelName, {
            device: 'webgpu',
            dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
            progress_callback: (p) => self.postMessage({ type: 'progress', data: p })
        });

        await ffmpeg.startFfmpeg(async (float32Data) => {
            // Transcribe the 5-minute block
            const result = await transcriber(float32Data, {
                language: language === 'auto' ? null : language,
                chunk_length_s: 30, // Internal stride logic
                stride_length_s: 5,
                return_timestamps: true,
                force_full_sequences: false
            });

            // Send data back to the UI
            if (!result?.chunks) { return; }

            for (let chunk of result.chunks) {
                self.postMessage({
                    type: 'partial',
                    data: {
                        start: chunk.timestamp[0] + currentTime,
                        end: (chunk.timestamp[1] || chunk.timestamp[0] + 1) + currentTime,
                        text: chunk.text
                    }
                });

                self.postMessage({ 
                    type: 'bar', 
                    msg: `Transcribing: ${formatTime(absoluteEnd)} / ${formatTime(totalSeconds)}`, 
                    progress: percent 
                });
            }
        });

        self.postMessage({ type: 'done' });
    } catch (err) {
        console.error("Worker Error:", err);
        self.postMessage({ type: 'error', msg: err.message });
    }
};