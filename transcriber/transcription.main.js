window.els = {
    themeToggle: document.getElementById('theme-toggle'),
    lightIcon: document.getElementById('theme-icon-light'),
    darkIcon: document.getElementById('theme-icon-dark'),

    controlsCard: document.getElementById('controls-card'),
    modelSelect: document.getElementById('model-select'),
    languageSelect: document.getElementById('language-select'),

    silenceSlider: document.getElementById('silence-slider'),
    silenceInput: document.getElementById('silence-input'),
    chunkSlider: document.getElementById('chunk-slider'),
    chunkInput: document.getElementById('chunk-input'),

    btnLink: document.getElementById('btn-link'),
    btnFile: document.getElementById('btn-file'),
    fileInput: document.getElementById('file-input'),
    btnRecord: document.getElementById('btn-record'),

    progressContainer: document.getElementById('progress-container'),
    progressBar: document.getElementById('progress-bar'),
    progressText: document.getElementById('progress-text'),
    progressPercent: document.getElementById('progress-percent'),

    customAudioContainer: document.getElementById('custom-audio-container'),
    hiddenAudioPlayer: document.getElementById('hidden-audio-player'),
    btnPlayPause: document.getElementById('btn-play-pause'),
    iconPlay: document.getElementById('icon-play'),
    iconPause: document.getElementById('icon-pause'),
    audioTimeCurrent: document.getElementById('audio-time-current'),
    audioTimeTotal: document.getElementById('audio-time-total'),
    audioSeek: document.getElementById('audio-seek'),

    btnTranscribe: document.getElementById('btn-transcribe'),
    toggleTimestamps: document.getElementById('toggle-timestamps'),
    transcriptBox: document.getElementById('transcript-box'),

    linkModal: document.getElementById('link-modal'),
    linkModalContent: document.getElementById('link-modal-content'),
    linkInput: document.getElementById('link-input'),
    btnCancelLink: document.getElementById('btn-cancel-link'),
    btnSubmitLink: document.getElementById('btn-submit-link'),

    btnExportJson: document.getElementById('btn-export-json'),
    btnExportTxt: document.getElementById('btn-export-txt'),
    btnExportSrt: document.getElementById('btn-export-srt')
};

/* --- GLOBAL EXPOSED VARIABLES --- */
window.currentAudioFile = null; 
window.transcriptData = [];     
window.mediaRecorder = null;
window.audioChunks = [];
window.activeDownload = false;
window.downloadAbortController = null;
window.transcriberWorker = null;
window.isProcessing = false;
window.vadSilenceThresholdDefault = 30;
window.vadHardCutSecondsDefault = 60;

window.availableModels = [
    { id: 'onnx-community/whisper-tiny', name: 'Whisper Tiny', size: '~75MB' },
    { id: 'onnx-community/whisper-base', name: 'Whisper Base', size: '~145MB' },
    { id: 'onnx-community/whisper-small', name: 'Whisper Small', size: '~480MB' },
    { id: 'onnx-community/whisper-medium-ONNX', name: 'Whisper Medium', size: '~1.5GB' },
];

