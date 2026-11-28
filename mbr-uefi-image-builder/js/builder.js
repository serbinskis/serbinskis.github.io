import {
    DEFAULT_IMAGE_WIDTH,
    DEFAULT_IMAGE_HEIGHT,
    MAXIMUM_IMAGE_SIZE,
    MAXIMUM_MBR_SIZE,
    MBR_SECTOR_SIZE,
    MAX_COMPRESSED_MBR_PAYLOAD,
    convertImageDataToBin,
    compressBin,
    build24BitBmp
} from './image2bin.js';

// Patch offsets & hex signatures from MBR_UEFI_Image_Builder.pas
const COMP_SIZE_INDEX_1 = 32;
const COMP_SIZE_INDEX_2 = 37;
const COMP_SIZE_INDEX_3 = 101;

const MBR_CODE_ADDRESS = 0x84D5C;
const UEFI_BMP_ADDRESS = 0x911FC;
const ENDING_ADDRESS = 0x7FD28;

const MARKER_MBR = [0x31, 0x32, 0x33, 0x34, 0x35, 0x00, 0x00, 0x00, 0x00];
const MARKER_UEFI_FULL = [0x42, 0x4D, 0x36, 0xEE, 0x02, 0x00];
const MARKER_UEFI_SHORT = [0x42, 0x4D, 0x36, 0xEE];
const MARKER_ENDING = [
    0x30, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0x01, 0x00, 0x00, 0x00,
    0x31, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0x01, 0x00, 0x00, 0x00,
    0x32, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0x01, 0x00, 0x00, 0x00, 0x33
];

const V86_CDN = 'https://cdn.jsdelivr.net/npm/v86@latest/build';
const BIOS_CDN = 'https://cdn.jsdelivr.net/gh/copy/v86@master/bios';

// Application State
const state = {
    sourceImage: null,       // HTMLImageElement
    sourceWidth: 0,
    sourceHeight: 0,
    sourceSizeBytes: 0,
    imageData320x200: null,  // ImageData (320x200)
    compressedMbr: null,     // Uint8Array | null
    mbrFits: false,
    paletteCount: 0,
    totalUniqueColors: 0,
    uefiBmp: null,           // Uint8Array (192054 bytes)
    customIconBytes: null,   // Uint8Array | null
    pendingExportType: null, // 'mbr' | 'uefi' | 'exe'
    emulator: null,
    assetsCache: {
        mbrTemplate: null,
        efiTemplate: null,
        exeTemplate: null
    }
};

// DOM Elements
const el = {
    toastContainer: document.getElementById('toast-container'),
    themeToggle: document.getElementById('theme-toggle'),
    themeIconLight: document.getElementById('theme-icon-light'),
    themeIconDark: document.getElementById('theme-icon-dark'),

    imageContainer: document.getElementById('image-container'),
    emptyState: document.getElementById('empty-state'),
    previewCanvas: document.getElementById('preview-canvas'),
    resolutionBadge: document.getElementById('resolution-badge'),

    btnLink: document.getElementById('btn-link'),
    btnFile: document.getElementById('btn-file'),
    btnDefaultImg: document.getElementById('btn-default-img'),
    btnClearImg: document.getElementById('btn-clear-img'),
    imageFileInput: document.getElementById('image-file-input'),
    crispResize: document.getElementById('crisp-resize'),

    iconPreview: document.getElementById('icon-preview'),
    iconPlaceholder: document.getElementById('icon-placeholder'),
    btnChangeIcon: document.getElementById('btn-change-icon'),
    btnClearIcon: document.getElementById('btn-clear-icon'),
    iconFileInput: document.getElementById('icon-file-input'),
    iconFilename: document.getElementById('icon-filename'),
    endingSelect: document.getElementById('ending-select'),

    statDimensions: document.getElementById('stat-dimensions'),
    statFilesize: document.getElementById('stat-filesize'),
    statColors: document.getElementById('stat-colors'),
    statMbrSize: document.getElementById('stat-mbr-size'),
    statUefiSize: document.getElementById('stat-uefi-size'),
    mbrStatusBanner: document.getElementById('mbr-status-banner'),

    btnQemu: document.getElementById('btn-qemu'),
    btnExportMbr: document.getElementById('btn-export-mbr'),
    btnExportUefi: document.getElementById('btn-export-uefi'),
    btnExportExe: document.getElementById('btn-export-exe'),

    linkModal: document.getElementById('link-modal'),
    linkModalContent: document.getElementById('link-modal-content'),
    linkInput: document.getElementById('link-input'),
    btnCancelLink: document.getElementById('btn-cancel-link'),
    btnSubmitLink: document.getElementById('btn-submit-link'),

    warningModal: document.getElementById('warning-modal'),
    warningModalContent: document.getElementById('warning-modal-content'),
    warningTargetFile: document.getElementById('warning-target-file'),
    warningExtraInfo: document.getElementById('warning-extra-info'),
    btnCancelWarning: document.getElementById('btn-cancel-warning'),
    btnConfirmExport: document.getElementById('btn-confirm-export'),

    btnGuide: document.getElementById('btn-guide'),
    guideModal: document.getElementById('guide-modal'),
    guideModalContent: document.getElementById('guide-modal-content'),
    btnCloseGuide: document.getElementById('btn-close-guide'),

    qemuModal: document.getElementById('qemu-modal'),
    qemuModalContent: document.getElementById('qemu-modal-content'),
    qemuStatus: document.getElementById('qemu-status'),
    btnQemuRestart: document.getElementById('btn-qemu-restart'),
    btnCloseQemu: document.getElementById('btn-close-qemu'),
    v86ScreenContainer: document.getElementById('v86-screen-container')
};

