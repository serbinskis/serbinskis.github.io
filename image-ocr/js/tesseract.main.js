import { TesseractManager } from './tesseract.manager.js';
window.TesseractManager = TesseractManager;

window.els = {
    themeToggle: document.getElementById('theme-toggle'),
    lightIcon: document.getElementById('theme-icon-light'),
    darkIcon: document.getElementById('theme-icon-dark'),

    imageContainer: document.getElementById('image-container'),
    imagePlayer: document.getElementById('image-player'),
    emptyState: document.getElementById('empty-state'),
    canvasOverlayContainer: document.getElementById('canvas-overlay-container'),
    toggleOverlay: document.getElementById('toggle-overlay'),
    
    btnClearResults: document.getElementById('btn-clear-results'),
    btnCopyAll: document.getElementById('btn-copy-all'),

    languageSelect: document.getElementById('language-select'),
    confidenceSlider: document.getElementById('confidence-slider'),
    confidenceInput: document.getElementById('confidence-input'),

    btnLink: document.getElementById('btn-link'),
    btnFile: document.getElementById('btn-file'),
    fileInput: document.getElementById('file-input'),
    btnProcess: document.getElementById('btn-process'),

    progressContainer: document.getElementById('progress-container'),
    progressBar: document.getElementById('progress-bar'),
    progressText: document.getElementById('progress-text'),
    progressPercent: document.getElementById('progress-percent'),

    resultTextarea: document.getElementById('result-textarea'),

    linkModal: document.getElementById('link-modal'),
    linkModalContent: document.getElementById('link-modal-content'),
    linkInput: document.getElementById('link-input'),
    btnCancelLink: document.getElementById('btn-cancel-link'),
    btnSubmitLink: document.getElementById('btn-submit-link')
};

window.currentImageFile = null; 
window.isProcessing = false;
window.defaultConfidence = 0;
window.imageOcrData = null; 

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