window.supportedLanguages = [
    /*{ code: 'auto', name: 'Auto-detect' },*/ // NOT WORKING
    { code: 'en', name: 'English' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hy', name: 'Armenian' },
    { code: 'az', name: 'Azerbaijani' },
    { code: 'be', name: 'Belarusian' },
    { code: 'bn', name: 'Bengali' },
    { code: 'bg', name: 'Bulgarian' },
    { code: 'ca', name: 'Catalan' },
    { code: 'zh', name: 'Chinese' },
    { code: 'hr', name: 'Croatian' },
    { code: 'cs', name: 'Czech' },
    { code: 'da', name: 'Danish' },
    { code: 'nl', name: 'Dutch' },
    { code: 'et', name: 'Estonian' },
    { code: 'fi', name: 'Finnish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'el', name: 'Greek' },
    { code: 'he', name: 'Hebrew' },
    { code: 'hi', name: 'Hindi' },
    { code: 'hu', name: 'Hungarian' },
    { code: 'id', name: 'Indonesian' },
    { code: 'it', name: 'Italian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'kn', name: 'Kannada' },
    { code: 'ko', name: 'Korean' },
    { code: 'lv', name: 'Latvian' },
    { code: 'lt', name: 'Lithuanian' },
    { code: 'ms', name: 'Malay' },
    { code: 'mr', name: 'Marathi' },
    { code: 'no', name: 'Norwegian' },
    { code: 'fa', name: 'Persian' },
    { code: 'pl', name: 'Polish' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ro', name: 'Romanian' },
    { code: 'ru', name: 'Russian' },
    { code: 'sr', name: 'Serbian' },
    { code: 'sk', name: 'Slovak' },
    { code: 'sl', name: 'Slovenian' },
    { code: 'es', name: 'Spanish' },
    { code: 'sv', name: 'Swedish' },
    { code: 'tl', name: 'Tagalog' },
    { code: 'ta', name: 'Tamil' },
    { code: 'te', name: 'Telugu' },
    { code: 'th', name: 'Thai' },
    { code: 'tr', name: 'Turkish' },
    { code: 'uk', name: 'Ukrainian' },
    { code: 'ur', name: 'Urdu' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'cy', name: 'Welsh' }
];

/**
 * Displays a toast notification with the given message and type.
 * @param {string} msg - The message to display.
 * @param {string} [type='error'] - The type of notification ('error' or 'success').
 */
window.showNotification = (msg, type = 'error') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const isError = type === 'error';
    toast.className = `toast px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex justify-between items-center ${isError ? 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/50 dark:text-red-200 dark:border-red-800' : 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/50 dark:text-green-200 dark:border-green-800'}`;
    toast.innerHTML = `<span>${msg}</span><button class="ml-4 opacity-70 hover:opacity-100 text-lg leading-none">&times;</button>`;
    toast.querySelector('button').onclick = () => toast.remove();
    container.appendChild(toast);
    setTimeout(() => { if(toast.parentElement) { toast.remove(); } }, 4000);
};

/**
 * Locks or unlocks the UI elements based on the provided boolean value.
 * @param {boolean} locked - If true, locks the UI; if false, unlocks it.
 */
window.setUILocked = (locked) => {
    window.els.modelSelect.disabled = locked;
    window.els.languageSelect.disabled = locked;
    window.els.silenceSlider.disabled = locked;
    window.els.silenceInput.disabled = locked;
    window.els.chunkSlider.disabled = locked;
    window.els.chunkInput.disabled = locked;
    window.els.btnLink.disabled = locked && !window.activeDownload;
    window.els.btnFile.disabled = locked;
    window.els.btnRecord.disabled = locked;
    window.els.btnTranscribe.disabled = locked ? true : !window.currentAudioFile; 
    window.els.btnExportJson.disabled = locked;
    window.els.btnExportTxt.disabled = locked;
    window.els.btnExportSrt.disabled = locked;
    window.els.toggleTimestamps.disabled = locked;
    if (locked) { window.els.controlsCard.classList.add('opacity-80'); }
    else { window.els.controlsCard.classList.remove('opacity-80'); }    
};

/**
 * Downloads an audio file from the provided URL, with progress tracking and cancellation support.
 * @param {string} url - The URL of the audio file to download.
 */
window.downloadAudioFromUrl = async (url) => {
    if (window.activeDownload) { return; }
    window.activeDownload = true;
    window.setUILocked(true);
    window.els.btnLink.innerHTML = '❌ Cancel';
    window.els.btnLink.classList.add('bg-red-50', 'text-red-600', 'border-red-200', 'dark:bg-red-900/30');
    window.els.progressContainer.classList.remove('hidden');
    window.downloadAbortController = new AbortController();

    try {
        const response = await fetch(url, { signal: window.downloadAbortController.signal });
        if (!response.ok) { throw new Error(`HTTP Error: ${response.status}`); }
        
        const contentLength = response.headers.get('content-length');
        const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
        const MAX_BYTES = 200 * 1024 * 1024; // 200 MB limit
        if (totalBytes > MAX_BYTES) { throw new Error("File exceeds 200MB limit."); }

        let loadedBytes = 0;
        const reader = response.body.getReader();
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) { break; }

            chunks.push(value);
            loadedBytes += value.byteLength;
            if (loadedBytes > MAX_BYTES) { throw new Error("File exceeds 200MB limit."); }

            const loadedMB = (loadedBytes / (1024 * 1024)).toFixed(1);
            if (totalBytes) {
                const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
                const percent = (loadedBytes / totalBytes) * 100;
                window.setProgress(percent, `Downloading audio... ${loadedMB} MB / ${totalMB} MB`);
            } else {
                window.setProgress(100, `Downloading audio... ${loadedMB} MB downloaded`);
            }
        }

        const downloadedBlob = new Blob(chunks);
        window.currentAudioFile = downloadedBlob;
        setupAudioPlayer(URL.createObjectURL(downloadedBlob));

        window.setProgress(100, `Download Complete!`);
        window.showNotification(`Audio downloaded successfully!`, 'success');
    } catch (error) {
        if (error.name === 'AbortError') {
            window.showNotification('Audio download cancelled.', 'error');
        } else {
            window.showNotification(`Failed to download audio: ${error.message}`, 'error');
        }
        window.setProgress(0, 'Ready');
    } finally {
        setTimeout(() => {
            window.activeDownload = false;
            window.downloadAbortController = null;
            window.els.btnLink.innerHTML = '🔗 Link';
            window.els.btnLink.classList.remove('bg-red-50', 'text-red-600', 'border-red-200', 'dark:bg-red-900/30');
            window.els.progressContainer.classList.add('hidden');
            window.setUILocked(false);
        }, 250);
    }
};

/**
 * Loads the available languages into the language selection dropdown.
 * @param {Array} languagesArray - An array of language objects.
 */
window.loadLanguages = (languagesArray) => {
    window.els.languageSelect.innerHTML = '';

    languagesArray.forEach(lang => {
        const opt = document.createElement('option');
        opt.value = lang.code;
        opt.textContent = lang.name;
        window.els.languageSelect.appendChild(opt);
    });

    const savedLang = localStorage.getItem('whisper_lang');
    if (savedLang && languagesArray.some(l => l.code === savedLang)) {
        window.els.languageSelect.value = savedLang;
    } else if (languagesArray.length > 0) {
        window.els.languageSelect.value = languagesArray[0].code;
    }
};

/**
 * Loads the available models into the model selection dropdown.
 * @param {Array} modelsArray - An array of model objects.
 */
window.loadModels = (modelsArray) => {
    window.els.modelSelect.innerHTML = '';

    modelsArray.forEach(model => {
        const opt = document.createElement('option');
        opt.value = model.id;
        opt.textContent = `${model.name} (${model.size})`;
        window.els.modelSelect.appendChild(opt);
    });

    // Restore saved preference if it exists
    const savedModel = localStorage.getItem('whisper_model');
    if (savedModel && modelsArray.some(m => m.id === savedModel)) {
        window.els.modelSelect.value = savedModel;
    }
};

window.setTranscribeState = (isEnabled) => {
    window.els.btnTranscribe.disabled = !isEnabled;
};

window.setProgress = (percent, text = '') => {
    window.els.progressContainer.classList.remove('hidden');
    let clamped = Math.max(0, Math.min(100, percent));
    window.els.progressBar.style.width = clamped + '%';
    window.els.progressPercent.innerText = Math.round(clamped) + '%';
    if (text) { window.els.progressText.innerText = text; }
};

window.clearTranscripts = () => {
    window.els.transcriptBox.innerHTML = '';
    window.transcriptData = [];
};

window.addTranscript = (startTime, endTime, text) => {
    const box = window.els.transcriptBox;
    const isScrolledToBottom = box.scrollHeight - box.clientHeight <= box.scrollTop + 15;

    window.transcriptData.push({ start: startTime, end: endTime, text: text });
    const line = document.createElement('div');
    line.className = 'transcript-line flex gap-2 py-1 px-2 rounded items-start';

    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'timestamp-block text-blue-500 dark:text-blue-400 flex-shrink-0 select-none mt-0.5';
    timestampSpan.innerHTML = `[<span class="timestamp-btn" data-time="${startTime}">${window.formatTime(startTime)}</span> - <span class="timestamp-btn" data-time="${endTime}">${window.formatTime(endTime)}</span>]`;

    const textContainerSpan = document.createElement('span');
    textContainerSpan.className = 'text-gray-800 dark:text-gray-200 break-words flex-grow leading-relaxed';

    const words = text.split(' ');
    words.forEach((word, index) => {
        const wSpan = document.createElement('span');
        wSpan.textContent = word + ' ';
        wSpan.className = 'word-anim';
        wSpan.style.animationDelay = `${index * 0.04}s`; 
        textContainerSpan.appendChild(wSpan);
    });

    line.appendChild(timestampSpan);
    line.appendChild(textContainerSpan);
    box.appendChild(line);

    line.querySelectorAll('.timestamp-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const time = parseFloat(e.target.getAttribute('data-time'));
            if (isNaN(time)) { return; }
            window.els.hiddenAudioPlayer.currentTime = time;
            window.els.hiddenAudioPlayer.play().catch(() => {});
        });
    });

    if (isScrolledToBottom) {
        setTimeout(() => box.scrollTop = box.scrollHeight, 10);
    }
};

