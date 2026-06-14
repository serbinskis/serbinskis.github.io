import { TesseractManager } from './tesseract.manager.js';
window.TesseractManager = TesseractManager;

window.els = {
    themeToggle: document.getElementById('theme-toggle'),
    lightIcon: document.getElementById('theme-icon-light'),
    darkIcon: document.getElementById('theme-icon-dark'),

    videoContainer: document.getElementById('video-container'),
    videoPlayer: document.getElementById('video-player'),
    canvasOverlayContainer: document.getElementById('canvas-overlay-container'),
    toggleOverlay: document.getElementById('toggle-overlay'),
    btnClearResults: document.getElementById('btn-clear-results'),

    languageSelect: document.getElementById('language-select'),
    intervalSlider: document.getElementById('interval-slider'),
    intervalInput: document.getElementById('interval-input'),
    confidenceSlider: document.getElementById('confidence-slider'),
    confidenceInput: document.getElementById('confidence-input'),
    workersSlider: document.getElementById('workers-slider'),
    workersInput: document.getElementById('workers-input'),

    btnLink: document.getElementById('btn-link'),
    btnFile: document.getElementById('btn-file'),
    fileInput: document.getElementById('file-input'),
    btnProcess: document.getElementById('btn-process'),
    btnExtractFrame: document.getElementById('btn-extract-frame'),

    progressContainer: document.getElementById('progress-container'),
    progressBar: document.getElementById('progress-bar'),
    progressText: document.getElementById('progress-text'),
    progressPercent: document.getElementById('progress-percent'),

    customExtractsContainer: document.getElementById('custom-extracts-container'),
    timelineExtractsContainer: document.getElementById('timeline-extracts-container'),

    linkModal: document.getElementById('link-modal'),
    linkModalContent: document.getElementById('link-modal-content'),
    linkInput: document.getElementById('link-input'),
    btnCancelLink: document.getElementById('btn-cancel-link'),
    btnSubmitLink: document.getElementById('btn-submit-link'),

    btnExportJson: document.getElementById('btn-export-json'),
    btnExportTxt: document.getElementById('btn-export-txt')
};

window.currentVideoFile = null; 
window.activeDownload = false;
window.downloadAbortController = null;
window.isProcessing = false;
window.defaultInterval = 1.0;
window.defaultConfidence = 30;
window.defaultWorkers = 1;
window.maxCores = navigator.hardwareConcurrency || 1;
window.minDrawOverlayInterval = 1; // seconds, only show bounding boxes from OCR data that is within this interval of the current video time to avoid showing irrelevant boxes when seeking
window.ocrFormat = { image: 'jpg', quality: 0.8 }; // Image format and quality for frame extraction, quality is only used for jpeg
window.frameOcrData = {}; // Stores OCR results for each frame, keyed by timestamp