// ---------------- Toast Notifications ----------------
function showToast(message, type = 'info') {
    const colors = {
        info: 'bg-blue-600 text-white',
        success: 'bg-emerald-600 text-white',
        warning: 'bg-amber-600 text-white',
        error: 'bg-red-600 text-white'
    };
    const toast = document.createElement('div');
    toast.className = `toast px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center justify-between gap-3 ${colors[type] || colors.info}`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    el.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.25s ease';
        setTimeout(() => toast.remove(), 250);
    }, 4000);
}

function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

// ---------------- Theme Toggle ----------------
function syncThemeIcons() {
    const dark = document.documentElement.classList.contains('dark');
    el.themeIconLight.classList.toggle('hidden', !dark);
    el.themeIconDark.classList.toggle('hidden', dark);
}

el.themeToggle.addEventListener('click', () => {
    const dark = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', dark);
    localStorage.theme = dark ? 'dark' : 'light';
    syncThemeIcons();
});

// ---------------- Modal Helpers ----------------
function openModal(modal, content) {
    modal.classList.remove('pointer-events-none', 'opacity-0');
    if (content) {
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
    }
}

function closeModal(modal, content) {
    modal.classList.add('pointer-events-none', 'opacity-0');
    if (content) {
        content.classList.add('scale-95');
        content.classList.remove('scale-100');
    }
}

// ---------------- Binary Utilities ----------------
function matchesAt(haystack, offset, needle) {
    if (offset < 0 || offset + needle.length > haystack.length) return false;
    for (let i = 0; i < needle.length; i++) {
        if (haystack[offset + i] !== needle[i]) return false;
    }
    return true;
}

function indexOfBytes(haystack, needle, start = 0) {
    const limit = haystack.length - needle.length;
    const first = needle[0];
    for (let i = start; i <= limit; i++) {
        if (haystack[i] !== first) continue;
        let match = true;
        for (let j = 1; j < needle.length; j++) {
            if (haystack[i + j] !== needle[j]) {
                match = false;
                break;
            }
        }
        if (match) return i;
    }
    return -1;
}

