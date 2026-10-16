window.els = {
    themeToggle: document.getElementById('theme-toggle'),
    lightIcon: document.getElementById('theme-icon-light'),
    darkIcon: document.getElementById('theme-icon-dark'),

    controlsCard: document.getElementById('controls-card'),
    btnFile: document.getElementById('btn-file'),
    fileInput: document.getElementById('file-input'),

    mediaPlayer: document.getElementById('media-player'),

    startTimeInput: document.getElementById('start-time'),
    btnSetStart: document.getElementById('btn-set-start'),
    endTimeInput: document.getElementById('end-time'),
    btnSetEnd: document.getElementById('btn-set-end'),

    progressContainer: document.getElementById('progress-container'),
    progressBar: document.getElementById('progress-bar'),
    progressText: document.getElementById('progress-text'),
    progressPercent: document.getElementById('progress-percent'),

    btnExtract: document.getElementById('btn-extract'),

    outputContainer: document.getElementById('output-container'),
    outputPlayer: document.getElementById('output-player'),
    btnDownload: document.getElementById('btn-download')
};

window.currentMediaFile = null;
window.mediaDuration = 0;
window.extractionWorker = null;
window.isProcessing = false;
window.outputBlobUrl = null;

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

window.setUILocked = (locked) => {
    window.els.btnFile.disabled = locked;
    window.els.startTimeInput.disabled = locked;
    window.els.endTimeInput.disabled = locked;
    window.els.btnSetStart.disabled = locked;
    window.els.btnSetEnd.disabled = locked;
    if (locked) { window.els.controlsCard.classList.add('opacity-80'); }
    else { window.els.controlsCard.classList.remove('opacity-80'); }    
};

window.setProgress = (percent, text = '') => {
    window.els.progressContainer.classList.remove('hidden');
    let clamped = Math.max(0, Math.min(100, percent));
    window.els.progressBar.style.width = clamped + '%';
    window.els.progressPercent.innerText = Math.round(clamped) + '%';
    if (text) { window.els.progressText.innerText = text; }
};

// Formats seconds into HH:MM:SS.ms
window.formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) { return "00:00:00.000"; }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

// Parses HH:MM:SS.ms, MM:SS, or raw seconds back into a float
window.parseTime = (timeStr) => {
    const parts = timeStr.toString().trim().split(':');
    let seconds = 0;
    if (parts.length === 3) { seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]); }
    else if (parts.length === 2) { seconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]); }
    else { seconds = parseFloat(parts[0]); }
    return isNaN(seconds) ? 0 : seconds;
};

// Prevent typing anything other than numbers, colons, and dots
const restrictTimeTyping = (e) => {
    // Allow control keys (backspace, arrows, tab, enter) and copy/paste shortcuts
    if (['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Enter'].includes(e.key) || e.ctrlKey || e.metaKey) return;
    
    // Block any key that isn't a number, colon, or period
    if (!/^[0-9:\.]$/.test(e.key)) { e.preventDefault(); }
};

// Clean up just in case someone pastes invalid characters via mouse
const cleanTimeInput = (e) => {
    e.target.value = e.target.value.replace(/[^0-9:\.]/g, '');
};

// Attach the strict typing rules
window.els.startTimeInput.addEventListener('keydown', restrictTimeTyping);
window.els.endTimeInput.addEventListener('keydown', restrictTimeTyping);
window.els.startTimeInput.addEventListener('input', cleanTimeInput);
window.els.endTimeInput.addEventListener('input', cleanTimeInput);

window.applyTheme = (isDark) => {
    document.documentElement.classList.toggle('dark', isDark);
    window.els.lightIcon.classList.toggle('hidden', isDark);
    window.els.darkIcon.classList.toggle('hidden', !isDark);
    localStorage.theme = isDark ? 'dark' : 'light';
}
window.applyTheme(localStorage.theme === 'dark');
window.els.themeToggle.addEventListener('click', () => window.applyTheme(localStorage.theme !== 'dark'));

// File Input Handling
window.els.btnFile.addEventListener('click', () => window.els.fileInput.click());
window.els.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) { return; }

    window.currentMediaFile = file;
    const objectUrl = URL.createObjectURL(file);

    window.els.mediaPlayer.src = objectUrl;
    window.els.mediaPlayer.classList.remove('hidden');
    window.els.btnExtract.disabled = false;
    e.target.value = ''; 
});