window.exportTranscripts = (format) => {
    if (window.transcriptData.length === 0) { return window.showNotification('No transcription data to export.', 'error'); }
    let content = '', mimeType = 'text/plain';
    let filename = `transcript_${Date.now()}.${format}`;

    if (format === 'json') {
        content = JSON.stringify(window.transcriptData, null, 2);
        mimeType = 'application/json';
    } else if (format === 'txt') {
        content = window.transcriptData.map(item => 
            `[${window.formatTime(item.start)} - ${window.formatTime(item.end)}] ${item.text}`
        ).join('\n');
    } else if (format === 'srt') {
        content = window.transcriptData.map((item, index) => {
            return `${index + 1}\n${window.formatSrtTime(item.start)} --> ${window.formatSrtTime(item.end)}\n${item.text}\n`;
        }).join('\n');
    }

    const blob = new Blob([content], { type: mimeType });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.showNotification(`Successfully exported as ${format.toUpperCase()}`, 'success');
};

window.els.btnExportJson.addEventListener('click', () => window.exportTranscripts('json'));
window.els.btnExportTxt.addEventListener('click', () => window.exportTranscripts('txt'));
window.els.btnExportSrt.addEventListener('click', () => window.exportTranscripts('srt'));

/**
 * Synchronizes a range slider and a number input field.
 * @param {HTMLElement} slider - The range input element.
 * @param {HTMLElement} input - The number input element.
 * @param {number} min - Minimum value for the inputs.
 * @param {number} max - Maximum value for the inputs.
 * @param {string} storageKey - The key for storing the value in localStorage.
 */