function downloadBlob(bytes, filename) {
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------- Asset Loaders ----------------
async function loadMbrTemplate() {
    if (state.assetsCache.mbrTemplate) return state.assetsCache.mbrTemplate;
    const res = await fetch('assets/CustomMBR.bin');
    if (!res.ok) throw new Error(`Missing assets/CustomMBR.bin (HTTP ${res.status})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length !== MBR_SECTOR_SIZE) {
        throw new Error(`assets/CustomMBR.bin must be exactly 512 bytes (got ${bytes.length} bytes).`);
    }
    state.assetsCache.mbrTemplate = bytes;
    return bytes;
}

async function loadEfiTemplate() {
    if (state.assetsCache.efiTemplate) return state.assetsCache.efiTemplate;
    const res = await fetch('assets/bootx64.efi');
    if (!res.ok) throw new Error(`Missing assets/bootx64.efi (HTTP ${res.status})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    state.assetsCache.efiTemplate = bytes;
    return bytes;
}

async function loadExeTemplate() {
    if (state.assetsCache.exeTemplate) return state.assetsCache.exeTemplate;
    const res = await fetch('assets/CustomMBR.exe.zip');
    if (!res.ok) throw new Error(`Missing assets/CustomMBR.exe.zip (HTTP ${res.status})`);
    const zipBytes = await res.arrayBuffer();

    if (typeof JSZip === 'undefined') {
        throw new Error('JSZip failed to load from CDN.');
    }
    const zip = await JSZip.loadAsync(zipBytes);
    const exeEntry =
        zip.file('CustomMBR.exe') ||
        Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith('.exe'));

    if (!exeEntry) {
        throw new Error('No .exe file found inside assets/CustomMBR.exe.zip.');
    }

    const bytes = await exeEntry.async('uint8array');
    state.assetsCache.exeTemplate = bytes;
    return bytes;
}

// ---------------- Image Processing ----------------
function renderAndProcessImage() {
    if (!state.sourceImage) {
        el.previewCanvas.classList.add('hidden');
        el.resolutionBadge.classList.add('hidden');
        el.emptyState.classList.remove('hidden');

        state.imageData320x200 = null;
        state.compressedMbr = null;
        state.uefiBmp = null;
        state.mbrFits = false;
        updateStatsUI();
        return;
    }

    const ctx = el.previewCanvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = !el.crispResize.checked;
    ctx.clearRect(0, 0, DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT);
    ctx.drawImage(state.sourceImage, 0, 0, DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT);

    const imageData = ctx.getImageData(0, 0, DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT);
    state.imageData320x200 = imageData;

    // Show canvas
    el.emptyState.classList.add('hidden');
    el.previewCanvas.classList.remove('hidden');
    el.resolutionBadge.classList.remove('hidden');

    // Run ConvertBmp2Bin + CompressBin + 24-bit UEFI BMP build
    const { binData, paletteCount, totalUniqueColors } = convertImageDataToBin(imageData);
    const compressed = compressBin(binData);

    state.paletteCount = paletteCount;
    state.totalUniqueColors = totalUniqueColors;
    state.compressedMbr = compressed;
    state.mbrFits = Boolean(compressed && compressed.length <= MAX_COMPRESSED_MBR_PAYLOAD);
    state.uefiBmp = build24BitBmp(imageData);

    updateStatsUI();
}

function updateStatsUI() {
    const hasImage = Boolean(state.imageData320x200);
    const inputOverLimit = hasImage && state.sourceSizeBytes > MAXIMUM_IMAGE_SIZE;
    const mbrAllowed = hasImage && !inputOverLimit && state.mbrFits;

    el.btnExportUefi.disabled = !hasImage;
    el.btnExportMbr.disabled = !mbrAllowed;
    el.btnExportExe.disabled = !mbrAllowed;
    el.btnQemu.disabled = !mbrAllowed;

    if (!hasImage) {
        el.statDimensions.textContent = '—';
        el.statFilesize.textContent = '—';
        el.statColors.textContent = '—';
        el.statMbrSize.textContent = '—';
        el.statUefiSize.textContent = '—';
        el.mbrStatusBanner.classList.add('hidden');
        return;
    }

    const kb = (state.sourceSizeBytes / 1024).toFixed(1);

    el.statDimensions.textContent = `${state.sourceWidth}×${state.sourceHeight} → 320×200`;
    el.statFilesize.textContent = `${kb} KB`;
    el.statFilesize.className = `font-semibold text-xs ${inputOverLimit ? 'text-red-600 dark:text-red-400' : ''}`;

    el.statColors.textContent =
        state.totalUniqueColors > 255
            ? `${state.paletteCount} / 255 (${state.totalUniqueColors} quantized)`
            : `${state.paletteCount} / 255`;
    el.statUefiSize.textContent = `${state.uefiBmp.length.toLocaleString()} B`;

    if (state.compressedMbr) {
        const len = state.compressedMbr.length;
        el.statMbrSize.textContent = `${len.toLocaleString()} / ${MAX_COMPRESSED_MBR_PAYLOAD.toLocaleString()} B`;
        el.statMbrSize.className = `font-semibold text-xs ${state.mbrFits ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`;
    } else {
        el.statMbrSize.textContent = 'Compression failed';
        el.statMbrSize.className = 'font-semibold text-xs text-red-600 dark:text-red-400';
    }

    el.mbrStatusBanner.classList.remove('hidden');
    if (mbrAllowed) {
        el.mbrStatusBanner.className = 'mt-1 p-2.5 rounded text-xs font-sans bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50';
        el.mbrStatusBanner.textContent = 'Ready for MBR, UEFI, EXE export & QEMU preview.';
    } else {
        const reason = inputOverLimit
            ? `Input file (${kb} KB) exceeds the 100 KB limit for MBR/EXE.`
            : 'Compressed payload exceeds the 20 KB MBR/EXE limit.';
        el.mbrStatusBanner.className = 'mt-1 p-2.5 rounded text-xs font-sans bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 flex flex-col gap-1.5';
        el.mbrStatusBanner.innerHTML = `
            <span>${reason} <strong>Export UEFI</strong> still works with no limits.</span>
            <button id="btn-inline-guide" class="self-start underline font-semibold hover:opacity-80">Open Image Preparation Guide →</button>
        `;
        document.getElementById('btn-inline-guide')?.addEventListener('click', () => {
            openModal(el.guideModal, el.guideModalContent);
        });
    }
}

function validateMbrRequirements() {
    if (!state.imageData320x200) {
        showToast('Please load an image first.', 'error');
        return false;
    }
    if (state.sourceSizeBytes > MAXIMUM_IMAGE_SIZE) {
        const kb = (state.sourceSizeBytes / 1024).toFixed(1);
        showToast(`Image is too large (${kb} KB > 100 KB limit). Try making it under 20 KB.`, 'error');
        openModal(el.guideModal, el.guideModalContent);
        return false;
    }
    if (!state.mbrFits) {
        showToast('Failed to compress image under 19,968 bytes for MBR/EXE.', 'error');
        openModal(el.guideModal, el.guideModalContent);
        return false;
    }
    return true;
}

async function loadImageFromBlob(blob) {
    const url = URL.createObjectURL(blob);
    try {
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error('Unsupported or corrupted image file.'));
            img.src = url;
        });

        state.sourceImage = img;
        state.sourceWidth = img.naturalWidth;
        state.sourceHeight = img.naturalHeight;
        state.sourceSizeBytes = blob.size;
        renderAndProcessImage();
    } finally {
        URL.revokeObjectURL(url);
    }
}