// Latvian set as first item to act as fallback default if no match
window.supportedLanguages = [
    { code: ['afr'], name: 'Afrikaans' },
    { code: ['amh'], name: 'Amharic' },
    { code: ['ara'], name: 'Arabic' },
    { code: ['asm'], name: 'Assamese' },
    { code: ['aze'], name: 'Azerbaijani' },
    { code: ['bel'], name: 'Belarusian' },
    { code: ['ben'], name: 'Bengali' },
    { code: ['bod'], name: 'Tibetan' },
    { code: ['bos'], name: 'Bosnian' },
    { code: ['bul'], name: 'Bulgarian' },
    { code: ['ceb'], name: 'Cebuano' },
    { code: ['ces'], name: 'Czech' },
    { code: ['chi_sim'], name: 'Chinese (Simplified)' },
    { code: ['chi_tra'], name: 'Chinese (Traditional)' },
    { code: ['chr'], name: 'Cherokee' },
    { code: ['cym'], name: 'Welsh' },
    { code: ['dan'], name: 'Danish' },
    { code: ['deu'], name: 'German' },
    { code: ['dzo'], name: 'Dzongkha' },
    { code: ['eng'], name: 'English' },
    { code: ['epo'], name: 'Esperanto' },
    { code: ['est'], name: 'Estonian' },
    { code: ['eus'], name: 'Basque' },
    { code: ['fas'], name: 'Persian' },
    { code: ['fin'], name: 'Finnish' },
    { code: ['fra'], name: 'French' },
    { code: ['frk'], name: 'Frankish' },
    { code: ['gle'], name: 'Irish' },
    { code: ['glg'], name: 'Galician' },
    { code: ['guj'], name: 'Gujarati' },
    { code: ['heb'], name: 'Hebrew' },
    { code: ['hin'], name: 'Hindi' },
    { code: ['hrv'], name: 'Croatian' },
    { code: ['hun'], name: 'Hungarian' },
    { code: ['iku'], name: 'Inuktitut' },
    { code: ['ind'], name: 'Indonesian' },
    { code: ['isl'], name: 'Icelandic' },
    { code: ['ita'], name: 'Italian' },
    { code: ['jav'], name: 'Javanese' },
    { code: ['jpn'], name: 'Japanese' },
    { code: ['kan'], name: 'Kannada' },
    { code: ['kat'], name: 'Georgian' },
    { code: ['kaz'], name: 'Kazakh' },
    { code: ['khm'], name: 'Central Khmer' },
    { code: ['kir'], name: 'Kirghiz; Kyrgyz' },
    { code: ['kor'], name: 'Korean' },
    { code: ['kur'], name: 'Kurdish' },
    { code: ['lao'], name: 'Lao' },
    { code: ['lat'], name: 'Latin' },
    { code: ['lav'], name: 'Latvian' },
    { code: ['lit'], name: 'Lithuanian' },
    { code: ['mal'], name: 'Malayalam' },
    { code: ['mar'], name: 'Marathi' },
    { code: ['mkd'], name: 'Macedonian' },
    { code: ['mlt'], name: 'Maltese' },
    { code: ['msa'], name: 'Malay' },
    { code: ['mya'], name: 'Myanmar; Burmese' },
    { code: ['nep'], name: 'Nepali' },
    { code: ['nld'], name: 'Dutch; Flemish' },
    { code: ['nor'], name: 'Norwegian' },
    { code: ['ori'], name: 'Oriya' },
    { code: ['pan'], name: 'Panjabi; Punjabi' },
    { code: ['pol'], name: 'Polish' },
    { code: ['por'], name: 'Portuguese' },
    { code: ['pus'], name: 'Pushto; Pashto' },
    { code: ['ron'], name: 'Romanian; Moldavian; Moldovan' },
    { code: ['rus'], name: 'Russian' },
    { code: ['san'], name: 'Sanskrit' },
    { code: ['sin'], name: 'Sinhala; Sinhalese' },
    { code: ['slk'], name: 'Slovak' },
    { code: ['slv'], name: 'Slovenian' },
    { code: ['spa'], name: 'Spanish; Castilian' },
    { code: ['sqi'], name: 'Albanian' },
    { code: ['srp'], name: 'Serbian' },
    { code: ['swa'], name: 'Swahili' },
    { code: ['swe'], name: 'Swedish' },
    { code: ['syr'], name: 'Syriac' },
    { code: ['tam'], name: 'Tamil' },
    { code: ['tel'], name: 'Telugu' },
    { code: ['tgk'], name: 'Tajik' },
    { code: ['tgl'], name: 'Tagalog' },
    { code: ['tha'], name: 'Thai' },
    { code: ['tir'], name: 'Tigrinya' },
    { code: ['tur'], name: 'Turkish' },
    { code: ['uig'], name: 'Uighur; Uyghur' },
    { code: ['ukr'], name: 'Ukrainian' },
    { code: ['urd'], name: 'Urdu' },
    { code: ['uzb'], name: 'Uzbek' },
    { code: ['vie'], name: 'Vietnamese' },
    { code: ['yid'], name: 'Yiddish' }
];

/**
 * Displays a notification message in the UI.
 * @param {string} msg - The message to display.
 * @param {string} type - The type of notification ('error' or 'success').
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
    window.els.languageSelect.disabled = locked;
    //window.els.intervalSlider.disabled = locked;
    //window.els.intervalInput.disabled = locked;
    //window.els.confidenceSlider.disabled = locked;
    //window.els.confidenceInput.disabled = locked;
    window.els.workersSlider.disabled = locked;
    window.els.workersInput.disabled = locked;
    window.els.btnLink.disabled = locked && !window.activeDownload;
    window.els.btnFile.disabled = locked;
    //window.els.btnExportJson.disabled = locked;
    //window.els.btnExportTxt.disabled = locked;

    const hasVideo = !!window.currentVideoFile;
    window.els.btnExtractFrame.disabled = /*locked ? true :*/ !hasVideo;
    window.els.btnProcess.disabled = locked ? true : !hasVideo;
};