window.syncSliderAndInput = (slider, input, min, max, storageKey) => {
    slider.addEventListener('input', (e) => input.value = e.target.value);
    slider.addEventListener('input', (e) => localStorage.setItem(storageKey, e.target.value));
    input.addEventListener('input', (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val)) return;
        if (val < min) { val = min; }
        if (val > max) { val = max; }
        input.value = slider.value = val;
        localStorage.setItem(storageKey, val);
    });
};

window.els.silenceInput.value = localStorage.getItem('vad_silence_threshold') || window.vadSilenceThresholdDefault;
window.els.silenceSlider.value = localStorage.getItem('vad_silence_threshold') || window.vadSilenceThresholdDefault;
window.els.chunkSlider.value = localStorage.getItem('vad_hard_cut') || window.vadHardCutSecondsDefault;
window.els.chunkInput.value = localStorage.getItem('vad_hard_cut') || window.vadHardCutSecondsDefault;

// Initialize sliders and inputs with saved values or defaults, and set up synchronization between them
window.syncSliderAndInput(window.els.silenceSlider, window.els.silenceInput, 0, 100, 'vad_silence_threshold');
window.syncSliderAndInput(window.els.chunkSlider, window.els.chunkInput, 1, 300, 'vad_hard_cut');

/* --- INITIALIZATION --- */
window.loadLanguages(window.supportedLanguages);
window.loadModels(window.availableModels);
if (localStorage.getItem('whisper_model')) { window.els.modelSelect.value = localStorage.getItem('whisper_model'); }
window.els.modelSelect.addEventListener('change', (e) => localStorage.setItem('whisper_model', e.target.value));
window.els.languageSelect.addEventListener('change', (e) => localStorage.setItem('whisper_lang', e.target.value));

/* --- THEME TOGGLE --- */
function applyTheme(isDark) {
    document.documentElement.classList.toggle('dark', isDark);
    window.els.lightIcon.classList.toggle('hidden', isDark);
    window.els.darkIcon.classList.toggle('hidden', !isDark);
    localStorage.theme = isDark ? 'dark' : 'light';
}
applyTheme(localStorage.theme === 'dark');
window.els.themeToggle.addEventListener('click', () => applyTheme(localStorage.theme !== 'dark'));

/* --- AUDIO PLAYER LOGIC --- */
let isDraggingAudio = false;

function setupAudioPlayer(src) {
    if (src) { window.els.hiddenAudioPlayer.src = src; }
    window.els.customAudioContainer.classList.remove('hidden');
    window.setTranscribeState(true);
    window.els.iconPlay.classList.remove('hidden');
    window.els.iconPause.classList.add('hidden');
    window.els.audioSeek.value = 0;
    window.els.audioTimeCurrent.innerText = "00:00";
}