async function loadDefaultImage() {
    try {
        const res = await fetch('assets/default.png');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        await loadImageFromBlob(blob);
    } catch (err) {
        console.warn('Could not load assets/default.png:', err);
        showToast('Could not load assets/default.png. Place it in assets/ or drop an image.', 'warning');
    }
}

// ---------------- Image Input Events ----------------
el.btnFile.addEventListener('click', () => el.imageFileInput.click());
el.imageFileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
        await loadImageFromBlob(file);
    } catch (err) {
        showToast(err.message, 'error');
    }
});

el.btnDefaultImg.addEventListener('click', loadDefaultImage);

el.btnClearImg.addEventListener('click', () => {
    state.sourceImage = null;
    state.sourceWidth = 0;
    state.sourceHeight = 0;
    state.sourceSizeBytes = 0;
    renderAndProcessImage();
});

el.crispResize.addEventListener('change', () => {
    if (state.sourceImage) renderAndProcessImage();
});

// Drag & Drop
el.imageContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.imageContainer.classList.add('border-blue-500', 'bg-blue-500/10');
});
el.imageContainer.addEventListener('dragleave', () => {
    el.imageContainer.classList.remove('border-blue-500', 'bg-blue-500/10');
});
el.imageContainer.addEventListener('drop', async (e) => {
    e.preventDefault();
    el.imageContainer.classList.remove('border-blue-500', 'bg-blue-500/10');
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showToast('Please drop an image file.', 'error');
        return;
    }
    try {
        await loadImageFromBlob(file);
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// Paste (Ctrl+V)
window.addEventListener('paste', async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
                try {
                    await loadImageFromBlob(file);
                } catch (err) {
                    showToast(err.message, 'error');
                }
            }
            break;
        }
    }
});