/**
 * Updates the progress bar and text in the UI.
 * @param {number} percent - The progress percentage (0-100).
 * @param {string} [text=''] - Optional text to display alongside the progress.
 */
window.setProgress = (percent, text = '') => {
    window.els.progressContainer.classList.remove('hidden');
    let clamped = Math.max(0, Math.min(100, percent));
    window.els.progressBar.style.width = clamped + '%';
    window.els.progressPercent.innerText = Math.round(clamped) + '%';
    if (text) window.els.progressText.innerText = text;
};

/**
 * Formats a time value in seconds into a string representation of "HH:MM:SS.s" or "MM:SS.s".
 * @param {number} seconds - The time in seconds to format.
 * @returns {string} - The formatted time string.
 */
window.formatTime = (seconds) => {
    if (isNaN(seconds)) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = (seconds % 60).toFixed(1);
    const sFormatted = s.padStart(4, '0');
    if (h > 0) { return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sFormatted}`; }
    return `${m.toString().padStart(2, '0')}:${sFormatted}`;
}

/**
 * Clears all OCR data and resets the custom and timeline extraction containers.
 */
window.clearOcrData = () => {
    window.frameOcrData = {};
    window.els.customExtractsContainer.innerHTML = '<h3 class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Custom Extractions</h3>';
    window.els.timelineExtractsContainer.innerHTML = '<h3 class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Timeline OCR</h3>';
    window.drawOverlay();
};

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

window.els.workersSlider.max = window.maxCores;
window.els.workersInput.max = window.maxCores;

window.els.intervalSlider.value = localStorage.getItem('ocr_interval') || window.defaultInterval;
window.els.intervalInput.value = localStorage.getItem('ocr_interval') || window.defaultInterval;
window.els.confidenceSlider.value = localStorage.getItem('ocr_confidence') || window.defaultConfidence;
window.els.confidenceInput.value = localStorage.getItem('ocr_confidence') || window.defaultConfidence;
window.els.workersSlider.value = localStorage.getItem('ocr_workers') || window.defaultWorkers;
window.els.workersInput.value = localStorage.getItem('ocr_workers') || window.defaultWorkers;

// Initialize sliders and inputs with saved values or defaults, and set up synchronization between them
window.syncSliderAndInput(window.els.intervalSlider, window.els.intervalInput, 0.1, 5.0, 'ocr_interval');
window.syncSliderAndInput(window.els.confidenceSlider, window.els.confidenceInput, 0, 100, 'ocr_confidence');
window.syncSliderAndInput(window.els.workersSlider, window.els.workersInput, 1, window.maxCores, 'ocr_workers');

/**
 * Load supported languages into the language select dropdown and set the selected language based on saved preference or default.
 * @param {Array} languagesArray - Array of language objects with 'code' and 'name' properties.
 */
window.loadLanguages = (languagesArray) => {
    window.els.languageSelect.innerHTML = '';
    languagesArray.forEach(lang => {
        const opt = document.createElement('option');
        opt.value = JSON.stringify(lang.code);
        opt.textContent = lang.name;
        window.els.languageSelect.appendChild(opt);
    });
    // Try to load saved language or default to Latvian (which is index 0)
    const savedLang = localStorage.getItem('ocr_lang') || JSON.stringify(['eng']); // Default to English if no saved language
    if (languagesArray.some(l => JSON.stringify(l.code) === savedLang)) {
        window.els.languageSelect.value = savedLang;
    } else {
        window.els.languageSelect.value = JSON.stringify(languagesArray[0].code);
    }
};

window.loadLanguages(window.supportedLanguages);
window.els.languageSelect.addEventListener('change', (e) => localStorage.setItem('ocr_lang', e.target.value));

/** Applies the selected theme (dark or light) to the document and updates the theme toggle button icons.
 * @param {boolean} isDark - If true, applies dark theme; otherwise, applies light theme.
*/
window.applyTheme = (isDark) => {
    document.documentElement.classList.toggle('dark', isDark);
    window.els.lightIcon.classList.toggle('hidden', isDark);
    window.els.darkIcon.classList.toggle('hidden', !isDark);
    localStorage.theme = isDark ? 'dark' : 'light';
}

window.applyTheme(localStorage.theme === 'dark');
window.els.themeToggle.addEventListener('click', () => window.applyTheme(localStorage.theme !== 'dark'));

/** Sets up the video player with the provided source URL and resets OCR data.
 * @param {string} src - The source URL of the video to be played.
*/
window.setupVideoPlayer = (src) => {
    window.clearOcrData();
    if (src) { window.els.videoPlayer.src = src; }
    window.els.videoContainer.classList.remove('hidden');
    window.els.videoContainer.classList.add('flex');
    window.setUILocked(false);
}

window.els.btnFile.addEventListener('click', () => window.els.fileInput.click());
window.els.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) { return; }
    window.currentVideoFile = file;
    window.setupVideoPlayer(URL.createObjectURL(file));
    e.target.value = ''; 
});

window.els.btnLink.addEventListener('click', () => {
    if (window.activeDownload && window.downloadAbortController) { return window.downloadAbortController.abort(); }
    window.els.linkModal.classList.remove('pointer-events-none', 'opacity-0');
    window.els.linkModalContent.classList.remove('scale-95');
    window.els.linkModalContent.classList.add('scale-100');
});

window.els.btnCancelLink.addEventListener('click', () => {
    window.els.linkModal.classList.add('pointer-events-none', 'opacity-0');
    window.els.linkModalContent.classList.remove('scale-100');
    window.els.linkModalContent.classList.add('scale-95');
});

window.els.btnSubmitLink.addEventListener('click', () => {
    const url = window.els.linkInput.value.trim();
    if (!url) { return; }
    window.els.btnCancelLink.click();
    window.downloadVideoFromUrl(url); 
});

/**
 * Function to download video from URL with progress and cancellation support
 * @param {string} url - The URL of the video to download
 */
window.downloadVideoFromUrl = async (url) => {
    if (window.activeDownload) { return; }
    window.activeDownload = true;
    window.setUILocked(true);
    window.els.btnLink.innerHTML = '❌ Cancel';
    window.els.progressContainer.classList.remove('hidden');
    window.downloadAbortController = new AbortController();

    try {
        const response = await fetch(url, { signal: window.downloadAbortController.signal });
        if (!response.ok) { throw new Error(`HTTP Error: ${response.status}`); }

        const totalBytes = parseInt(response.headers.get('content-length') || 0, 10);
        if (totalBytes > 2 * 1024 * 1024 * 1024) { throw new Error("File exceeds 2 GB limit."); }

        let loadedBytes = 0;
        const reader = response.body.getReader();
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) { break; }
            chunks.push(value);
            loadedBytes += value.byteLength;
            const percent = totalBytes ? (loadedBytes / totalBytes) * 100 : 100;
            window.setProgress(percent, `Downloading... ${(loadedBytes/1048576).toFixed(1)} MB`);
        }

        const downloadedBlob = new Blob(chunks);
        window.currentVideoFile = downloadedBlob;
        window.setupVideoPlayer(URL.createObjectURL(downloadedBlob));
        window.showNotification(`Video downloaded!`, 'success');
    } catch (err) {
        window.showNotification(err.name === 'AbortError' ? 'Download cancelled.' : err.message, 'error');
    } finally {
        window.activeDownload = false;
        window.downloadAbortController = null;
        window.els.btnLink.innerHTML = '🔗 Link';
        window.els.progressContainer.classList.add('hidden');
        window.setUILocked(false);
    }
};

/**
 * Function to draw OCR bounding boxes overlay on the video
*/
window.drawOverlay = () => {
    const container = window.els.canvasOverlayContainer;
    const video = window.els.videoPlayer;
    container.innerHTML = '';
    if (!window.els.toggleOverlay.checked || !window.currentVideoFile || !video.videoWidth || !video.videoHeight) { return; }

    let closestTime = null;
    let minDiff = window.minDrawOverlayInterval; // Only show boxes from OCR data that is within the specified interval of the current video time to avoid showing irrelevant boxes when seeking
    const current = video.currentTime;

    // Find the closest OCR data timestamp to the current video time
    for (const key in window.frameOcrData) {
        const t = parseFloat(key);
        const diff = Math.abs(t - current);
        if (diff <= minDiff) { minDiff = diff; closestTime = key; }
    }

    if (!closestTime) { return; } // If no OCR data is close enough to the current time, don't show any boxes
    const data = window.frameOcrData[closestTime];
    if (!data.fragments || data.fragments.length === 0) { return; }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const videoRect = video.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const scale = Math.min(videoRect.width / vw, videoRect.height / vh);
    const renderedWidth = vw * scale;
    const renderedHeight = vh * scale;

    const internalOx = (videoRect.width - renderedWidth) / 2;
    const internalOy = (videoRect.height - renderedHeight) / 2;

    const externalOx = videoRect.left - containerRect.left;
    const externalOy = videoRect.top - containerRect.top;

    const ox = externalOx + internalOx;
    const oy = externalOy + internalOy;

    data.fragments.forEach(frag => {
        const bbox = frag.bbox; 
        if (!bbox) { return; }

        const div = document.createElement('div');
        div.className = 'absolute border-[1.5px] border-blue-500/40 bg-blue-500/10 hover:border-blue-400 hover:bg-blue-500/30 cursor-pointer transition-all pointer-events-auto rounded-[2px]';

        const x = ox + (bbox.x0 * scale);
        const y = oy + (bbox.y0 * scale);
        const w = (bbox.x1 - bbox.x0) * scale;
        const h = (bbox.y1 - bbox.y0) * scale;

        div.style.left = `${x}px`;
        div.style.top = `${y}px`;
        div.style.width = `${w}px`;
        div.style.height = `${h}px`;

        div.title = `Click to copy: "${frag.text}"`;
        div.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation(); 
            navigator.clipboard.writeText(frag.text);
            window.showNotification(`Copied: "${frag.text}"`, 'success');
        };

        container.appendChild(div);
    });
};

window.els.videoPlayer.addEventListener('timeupdate', window.drawOverlay);
window.addEventListener('resize', window.drawOverlay);
window.els.toggleOverlay.addEventListener('change', window.drawOverlay);

/**
 * Function to insert OCR result elements into the timeline in sorted order based on their timestamp
 * @param {HTMLElement} container - The parent element that holds the OCR result entries (e.g., timelineExtractsContainer)
 * @param {HTMLElement} element - The new OCR result element to be inserted
 * @param {number} time - The timestamp associated with the OCR result, used for sorting
 * @return {boolean} - Returns true if the element was inserted before an existing element, or false if it was appended at the end
*/
window.insertSorted = (container, element, time) => {
    const children = Array.from(container.children).filter(c => c.hasAttribute('data-time-box'));
    element.setAttribute('data-time-box', time);

    let inserted = false;
    for (let i = 0; i < children.length; i++) {
        const childTime = parseFloat(children[i].getAttribute('data-time-box'));
        if (time < childTime) { container.insertBefore(element, children[i]); }
        if (time < childTime) { inserted = true; break; }
    }

    if (!inserted) { container.appendChild(element); }
    return inserted;
};

/**
 * Function to create and render an OCR result entry in the OCR results sidebar. It handles both timeline-based results and custom user-added results.
 * @param {number} time - The timestamp of the OCR result, used for timeline
 * @param {string} text - The OCR extracted text to be displayed
 * @param {boolean} isCustom - Flag indicating whether this is a custom user-added result (true) or a timeline OCR result (false). Custom results are displayed in a separate section and have a "Custom" badge.
 */
window.renderOcrResultElement = (time, text, isCustom) => {
    const existing = document.querySelector(`[data-time-box="${time}"]`);
    if (existing && !isCustom && window.els.videoPlayer.paused) { return; } // If video is paused and there's already an entry for this timestamp, don't add another one since user might be inspecting results around current time
    if (existing) { existing.remove(); } // Remove existing entry for the same timestamp to avoid duplicates
    const container = document.createElement('div');
    container.setAttribute('data-time-box', time); 
    container.className = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden flex flex-col group/item';

    const header = document.createElement('div');
    header.className = 'flex justify-between items-center px-3 py-1 cursor-pointer bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors select-none group';

    const titleBox = document.createElement('div');
    titleBox.className = 'flex items-center gap-2 flex-grow min-w-0';

    const timeStr = `[${window.formatTime(time)}]`;
    let badgeHtml = isCustom ? `<span class="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 px-1.5 py-0.5 rounded uppercase font-bold flex-shrink-0">Custom</span>` : '';

    const previewText = text.replace(/[\r\n]+/g, ' ').trim();
    const previewStr = previewText.length > 50 ? previewText.substring(0, 50) + '...' : previewText;

    titleBox.innerHTML = `
        <span class="font-bold text-blue-600 dark:text-blue-400 font-mono tracking-tight cursor-pointer flex-shrink-0" data-time="${time}">${timeStr}</span>
        ${badgeHtml}
        <span class="text-xs text-gray-500 dark:text-gray-400 truncate w-24 sm:w-48 ml-1 pointer-events-none">${previewStr}</span>
    `;

    const controlsBox = document.createElement('div');
    controlsBox.className = 'flex items-center gap-3 flex-shrink-0';

    // Delete Button
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>`;

    deleteBtn.className = 'text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 opacity-0 group-hover/item:opacity-100 transition-opacity p-1';
    deleteBtn.title = "Remove result";
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        delete window.frameOcrData[time];
        container.remove();
        window.drawOverlay();
    };

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy';
    copyBtn.className = 'text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors opacity-0 group-hover/item:opacity-100';
    copyBtn.onclick = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        window.showNotification('Copied to clipboard!', 'success');
    };

    const arrowIcon = document.createElement('span');
    arrowIcon.innerHTML = '▼';
    arrowIcon.className = 'text-xs text-gray-500 transition-transform duration-200';

    controlsBox.appendChild(deleteBtn);
    controlsBox.appendChild(copyBtn);
    controlsBox.appendChild(arrowIcon);
    header.appendChild(titleBox);
    header.appendChild(controlsBox);

    const body = document.createElement('div');
    body.className = 'hidden p-3 text-sm text-gray-800 dark:text-gray-200 border-t border-gray-200 dark:border-gray-700 font-mono whitespace-pre-wrap leading-relaxed break-words';
    body.textContent = text;

    header.onclick = (e) => {
        if(e.target.tagName === 'SPAN' && e.target.hasAttribute('data-time')) {
            // Update time, but do NOT force playback
            return window.els.videoPlayer.currentTime = parseFloat(e.target.getAttribute('data-time'));
        }
        const isHidden = body.classList.contains('hidden');
        body.classList.toggle('hidden');
        arrowIcon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    };

    container.appendChild(header);
    container.appendChild(body);

    if (isCustom) {
        window.els.customExtractsContainer.prepend(container);
        if (!window.isProcessing || window.els.videoPlayer.paused) { container.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    } else {
        window.insertSorted(window.els.timelineExtractsContainer, container, time);
        const videoTime = window.els.videoPlayer.currentTime;
        const timeDiff = Math.abs(videoTime - time);

        // Don't scroll if adding the same time. This means the video is paused, so we won't get scrolled away.
        // This is so the user can inspect the desired entry without getting scrolled away.
        // Also, don't scroll if the time difference is too large, since the user may seek through the video while older frames are still being processed in the background.
        if (existing || timeDiff > 30) { return; }
        container.scrollIntoView({ behavior: 'smooth', block: 'center' }); // Scroll to the specific item instead of the bottom
    }
};

