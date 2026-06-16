import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.0';
import { FfmpegAdapter } from './transcription.ffmpeg.js';
import { WhisperAdapter } from './transcription.whisper.js';
env.allowLocalModels = false;

const FFMPEG_CHUNK_DURATION = 60;
const VAD_HARD_CUT_DURATION = 60;
const VAD_MIN_SILENCE_DURATION = 30;
const REMOVE_BLANK_SEGMENTS = true;

self.onmessage = async (e) => {
    let { audioData, modelName, language, silenceThreshold, hardCutSeconds } = e.data;
    console.log(`Worker -> audioData: ${audioData}, language: ${language}, modelName: ${modelName}, silenceThreshold: ${silenceThreshold}, ${hardCutSeconds}`);

    try {
        const whisper = new WhisperAdapter(audioData, language, modelName, FFMPEG_CHUNK_DURATION, hardCutSeconds, VAD_MIN_SILENCE_DURATION, silenceThreshold);
        await whisper.initWhisper((p) => self.postMessage({ type: 'bar', msg: 'Loading Whisper model...', progress: p, }));
        whisper.on("time", t => self.postMessage({ type: 'bar', msg: `Transcribing: ${WhisperAdapter.formatTime(0)} / ${WhisperAdapter.formatTime(t)}`, progress: 0 }))

        await whisper.startWhisper((segment) => {
            self.postMessage({ type: 'bar', msg: `Transcribing: ${segment.endFormatted} / ${segment.totalSecondsFormatted}`, progress: segment.percent });
            if (REMOVE_BLANK_SEGMENTS && segment.text == "[BLANK_AUDIO]") { return; }
            self.postMessage({ type: 'partial', data: { start: segment.start, end: segment.end, text: segment.text } });
        })

        self.postMessage({ type: 'done' });
    } catch (err) {
        console.error("Worker Error:", err);
        self.postMessage({ type: 'error', msg: err.message });
    }
};