window.els.mediaPlayer.addEventListener('loadedmetadata', () => {
    window.mediaDuration = window.els.mediaPlayer.duration;
    window.els.startTimeInput.value = window.formatTime(0);
    window.els.endTimeInput.value = window.formatTime(window.mediaDuration);
});

// Timestamp Validation & UI Logic
const validateTimestamps = () => {
    let start = window.parseTime(window.els.startTimeInput.value);
    let end = window.parseTime(window.els.endTimeInput.value);

    if (start < 0) { start = 0; }
    if (end > window.mediaDuration) { end = window.mediaDuration; }
    if (start >= end) { start = Math.max(0, end - 0.1); }

    window.els.startTimeInput.value = window.formatTime(start);
    window.els.endTimeInput.value = window.formatTime(end);
};

window.els.startTimeInput.addEventListener('change', validateTimestamps);
window.els.endTimeInput.addEventListener('change', validateTimestamps);

window.els.btnSetStart.addEventListener('click', () => {
    window.els.startTimeInput.value = window.formatTime(window.els.mediaPlayer.currentTime);
    validateTimestamps();
});

window.els.btnSetEnd.addEventListener('click', () => {
    window.els.endTimeInput.value = window.formatTime(window.els.mediaPlayer.currentTime);
    validateTimestamps();
});

// Extraction Process
window.els.btnExtract.addEventListener('click', () => {
    if (window.isProcessing) {
        window.stopExtraction();
        window.isProcessing = false;
        window.setUILocked(false);
        window.els.btnExtract.innerText = "Extract Audio";
        window.els.btnExtract.classList.remove('bg-red-600', 'hover:bg-red-700');
        window.els.btnExtract.classList.add('bg-blue-600', 'hover:bg-blue-700');
        setTimeout(() => window.els.progressContainer.classList.add('hidden'), 250);
    } else {
        window.isProcessing = true;
        window.setUILocked(true);
        window.els.outputContainer.classList.add('hidden'); // Hide previous output
        window.els.btnExtract.innerText = "Stop / Cancel";
        window.els.btnExtract.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        window.els.btnExtract.classList.add('bg-red-600', 'hover:bg-red-700');
        window.startExtraction();
    }
});

window.startExtraction = () => {
    const file = window.currentMediaFile;
    if (!file) { return; }

    if (window.extractionWorker) { window.extractionWorker.terminate(); }
    window.extractionWorker = new Worker('js/extraction.worker.js', { type: 'module' });

    window.extractionWorker.onmessage = (e) => {
        const { type, buffer, msg, progress } = e.data;

        if (type === 'bar') {
            window.setProgress(progress, msg);
        } else if (type === 'error') {
            window.showNotification(msg, "error");
            window.els.btnExtract.click(); 
        } else if (type === 'done') {
            // Clean up previous blob
            if (window.outputBlobUrl) { URL.revokeObjectURL(window.outputBlobUrl); }

            // Create new Blob and attach to UI
            const blob = new Blob([buffer], { type: 'audio/mp3' });
            window.outputBlobUrl = URL.createObjectURL(blob);

            window.els.outputPlayer.src = window.outputBlobUrl;
            window.els.outputContainer.classList.remove('hidden');
            window.showNotification("Audio Extracted Successfully!", "success");
            window.els.btnExtract.click(); // Reset UI
        }
    };

    window.extractionWorker.postMessage({
        mediaData: file,
        startTime: window.parseTime(window.els.startTimeInput.value),
        endTime: window.parseTime(window.els.endTimeInput.value)
    });
}

window.stopExtraction = () => {
    if (!window.extractionWorker) { return; }
    window.extractionWorker.terminate(); 
    window.extractionWorker = null;
    console.log("Worker terminated.");
}

// Download Button
window.els.btnDownload.addEventListener('click', () => {
    if (!window.outputBlobUrl) { return; }

    // Get original filename or fallback to timestamp
    let originalName = window.currentMediaFile?.name || `extracted_audio_${Date.now()}`;

    // Remove the old extension (e.g., .mp4, .webm) and add .mp3
    let dotIndex = originalName.lastIndexOf('.');
    let baseName = dotIndex !== -1 ? originalName.substring(0, dotIndex) : originalName;
    let finalFileName = `${baseName}.mp3`;

    const a = document.createElement('a');
    a.href = window.outputBlobUrl;
    a.download = finalFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});