/**
 * Function to capture the current frame of the video as a data URL. It creates an off-screen canvas, draws the current video frame onto it, and then converts it to a JPEG data URL.
 * @return {string} - A data URL representing the current video frame in JPEG format.
 */
window.getFrameDataUrl = () => {
    const canvas = document.createElement('canvas');
    const video = window.els.videoPlayer;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(`image/${window.ocrFormat.image}`, (window.ocrFormat.image === 'jpeg' || window.ocrFormat.image === 'jpg') ? window.ocrFormat.quality : undefined);
};

// Extract current frame OCR logic
window.els.btnExtractFrame.addEventListener('click', async () => {
    const time = window.els.videoPlayer.currentTime;
    if (!window.isProcessing) { window.setUILocked(true); }
    window.setProgress(100, `Extracting current frame...`);

    try {
        const langArr = JSON.parse(window.els.languageSelect.value);
        const confThresh = parseFloat(window.els.confidenceInput.value);
        const dataUrl = window.getFrameDataUrl();
        const result = await TesseractManager.recognizeSpecial(dataUrl, langArr, confThresh);

        if (result.text && result.text.trim().length > 0) {
            window.frameOcrData[time] = { text: result.text, fragments: result.fragments, isCustom: true };
            window.renderOcrResultElement(time, result.text, true);
            window.drawOverlay(); 
            window.showNotification('Frame extracted!', 'success');
        } else {
            window.showNotification('No text found in frame meeting confidence threshold.', 'error');
        }
    } catch (err) {
        window.showNotification(`Extraction failed: ${err.message}`, 'error');
    } finally {
        if (!window.isProcessing) { window.setProgress(0); }
        if (!window.isProcessing) { window.els.progressContainer.classList.add('hidden'); }
        if (!window.isProcessing) { window.setUILocked(false); }
    }
});