window.showNotification = (msg, type = 'error') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex justify-between items-center ${type === 'error' ? 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/50 dark:text-red-200 dark:border-red-800' : 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/50 dark:text-green-200 dark:border-green-800'}`;
    toast.innerHTML = `<span>${msg}</span><button class="ml-4 opacity-70 hover:opacity-100 text-lg leading-none">&times;</button>`;
    toast.querySelector('button').onclick = () => toast.remove();
    container.appendChild(toast);
    setTimeout(() => { if(toast.parentElement) toast.remove(); }, 4000);
};

window.setUILocked = (locked) => {
    window.els.languageSelect.disabled = locked;
    window.els.btnLink.disabled = locked;
    window.els.btnFile.disabled = locked;
    window.els.imageContainer.style.pointerEvents = locked ? 'none' : 'auto';
    
    const hasImage = !!window.currentImageFile;
    window.els.btnProcess.disabled = locked ? true : !hasImage;
};

window.setProgress = (percent, text = '') => {
    window.els.progressContainer.classList.remove('hidden');
    let clamped = Math.max(0, Math.min(100, percent));
    window.els.progressBar.style.width = clamped + '%';
    window.els.progressPercent.innerText = Math.round(clamped) + '%';
    if (text) window.els.progressText.innerText = text;
};

window.clearOcrData = () => {
    window.imageOcrData = null;
    window.els.resultTextarea.value = '';
    window.els.canvasOverlayContainer.innerHTML = '';
};

window.resetImage = () => {
    window.clearOcrData();
    window.currentImageFile = null;
    window.els.imagePlayer.src = '';
    window.els.imagePlayer.classList.add('hidden');
    window.els.emptyState.classList.remove('hidden');
    window.els.imageContainer.classList.add('border-dashed', 'border-gray-300', 'dark:border-gray-600');
    window.els.imageContainer.classList.remove('border-solid', 'border-transparent');
    window.setUILocked(false);
};

window.syncSliderAndInput = (slider, input, min, max, storageKey) => {
    slider.addEventListener('input', (e) => input.value = e.target.value);
    slider.addEventListener('input', (e) => localStorage.setItem(storageKey, e.target.value));
    input.addEventListener('input', (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val)) { return; }
        if (val < min) val = min;
        if (val > max) val = max;
        input.value = slider.value = val;
        localStorage.setItem(storageKey, val);
    });
};

window.els.confidenceSlider.value = localStorage.getItem('ocr_img_confidence') || window.defaultConfidence;
window.els.confidenceInput.value = localStorage.getItem('ocr_img_confidence') || window.defaultConfidence;
window.syncSliderAndInput(window.els.confidenceSlider, window.els.confidenceInput, 0, 100, 'ocr_img_confidence');

// Function to load supported languages into the language selection dropdown
window.loadLanguages = (languagesArray) => {
    window.els.languageSelect.innerHTML = '';
    languagesArray.forEach(lang => {
        const opt = document.createElement('option');
        opt.value = JSON.stringify(lang.code);
        opt.textContent = lang.name;
        window.els.languageSelect.appendChild(opt);
    });
    const savedLang = localStorage.getItem('ocr_lang') || JSON.stringify(['eng']);
    if (languagesArray.some(l => JSON.stringify(l.code) === savedLang)) {
        window.els.languageSelect.value = savedLang;
    } else {
        window.els.languageSelect.value = JSON.stringify(languagesArray[0].code);
    }
};

// Initialize the language selection and set up event listener for changes
window.loadLanguages(window.supportedLanguages);
window.els.languageSelect.addEventListener('change', (e) => localStorage.setItem('ocr_lang', e.target.value));

// Theme Toggle Functionality
window.applyTheme = (isDark) => {
    document.documentElement.classList.toggle('dark', isDark);
    window.els.lightIcon.classList.toggle('hidden', isDark);
    window.els.darkIcon.classList.toggle('hidden', !isDark);
    localStorage.theme = isDark ? 'dark' : 'light';
}

// Initial Theme Setup
window.applyTheme(localStorage.theme === 'dark');
window.els.themeToggle.addEventListener('click', () => window.applyTheme(localStorage.theme !== 'dark'));

window.setupImagePlayer = async (src) => {
    return new Promise((resolve) => {
        window.clearOcrData();
        window.els.imagePlayer.crossOrigin = "anonymous";
        window.els.imagePlayer.onload = () => {
            window.els.imagePlayer.classList.remove('hidden');
            window.els.emptyState.classList.add('hidden');
            window.els.imageContainer.classList.remove('border-dashed', 'border-gray-300', 'dark:border-gray-600');
            window.els.imageContainer.classList.add('border-solid', 'border-transparent');
            window.setUILocked(false);
            resolve();
        };
        window.els.imagePlayer.onerror = () => {
            window.showNotification("Failed to load image.", "error");
            window.resetImage();
            resolve();
        };
        window.els.imagePlayer.src = src;
    });
};

// Function to handle image file selection
const handleImageFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) { return window.showNotification("Please select a valid image file.", "error"); }
    window.currentImageFile = file;
    await window.setupImagePlayer(URL.createObjectURL(file));
};

// Handle Click on Image Container to Trigger File Input
window.els.imageContainer.addEventListener('click', (e) => {
    if (e.target === window.els.imageContainer || e.target === window.els.emptyState || e.target.parentNode === window.els.emptyState) {
        window.els.fileInput.click();
    }
});

// File Input and Drag-and-Drop Handling
window.els.btnFile.addEventListener('click', () => window.els.fileInput.click());
window.els.fileInput.addEventListener('change', (e) => {
    handleImageFile(e.target.files[0]);
    e.target.value = ''; 
});

// Handle drag over event to allow drop
window.els.imageContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    window.els.imageContainer.classList.add('bg-blue-50', 'dark:bg-blue-900/20', 'border-blue-400');
});

// Handle drag leave event to remove highlight
window.els.imageContainer.addEventListener('dragleave', (e) => {
    e.preventDefault();
    window.els.imageContainer.classList.remove('bg-blue-50', 'dark:bg-blue-900/20', 'border-blue-400');
});

// Handle drop event for images
window.els.imageContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    window.els.imageContainer.classList.remove('bg-blue-50', 'dark:bg-blue-900/20', 'border-blue-400');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) { handleImageFile(e.dataTransfer.files[0]); }
});

// Handle paste event for images (CTRL+V)
window.addEventListener('paste', async (e) => {
    if (e.clipboardData && e.clipboardData.files.length > 0) { await handleImageFile(e.clipboardData.files[0]); }
    window.els.btnProcess.click(); // Automatically trigger processing after pasting an image
});

// Handle Link Button Click to Open Modal
window.els.btnLink.addEventListener('click', () => {
    window.els.linkModal.classList.remove('pointer-events-none', 'opacity-0');
    window.els.linkModalContent.classList.remove('scale-95');
    window.els.linkModalContent.classList.add('scale-100');
});

// Close modal when clicking outside the content
window.els.btnCancelLink.addEventListener('click', () => {
    window.els.linkModal.classList.add('pointer-events-none', 'opacity-0');
    window.els.linkModalContent.classList.remove('scale-100');
    window.els.linkModalContent.classList.add('scale-95');
});

// Handle Enter key in link input
window.els.btnSubmitLink.addEventListener('click', async () => {
    const url = window.els.linkInput.value.trim();
    if (!url) { return; }
    window.els.btnCancelLink.click();
    window.setUILocked(true);
    window.setProgress(50, "Fetching image...");

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const blob = await response.blob();
        handleImageFile(blob);
    } catch (err) {
        window.showNotification(`Failed to load URL: ${err.message}`, 'error');
        window.setUILocked(false);
    } finally {
        window.els.progressContainer.classList.add('hidden');
    }
});

// Function to draw overlay boxes for recognized text fragments
window.drawOverlay = () => {
    const container = window.els.canvasOverlayContainer;
    const img = window.els.imagePlayer;
    container.innerHTML = '';
    if (!window.els.toggleOverlay.checked || !window.imageOcrData || !img.naturalWidth) { return; }

    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const rect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const scale = Math.min(rect.width / nw, rect.height / nh);
    const renderedWidth = nw * scale;
    const renderedHeight = nh * scale;

    const internalOx = (rect.width - renderedWidth) / 2;
    const internalOy = (rect.height - renderedHeight) / 2;
    const externalOx = rect.left - containerRect.left;
    const externalOy = rect.top - containerRect.top;

    const ox = externalOx + internalOx;
    const oy = externalOy + internalOy;

    window.imageOcrData.fragments.forEach(frag => {
        if (!frag.bbox) { return; }
        const div = document.createElement('div');
        div.className = 'absolute border-[1.5px] border-blue-500/40 bg-blue-500/10 hover:border-blue-400 hover:bg-blue-500/30 cursor-pointer transition-all pointer-events-auto rounded-[2px]';

        const x = ox + (frag.bbox.x0 * scale);
        const y = oy + (frag.bbox.y0 * scale);
        const w = (frag.bbox.x1 - frag.bbox.x0) * scale;
        const h = (frag.bbox.y1 - frag.bbox.y0) * scale;

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

// Redraw overlay on window resize and when the toggle is changed
window.addEventListener('resize', window.drawOverlay);
window.els.toggleOverlay.addEventListener('change', window.drawOverlay);

// Function to get the current image as a data URL
window.getImageDataUrl = () => {
    const canvas = document.createElement('canvas');
    const img = window.els.imagePlayer;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.filter = 'grayscale(1) contrast(200%)'; // Apply filters to enhance OCR accuracy
    ctx.drawImage(canvas, 0, 0); 
    return canvas.toDataURL(`image/png`);
};

// OCR Processing Logic or Extract Text Button
window.els.btnProcess.addEventListener('click', async () => {
    if (!window.currentImageFile) { return; }

    window.isProcessing = true;
    window.setUILocked(true);
    window.els.btnProcess.innerText = "Processing...";
    const callback = (progress) => window.setProgress(progress, "Extracting text from image...");
    callback(0); // Initialize progress bar to 0% at the start of processing

    try {
        const langArr = JSON.parse(window.els.languageSelect.value);
        const confThresh = parseFloat(window.els.confidenceInput.value);
        const dataUrl = window.getImageDataUrl();
        const result = await TesseractManager.recognizeSpecial(dataUrl, langArr, confThresh, callback);

        if (result.text && result.text.trim().length > 0) {
            window.imageOcrData = { text: result.text, fragments: result.fragments };
            window.els.resultTextarea.value = result.text;
            window.drawOverlay(); 
            window.showNotification('OCR completed successfully!', 'success');
        } else {
            window.els.resultTextarea.value = '';
            window.showNotification('No text found meeting confidence threshold.', 'error');
        }
    } catch (err) {
        window.showNotification(`Extraction failed: ${err.message}`, 'error');
        console.error(err);
    } finally {
        window.isProcessing = false;
        window.setUILocked(false);
        window.els.btnProcess.innerText = "Extract Text";
        window.setProgress(0);
        window.els.progressContainer.classList.add('hidden');
    }
});

// Clear Results Button
window.els.btnClearResults.addEventListener('click', () => {
    window.clearOcrData();
    window.showNotification("Results cleared.", "success");
});

// Copy All Button
window.els.btnCopyAll.addEventListener('click', () => {
    const text = window.els.resultTextarea.value;
    if (!text) { return; }
    navigator.clipboard.writeText(text);
    window.showNotification("Copied to clipboard!", "success");
});