window.els.btnPlayPause.addEventListener('click', () => {
    if (window.els.hiddenAudioPlayer.paused) {
        window.els.hiddenAudioPlayer.play();
    } else {
        window.els.hiddenAudioPlayer.pause();
    }
});

window.els.hiddenAudioPlayer.addEventListener('play', () => {
    window.els.iconPlay.classList.add('hidden');
    window.els.iconPause.classList.remove('hidden');
});

window.els.hiddenAudioPlayer.addEventListener('pause', () => {
    window.els.iconPlay.classList.remove('hidden');
    window.els.iconPause.classList.add('hidden');
});

window.els.hiddenAudioPlayer.addEventListener('loadedmetadata', () => {
    const duration = window.els.hiddenAudioPlayer.duration;
    window.els.audioSeek.max = Math.floor(duration);
    window.els.audioTimeTotal.innerText = isNaN(duration) ? "00:00" : window.formatTime(duration);
});

window.els.hiddenAudioPlayer.addEventListener('timeupdate', () => {
    if (isDraggingAudio) { return; }
    const currentTime = window.els.hiddenAudioPlayer.currentTime;
    window.els.audioSeek.value = Math.floor(currentTime);
    window.els.audioTimeCurrent.innerText = window.formatTime(currentTime);
});

window.els.audioSeek.addEventListener('input', (e) => {
    isDraggingAudio = true;
    window.els.audioTimeCurrent.innerText = window.formatTime(e.target.value);
});

window.els.audioSeek.addEventListener('change', (e) => {
    window.els.hiddenAudioPlayer.currentTime = e.target.value;
    isDraggingAudio = false;
});

/* --- INPUT METHODS --- */
window.els.btnFile.addEventListener('click', () => window.els.fileInput.click());
window.els.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) { return; }
    window.currentAudioFile = file;
    setupAudioPlayer(URL.createObjectURL(file));
    e.target.value = ''; 
});

window.els.btnLink.addEventListener('click', () => {
    if (window.activeDownload && window.downloadAbortController) { return window.downloadAbortController.abort(); }
    window.els.linkModal.classList.remove('pointer-events-none', 'opacity-0');
    window.els.linkModalContent.classList.remove('scale-95');
    window.els.linkModalContent.classList.add('scale-100');
});

function closeLinkModal() {
    window.els.linkModal.classList.add('pointer-events-none', 'opacity-0');
    window.els.linkModalContent.classList.remove('scale-100');
    window.els.linkModalContent.classList.add('scale-95');
    window.els.linkInput.value = '';
}

window.els.btnCancelLink.addEventListener('click', closeLinkModal);
window.els.btnSubmitLink.addEventListener('click', () => {
    const url = window.els.linkInput.value.trim();
    if (!url) { return; }
    closeLinkModal();
    window.downloadAudioFromUrl(url); // Trigger the physical download
});

let isRecording = false;
window.els.btnRecord.addEventListener('click', async () => {
    if (isRecording) {
        window.mediaRecorder.stop();
        isRecording = false;
        window.els.btnRecord.classList.remove('bg-red-100', 'text-red-600', 'dark:bg-red-900', 'dark:text-red-400', 'border-red-400', 'animate-pulse');
        return window.els.btnRecord.innerHTML = '🎙️ Record';
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        window.mediaRecorder = new MediaRecorder(stream);
        window.audioChunks = [];

        window.mediaRecorder.ondataavailable = (e) => { 
            if (e.data.size > 0) { window.audioChunks.push(e.data); }
        };

        window.mediaRecorder.onstop = () => {
            const audioBlob = new Blob(window.audioChunks, { type: 'audio/webm' });
            window.currentAudioFile = audioBlob;
            const url = URL.createObjectURL(audioBlob);
            setupAudioPlayer(url);
            stream.getTracks().forEach(track => track.stop());

            // Reference the player
            const player = window.els.hiddenAudioPlayer;

            // The Hack: Seek to a massive number to force the browser to find the end
            player.currentTime = 1e101; 

            // Listen for the moment the player realizes where the end is
            player.ontimeupdate = function() {
                // Once the player finds the end, it will update the duration
                if (player.duration && isFinite(player.duration)) {
                    // Remove this listener immediately so it doesn't loop
                    player.ontimeupdate = null;

                    // Update your UI with the newly found duration
                    window.els.audioSeek.max = Math.floor(player.duration);
                    window.els.audioTimeTotal.innerText = window.formatTime(player.duration);

                    // Reset the player to the beginning for the user
                    player.currentTime = 0;
                }
            };
        };

        window.mediaRecorder.start();
        isRecording = true;
        window.els.btnRecord.classList.add('bg-red-100', 'text-red-600', 'dark:bg-red-900', 'dark:text-red-400', 'border-red-400', 'animate-pulse');
        window.els.btnRecord.innerHTML = '⏹️ Stop Recording';
        window.setTranscribeState(false);
    } catch (err) {
        window.showNotification("Microphone access denied or not supported.", "error");
    }
});