// Main video OCR processing loop logic
window.els.btnProcess.addEventListener('click', async () => {
    if (window.isProcessing) { return window.isProcessing = false; }

    window.isProcessing = true;
    window.setUILocked(true);
    window.els.btnProcess.disabled = false; 
    window.els.btnProcess.innerText = "Stop / Cancel";
    window.els.btnProcess.classList.replace('bg-blue-600', 'bg-red-600');
    window.els.btnProcess.classList.replace('hover:bg-blue-700', 'hover:bg-red-700');
    const langArr = JSON.parse(window.els.languageSelect.value);
    const workersCount = parseInt(window.els.workersSlider.value, 10);

    try {
        await TesseractManager.initWorkers(workersCount, langArr, (p) => window.setProgress(p, `Preparing Tesseract OCR... ${p.toFixed(1)}%`));
        if (window.els.videoPlayer.paused) { window.els.videoPlayer.play().catch(()=>{}); }

        while (window.isProcessing && !window.els.videoPlayer.ended) {
            const loopStart = performance.now();
            const currentTime = window.els.videoPlayer.currentTime;
            const duration = window.els.videoPlayer.duration || 1;

            window.setProgress((currentTime / duration) * 100, `Processing: ${currentTime.toFixed(1)}s / ${duration.toFixed(1)}s`);
            const dataUrl = window.getFrameDataUrl();
            const confThresh = parseFloat(window.els.confidenceInput.value);

            // We are only awaiting our position in the queue here
            await TesseractManager.recognizeCallback(dataUrl, langArr, confThresh, (err, result) => {
                if (!(window.isProcessing && result.text && result.text.trim().length > 0)) { return; }
                window.frameOcrData[currentTime] = { text: result.text, fragments: result.fragments, isCustom: false };
                window.renderOcrResultElement(currentTime, result.text, false);
                window.drawOverlay();
            });

            const elapsed = performance.now() - loopStart;
            const intervalMs = parseFloat(window.els.intervalInput.value) * 1000;
            const waitTime = Math.max(0, intervalMs - elapsed);
            if (window.isProcessing) { await new Promise(r => setTimeout(r, waitTime)); }
        }
    } catch (err) {
        window.showNotification(`Process error: ${err.message}`, 'error');
        console.error(err);
    } finally {
        TesseractManager.stopWorkers();
        window.isProcessing = false;
        window.setUILocked(false);
        window.els.btnProcess.innerText = "Run Video OCR";
        window.els.btnProcess.classList.replace('bg-red-600', 'bg-blue-600');
        window.els.btnProcess.classList.replace('hover:bg-red-700', 'hover:bg-blue-700');
        window.els.progressContainer.classList.add('hidden');
    }
});