// Link Modal
el.btnLink.addEventListener('click', () => {
    el.linkInput.value = '';
    openModal(el.linkModal, el.linkModalContent);
    setTimeout(() => el.linkInput.focus(), 50);
});
el.btnCancelLink.addEventListener('click', () => closeModal(el.linkModal, el.linkModalContent));
el.linkModal.addEventListener('click', (e) => {
    if (e.target === el.linkModal) closeModal(el.linkModal, el.linkModalContent);
});

async function submitImageUrl() {
    const url = el.linkInput.value.trim();
    if (!url) return;
    closeModal(el.linkModal, el.linkModalContent);
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch URL (HTTP ${res.status})`);
        const blob = await res.blob();
        if (!blob.type.startsWith('image/')) {
            throw new Error('URL did not return an image.');
        }
        await loadImageFromBlob(blob);
    } catch (err) {
        showToast(`Could not load URL (may be blocked by CORS): ${err.message}`, 'error');
    }
}
el.btnSubmitLink.addEventListener('click', submitImageUrl);
el.linkInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitImageUrl();
});

// ---------------- Icon Picker (.ico) ----------------
el.btnChangeIcon.addEventListener('click', () => el.iconFileInput.click());

el.iconFileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (bytes.length < 6 || bytes[0] !== 0 || bytes[1] !== 0 || bytes[2] !== 1 || bytes[3] !== 0) {
            throw new Error('Invalid .ico file header.');
        }
        state.customIconBytes = bytes;
        el.iconFilename.textContent = file.name;

        const url = URL.createObjectURL(file);
        el.iconPreview.onload = () => URL.revokeObjectURL(url);
        el.iconPreview.src = url;
        el.iconPreview.classList.remove('hidden');
        el.iconPlaceholder.classList.add('hidden');
        showToast(`Loaded icon: ${file.name}`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
});

el.btnClearIcon.addEventListener('click', () => {
    state.customIconBytes = null;
    el.iconPreview.src = '';
    el.iconPreview.classList.add('hidden');
    el.iconPlaceholder.classList.remove('hidden');
    el.iconFilename.textContent = 'Default EXE icon';
});

// ---------------- Builders ----------------
async function buildMbrBytes() {
    if (!state.compressedMbr || !state.mbrFits) {
        throw new Error('Image must compress under 19,968 bytes for MBR.');
    }

    const mbrStub = await loadMbrTemplate();
    const out = new Uint8Array(MAXIMUM_MBR_SIZE); // 20 KB zero-padded
    out.set(mbrStub, 0);
    out.set(state.compressedMbr, MBR_SECTOR_SIZE);

    // Patch compressed image size at offsets 32, 37, 101 (little-endian WORD)
    const compLen = state.compressedMbr.length;
    out[COMP_SIZE_INDEX_1] = compLen & 0xFF;
    out[COMP_SIZE_INDEX_1 + 1] = (compLen >> 8) & 0xFF;
    out[COMP_SIZE_INDEX_2] = compLen & 0xFF;
    out[COMP_SIZE_INDEX_2 + 1] = (compLen >> 8) & 0xFF;
    out[COMP_SIZE_INDEX_3] = compLen & 0xFF;
    out[COMP_SIZE_INDEX_3 + 1] = (compLen >> 8) & 0xFF;

    return out;
}

async function buildUefiBytes() {
    if (!state.uefiBmp) {
        throw new Error('No image loaded.');
    }

    const efiTemplate = await loadEfiTemplate();
    const out = new Uint8Array(efiTemplate);

    let bmpOffset = indexOfBytes(out, MARKER_UEFI_FULL);
    if (bmpOffset === -1) {
        bmpOffset = indexOfBytes(out, MARKER_UEFI_SHORT);
    }
    if (bmpOffset === -1) {
        throw new Error('Could not locate BMP signature (42 4D 36 EE) inside assets/bootx64.efi.');
    }
    if (bmpOffset + state.uefiBmp.length > out.length) {
        throw new Error('Patched BMP exceeds bootx64.efi bounds.');
    }

    out.set(state.uefiBmp, bmpOffset);
    return out;
}

async function buildExeBytes() {
    const mbrBytes = await buildMbrBytes();
    const exeTemplate = await loadExeTemplate();
    let out = new Uint8Array(exeTemplate);

    let mbrAddr = MBR_CODE_ADDRESS;
    if (!matchesAt(out, mbrAddr, MARKER_MBR)) {
        const found = indexOfBytes(out, MARKER_MBR);
        if (found !== -1) mbrAddr = found;
    }

    let uefiAddr = UEFI_BMP_ADDRESS;
    if (!matchesAt(out, uefiAddr, MARKER_UEFI_SHORT)) {
        const found = indexOfBytes(out, MARKER_UEFI_FULL);
        if (found !== -1) uefiAddr = found;
        else {
            const foundShort = indexOfBytes(out, MARKER_UEFI_SHORT);
            if (foundShort !== -1) uefiAddr = foundShort;
        }
    }

    let endingAddr = ENDING_ADDRESS;
    if (!matchesAt(out, endingAddr, MARKER_ENDING)) {
        const found = indexOfBytes(out, MARKER_ENDING);
        if (found !== -1) endingAddr = found;
    }

    if (mbrAddr + mbrBytes.length > out.length) {
        throw new Error('MBR_CODE_ADDRESS out of bounds in CustomMBR.exe.');
    }
    if (uefiAddr + state.uefiBmp.length > out.length) {
        throw new Error('UEFI_BMP_ADDRESS out of bounds in CustomMBR.exe.');
    }
    if (endingAddr >= out.length) {
        throw new Error('ENDING_ADDRESS out of bounds in CustomMBR.exe.');
    }

    out.set(mbrBytes, mbrAddr);
    out.set(state.uefiBmp, uefiAddr);
    out[endingAddr] = el.endingSelect.value.charCodeAt(0);

    if (state.customIconBytes) {
        showToast('Applying custom icon to EXE...', 'info');
        const mod = await import('https://cdn.jsdelivr.net/npm/resedit@1.7.2/+esm');
        const ResEdit = mod.NtExecutable ? mod : mod.default;

        const exe = ResEdit.NtExecutable.from(out);
        const res = ResEdit.NtExecutableResource.from(exe);
        const iconFile = ResEdit.Data.IconFile.from(state.customIconBytes);
        const iconDataList = iconFile.icons.map((item) => item.data);

        const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
        if (groups.length > 0) {
            for (const g of groups) {
                ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
                    res.entries,
                    g.id,
                    g.lang,
                    iconDataList
                );
            }
        } else {
            ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
                res.entries,
                1,
                1033,
                iconDataList
            );
        }

        res.outputResource(exe);
        out = new Uint8Array(exe.generate());
    }

    return out;
}

// ---------------- Export Flow (with Educational Warning Modal) ----------------
function requestExport(type) {
    if ((type === 'mbr' || type === 'exe') && !validateMbrRequirements()) {
        return;
    }

    state.pendingExportType = type;
    if (type === 'mbr') {
        el.warningTargetFile.textContent = 'Target: CustomMBR.bin (20 KB MBR image)';
        el.warningExtraInfo.classList.add('hidden');
    } else if (type === 'uefi') {
        el.warningTargetFile.textContent = 'Target: bootx64.efi (UEFI application)';
        el.warningExtraInfo.classList.add('hidden');
    } else if (type === 'exe') {
        const endingLabel = el.endingSelect.options[el.endingSelect.selectedIndex].text;
        el.warningTargetFile.textContent = 'Target: CustomMBR.exe (Windows executable)';
        el.warningExtraInfo.textContent = `Ending: ${endingLabel} | Icon: ${el.iconFilename.textContent}`;
        el.warningExtraInfo.classList.remove('hidden');
    }
    openModal(el.warningModal, el.warningModalContent);
}

el.btnExportMbr.addEventListener('click', () => requestExport('mbr'));
el.btnExportUefi.addEventListener('click', () => requestExport('uefi'));
el.btnExportExe.addEventListener('click', () => requestExport('exe'));

el.btnCancelWarning.addEventListener('click', () => closeModal(el.warningModal, el.warningModalContent));
el.warningModal.addEventListener('click', (e) => {
    if (e.target === el.warningModal) closeModal(el.warningModal, el.warningModalContent);
});

el.btnConfirmExport.addEventListener('click', async () => {
    const type = state.pendingExportType;
    closeModal(el.warningModal, el.warningModalContent);
    if (!type) return;

    try {
        if (type === 'mbr') {
            const bytes = await buildMbrBytes();
            downloadBlob(bytes, 'CustomMBR.bin');
            showToast('Exported CustomMBR.bin', 'success');
        } else if (type === 'uefi') {
            const bytes = await buildUefiBytes();
            downloadBlob(bytes, 'bootx64.efi');
            showToast('Exported bootx64.efi', 'success');
        } else if (type === 'exe') {
            const bytes = await buildExeBytes();
            downloadBlob(bytes, 'CustomMBR.exe');
            showToast('Exported CustomMBR.exe', 'success');
        }
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Export failed.', 'error');
    }
});

// ---------------- Guide Modal ----------------
el.btnGuide.addEventListener('click', () => openModal(el.guideModal, el.guideModalContent));
el.btnCloseGuide.addEventListener('click', () => closeModal(el.guideModal, el.guideModalContent));
el.guideModal.addEventListener('click', (e) => {
    if (e.target === el.guideModal) closeModal(el.guideModal, el.guideModalContent);
});

// ---------------- QEMU (v86) Preview ----------------
function stopQemu() {
    if (state.emulator) {
        try {
            state.emulator.stop();
            state.emulator.destroy();
        } catch (_) {}
        state.emulator = null;
    }
}

async function startQemuPreview() {
    if (!validateMbrRequirements()) return;

    const V86Ctor = window.V86 || window.V86Starter;
    if (!V86Ctor) {
        showToast('v86 emulator failed to load from CDN.', 'error');
        return;
    }

    let mbrBytes;
    try {
        mbrBytes = await buildMbrBytes();
    } catch (err) {
        showToast(err.message, 'error');
        return;
    }

    stopQemu();

    el.v86ScreenContainer.innerHTML = `
        <div class="text-gray-300 p-4 w-full" style="white-space: pre; font: 14px monospace; line-height: 14px;"></div>
        <canvas style="display: none;"></canvas>
    `;

    el.qemuStatus.textContent = 'Booting BIOS...';
    openModal(el.qemuModal, el.qemuModalContent);

    // 1.44 MB floppy image (80 tracks * 2 heads * 18 sectors * 512 = 1,474,560 bytes)
    // Matches `qemu.exe -fda disk.img` in MBR_UEFI_Image_Builder.pas
    const floppyBuf = new ArrayBuffer(1440 * 1024);
    new Uint8Array(floppyBuf).set(mbrBytes, 0);

    state.emulator = new V86Ctor({
        wasm_path: `${V86_CDN}/v86.wasm`,
        memory_size: 32 * 1024 * 1024,
        vga_memory_size: 8 * 1024 * 1024,
        screen_container: el.v86ScreenContainer,
        bios: { url: `${BIOS_CDN}/seabios.bin` },
        vga_bios: { url: `${BIOS_CDN}/vgabios.bin` },
        fda: { buffer: floppyBuf },
        boot_order: 0x312,
        disable_keyboard: true,
        disable_mouse: true,
        disable_speaker: true,
        autostart: true
    });

    state.emulator.add_listener('emulator-ready', () => {
        el.qemuStatus.textContent = 'Running';
    });

    state.emulator.add_listener('screen-set-mode', (isGraphic) => {
        el.qemuStatus.textContent = isGraphic ? 'VGA Graphics' : 'BIOS Text';
    });

    state.emulator.add_listener('screen-set-size-graphical', ([w, h]) => {
        el.qemuStatus.textContent = `VGA ${w}×${h}`;
    });
}

el.btnQemu.addEventListener('click', startQemuPreview);
el.btnQemuRestart.addEventListener('click', startQemuPreview);

function closeQemuModal() {
    closeModal(el.qemuModal, el.qemuModalContent);
    stopQemu();
}
el.btnCloseQemu.addEventListener('click', closeQemuModal);
el.qemuModal.addEventListener('click', (e) => {
    if (e.target === el.qemuModal) closeQemuModal();
});

// ---------------- Init ----------------
syncThemeIcons();
loadDefaultImage();