window.els.btnTranscribe.addEventListener('click', () => {
    // If already processing, stop the transcription
    if (window.isProcessing) {
        window.stopTranscription();
        window.isProcessing = false;
        window.setUILocked(false);
        
        // Reset Button to Blue
        window.els.btnTranscribe.innerText = "Transcribe Audio";
        window.els.btnTranscribe.classList.remove('bg-red-600', 'hover:bg-red-700');
        window.els.btnTranscribe.classList.add('bg-blue-600', 'hover:bg-blue-700');
        window.els.btnTranscribe.disabled = false; 
        setTimeout(() => window.els.progressContainer.classList.add('hidden'), 250);
    } else { // Start transcription
        window.isProcessing = true;
        window.setUILocked(true);

        // Change Button to Red "Stop" mode
        window.els.btnTranscribe.disabled = false; // Re-enable so it can be clicked to stop
        window.els.btnTranscribe.innerText = "Stop / Cancel";
        window.els.btnTranscribe.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        window.els.btnTranscribe.classList.add('bg-red-600', 'hover:bg-red-700');
        window.startTranscription();
    }
});

window.els.toggleTimestamps.addEventListener('change', (e) => {
    window.els.transcriptBox.classList.toggle('hide-timestamps', e.target.checked);
});

window.startTranscription = () => {
    // This is our File/Blob handle
    const file = window.currentAudioFile;
    if (!file) { return; }

    // If a worker is already running, kill it first
    if (transcriberWorker) { transcriberWorker.terminate(); }
    window.clearTranscripts();
    window.modelProgress = {}; // Reset progress tracking

    // Create a new instance of your separate file
    window.transcriberWorker = new Worker('transcription.worker.js', { type: 'module' });
    window.maxProgress = 0;

    // Listen for messages
    window.transcriberWorker.onmessage = (e) => {
        const { type, data, msg, progress } = e.data;

        if (type === 'partial') {
            window.addTranscript(data.start, data.end, data.text);
        } else if (type === 'bar') {
            window.setProgress(progress, msg);
        } else if (type === 'error') {
            window.showNotification(msg, "error");
            window.els.btnTranscribe.click(); // Cancel the transcription process
        } else if (type === 'done') {
            window.els.btnTranscribe.click();
        }
    };

    // Send the data to start the logic
    window.transcriberWorker.postMessage({
        audioData: file,
        modelName: window.els.modelSelect.value,
        language: window.els.languageSelect.value,
        silenceThreshold: parseFloat(window.els.silenceSlider.value) / 100,
        hardCutSeconds: parseInt(window.els.chunkSlider.value)
    });
}

/** Stops the transcription process by terminating the Web Worker. */
window.stopTranscription = () => {
    if (!transcriberWorker) { return; }
    transcriberWorker.terminate(); // This kills the thread instantly
    transcriberWorker = null;
    console.log("Worker terminated.");
}

/**
 * Converts a time in seconds to a formatted string.
 * If the time is 1 hour or more, it returns HH:MM:SS.s format.
 * If the time is less than 1 hour, it returns MM:SS.s format.
 * @param {number} seconds - The time in seconds to format.
 * @returns {string} The formatted time string.
 */
window.formatTime = (seconds) => {
    if (isNaN(seconds)) { return "00:00"; }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = (seconds % 60).toFixed(1);
    const sFormatted = s.padStart(4, '0');
    if (h > 0) { return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sFormatted}`; }
    return `${m.toString().padStart(2, '0')}:${sFormatted}`;
}

/**
 * Converts a time in seconds to SRT timestamp format (HH:MM:SS,mmm).
 * @param {number} seconds - The time in seconds to format.
 * @returns {string} The formatted SRT time string.
 */
window.formatSrtTime = (seconds) => {
    const date = new Date((seconds || 0) * 1000);
    const h = date.getUTCHours().toString().padStart(2, '0');
    const m = date.getUTCMinutes().toString().padStart(2, '0');
    const s = date.getUTCSeconds().toString().padStart(2, '0');
    const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
    return `${h}:${m}:${s},${ms}`;
}