window.els.btnClearResults.addEventListener('click', () => {
    if (Object.keys(window.frameOcrData).length === 0) { return; }
    window.clearOcrData();
    window.showNotification("All results cleared.", "success");
});

/**
 * Export OCR data logic to JSON or TXT format
 * @param {string} format - The desired export format, either 'json' or 'txt'. The function generates a file containing all OCR results in the specified format and triggers a download in the browser.
 */
window.exportOcrData = (format) => {
    const keys = Object.keys(window.frameOcrData).sort((a,b) => parseFloat(a) - parseFloat(b));
    if (keys.length === 0) { return window.showNotification('No OCR data to export.', 'error'); }
    let content = '', mimeType = 'text/plain';
    let filename = `ocr_data_${Date.now()}.${format}`;

    if (format === 'json') {
        content = JSON.stringify(window.frameOcrData, null, 2);
        mimeType = 'application/json';
    } else if (format === 'txt') {
        content = keys.map(k => {
            const d = window.frameOcrData[k];
            return `[${window.formatTime(k)}]${d.isCustom ? ' (Custom)' : ''}\n${d.text}\n`;
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

window.els.btnExportJson.addEventListener('click', () => window.exportOcrData('json'));
window.els.btnExportTxt.addEventListener('click', () => window.exportOcrData('txt'));