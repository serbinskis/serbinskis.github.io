// Constants from MBR_UEFI_Note_Builder.pas
const MAX_TEXT_LENGTH = 3000;
const MAX_INPUT_BYTES = MAX_TEXT_LENGTH - 1; // Leave room for null terminator
const MBR_SECTOR_SIZE = 512;

// Offsets inside CustomMBR.bin (512-byte stub + 3000-byte text)
const BIN_MBR_COLOR_OFFSET = 0x40; // 64 (0x7AF04 - 0x7AD44 = 448 = 512 - 64)

// Offsets inside CustomMBR.exe
const EXE_ENDING_ADDRESS = 0x75E94;
const EXE_MBR_COLOR_ADDRESS = 0x7AD44;
const EXE_MBR_TEXT_ADDRESS = 0x7AF04;
const EXE_UEFI_COLOR_ADDRESS = 0x81834;
const EXE_UEFI_TEXT_ADDRESS = 0x84244;

// Marker inside bootx64.efi: L"EFIDebug\0Lang\0" (+32 bytes -> text, -0x2A10 -> color)
const MARKER_EFI_LANG = [
    0x45, 0x00, 0x46, 0x00, 0x49, 0x00, 0x44, 0x00,
    0x65, 0x00, 0x62, 0x00, 0x75, 0x00, 0x67, 0x00,
    0x00, 0x00,
    0x4C, 0x00, 0x61, 0x00, 0x6E, 0x00, 0x67, 0x00,
    0x00, 0x00
];
const EFI_MARKER_TO_TEXT_OFFSET = 32;
const EFI_TEXT_TO_COLOR_DELTA = EXE_UEFI_TEXT_ADDRESS - EXE_UEFI_COLOR_ADDRESS; // 0x2A10 (10,768)

const V86_CDN = 'https://cdn.jsdelivr.net/npm/v86@latest/build';
const BIOS_CDN = 'https://cdn.jsdelivr.net/gh/copy/v86@master/bios';

const DEFAULT_TEXT = [
    'Your computer has been trashed. Enjoy the view of a beautiful cat!',
    '',
    '',
    '       _',
    '       \\`*-.',
    '        )  _`-.',
    '       .  : `. .',
    '       : _   \'  \\',
    '       ; *` _.   `*-._',
    '       `-.-`          `-.',
    '         ;       `       `.',
    '         :.       .        \\',
    '         . \\  .   :   .-\'   .',
    '         \'  `+.;  ;  \'      :',
    '         :  \'  |    ;       ;-.',
    '         ; \'   : :`-:     _.`* ;',
    '      .*\' /  .*\' ; .*`- +\'  `*\'',
    '       `*-*   `*-*  `*-*\''
].join('\n');

// 16 CGA / BIOS Text Attribute Colors (exact RGB equivalents of TColor in MBR_UEFI_Note_Builder.pas)
const CGA_COLORS = [
    { hexChar: '0', name: 'Black',         css: '#000000' },
    { hexChar: '1', name: 'Blue',          css: '#0000AA' },
    { hexChar: '2', name: 'Green',         css: '#00AA00' },
    { hexChar: '3', name: 'Cyan',          css: '#00AAAA' },
    { hexChar: '4', name: 'Red',           css: '#AA0000' },
    { hexChar: '5', name: 'Magenta',       css: '#AA00AA' },
    { hexChar: '6', name: 'Brown',         css: '#AA5500' },
    { hexChar: '7', name: 'Light Gray',    css: '#AAAAAA' },
    { hexChar: '8', name: 'Dark Gray',     css: '#555555' },
    { hexChar: '9', name: 'Light Blue',    css: '#5555FF' },
    { hexChar: 'A', name: 'Light Green',   css: '#55FF55' },
    { hexChar: 'B', name: 'Light Cyan',    css: '#55FFFF' },
    { hexChar: 'C', name: 'Light Red',     css: '#FF5555' },
    { hexChar: 'D', name: 'Light Magenta', css: '#FF55FF' },
    { hexChar: 'E', name: 'Yellow',        css: '#FFFF55' },
    { hexChar: 'F', name: 'White',         css: '#FFFFFF' }
];

const state = {
    fgIndex: 15,             // 'F' (White)
    bgIndex: 0,              // '0' (Black)
    customIconBytes: null,
    pendingExportType: null, // 'mbr' | 'uefi' | 'exe'
    emulator: null,
    assetsCache: {
        mbrTemplate: null,
        efiTemplate: null,
        exeTemplate: null
    }
};

const el = {
    toastContainer: document.getElementById('toast-container'),
    themeToggle: document.getElementById('theme-toggle'),
    themeIconLight: document.getElementById('theme-icon-light'),
    themeIconDark: document.getElementById('theme-icon-dark'),

    noteEditor: document.getElementById('note-editor'),
    charCounter: document.getElementById('char-counter'),
    btnDefaultText: document.getElementById('btn-default-text'),
    btnClearText: document.getElementById('btn-clear-text'),

    fgColorSelect: document.getElementById('fg-color-select'),
    bgColorSelect: document.getElementById('bg-color-select'),
    fgColorHex: document.getElementById('fg-color-hex'),
    bgColorHex: document.getElementById('bg-color-hex'),
    fgSwatches: document.getElementById('fg-swatches'),
    bgSwatches: document.getElementById('bg-swatches'),

    iconPreview: document.getElementById('icon-preview'),
    iconPlaceholder: document.getElementById('icon-placeholder'),
    btnChangeIcon: document.getElementById('btn-change-icon'),
    btnClearIcon: document.getElementById('btn-clear-icon'),
    iconFileInput: document.getElementById('icon-file-input'),
    iconFilename: document.getElementById('icon-filename'),
    endingSelect: document.getElementById('ending-select'),

    statColorAttr: document.getElementById('stat-color-attr'),
    statMbrText: document.getElementById('stat-mbr-text'),
    statUefiText: document.getElementById('stat-uefi-text'),

    btnQemu: document.getElementById('btn-qemu'),
    btnExportMbr: document.getElementById('btn-export-mbr'),
    btnExportUefi: document.getElementById('btn-export-uefi'),
    btnExportExe: document.getElementById('btn-export-exe'),

    warningModal: document.getElementById('warning-modal'),
    warningModalContent: document.getElementById('warning-modal-content'),
    warningTargetFile: document.getElementById('warning-target-file'),
    warningExtraInfo: document.getElementById('warning-extra-info'),
    btnCancelWarning: document.getElementById('btn-cancel-warning'),
    btnConfirmExport: document.getElementById('btn-confirm-export'),

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
    toast.textContent = message;
    el.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.25s ease';
        setTimeout(() => toast.remove(), 250);
    }, 4000);
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

// ---------------- Text Normalization & Encoding ----------------
function sanitizeAsciiInput(str) {
    const stripped = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let out = '';
    for (let i = 0; i < stripped.length; i++) {
        const code = stripped.charCodeAt(i);
        if (code === 13) continue;
        out += code <= 127 ? stripped[i] : '?';
    }
    return out;
}

function getEncodedPayloadText() {
    let crlf = sanitizeAsciiInput(el.noteEditor.value).replace(/\n/g, '\r\n');
    if (crlf.length > MAX_INPUT_BYTES) {
        crlf = crlf.slice(0, MAX_INPUT_BYTES);
    }
    return crlf;
}

function enforceEditorSanitization() {
    const raw = el.noteEditor.value;
    const selStart = el.noteEditor.selectionStart;
    let clean = sanitizeAsciiInput(raw);

    while (clean.replace(/\n/g, '\r\n').length > MAX_INPUT_BYTES && clean.length > 0) {
        clean = clean.slice(0, -1);
    }

    if (clean !== raw) {
        el.noteEditor.value = clean;
        const clamped = Math.min(selStart, clean.length);
        el.noteEditor.setSelectionRange(clamped, clamped);
    }

    updateStatsUI();
}

function updateStatsUI() {
    const text = getEncodedPayloadText();
    const len = text.length;
    const hexByte = getColorByte();
    const hexStr = hexByte.toString(16).toUpperCase().padStart(2, '0');
    const fg = CGA_COLORS[state.fgIndex];
    const bg = CGA_COLORS[state.bgIndex];

    el.charCounter.textContent = `${len.toLocaleString()} / ${MAX_INPUT_BYTES.toLocaleString()} bytes`;
    el.statColorAttr.textContent = `0x${hexStr} (${fg.name} on ${bg.name})`;
    el.statMbrText.textContent = `${len.toLocaleString()} / ${MAX_INPUT_BYTES.toLocaleString()} B`;
    el.statUefiText.textContent = `${(len * 2).toLocaleString()} / ${(MAX_INPUT_BYTES * 2).toLocaleString()} B`;
}

// ---------------- Color Pickers ----------------
function getColorByte() {
    return (state.bgIndex << 4) | state.fgIndex;
}

function applyColors() {
    const fg = CGA_COLORS[state.fgIndex];
    const bg = CGA_COLORS[state.bgIndex];

    el.noteEditor.style.color = fg.css;
    el.noteEditor.style.backgroundColor = bg.css;

    el.fgColorSelect.value = String(state.fgIndex);
    el.bgColorSelect.value = String(state.bgIndex);
    el.fgColorHex.textContent = `${fg.hexChar} (${fg.css})`;
    el.bgColorHex.textContent = `${bg.hexChar} (${bg.css})`;

    Array.from(el.fgSwatches.children).forEach((btn, idx) => {
        btn.classList.toggle('ring-2', idx === state.fgIndex);
        btn.classList.toggle('ring-blue-500', idx === state.fgIndex);
        btn.classList.toggle('scale-110', idx === state.fgIndex);
    });
    Array.from(el.bgSwatches.children).forEach((btn, idx) => {
        btn.classList.toggle('ring-2', idx === state.bgIndex);
        btn.classList.toggle('ring-blue-500', idx === state.bgIndex);
        btn.classList.toggle('scale-110', idx === state.bgIndex);
    });

    updateStatsUI();
}

function initColorPickers() {
    CGA_COLORS.forEach((c, idx) => {
        const fgOpt = new Option(`${c.hexChar} - ${c.name}`, String(idx));
        const bgOpt = new Option(`${c.hexChar} - ${c.name}`, String(idx));
        el.fgColorSelect.add(fgOpt);
        el.bgColorSelect.add(bgOpt);

        const mkSwatch = (onClick) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.title = `${c.hexChar} - ${c.name} (${c.css})`;
            btn.className = 'h-6 rounded border border-gray-400/50 dark:border-gray-600 transition-transform cursor-pointer';
            btn.style.backgroundColor = c.css;
            btn.addEventListener('click', onClick);
            return btn;
        };

        el.fgSwatches.appendChild(mkSwatch(() => {
            state.fgIndex = idx;
            applyColors();
        }));
        el.bgSwatches.appendChild(mkSwatch(() => {
            state.bgIndex = idx;
            applyColors();
        }));
    });

    el.fgColorSelect.addEventListener('change', () => {
        state.fgIndex = Number(el.fgColorSelect.value);
        applyColors();
    });
    el.bgColorSelect.addEventListener('change', () => {
        state.bgIndex = Number(el.bgColorSelect.value);
        applyColors();
    });

    applyColors();
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

// ---------------- Builders ----------------
function writeAsciiBuffer(target, offset, text, bufferLen) {
    target.fill(0, offset, offset + bufferLen);
    const limit = Math.min(text.length, bufferLen - 1);
    for (let i = 0; i < limit; i++) {
        target[offset + i] = text.charCodeAt(i) & 0x7F;
    }
}

function writeUtf16LeBuffer(target, offset, text, byteLen) {
    target.fill(0, offset, offset + byteLen);
    const maxChars = Math.floor(byteLen / 2) - 1;
    const limit = Math.min(text.length, maxChars);
    for (let i = 0; i < limit; i++) {
        target[offset + i * 2] = text.charCodeAt(i) & 0x7F;
        target[offset + i * 2 + 1] = 0;
    }
}

async function buildMbrBytes() {
    const mbrStub = await loadMbrTemplate();
    const text = getEncodedPayloadText();
    const colorByte = getColorByte();

    const totalSize = Math.ceil((MBR_SECTOR_SIZE + MAX_TEXT_LENGTH) / MBR_SECTOR_SIZE) * MBR_SECTOR_SIZE;
    const out = new Uint8Array(totalSize);

    out.set(mbrStub, 0);
    out[BIN_MBR_COLOR_OFFSET] = colorByte;
    writeAsciiBuffer(out, MBR_SECTOR_SIZE, text, MAX_TEXT_LENGTH);

    return out;
}

async function buildUefiBytes() {
    const efiTemplate = await loadEfiTemplate();
    const out = new Uint8Array(efiTemplate);

    const markerPos = indexOfBytes(out, MARKER_EFI_LANG);
    if (markerPos === -1) {
        throw new Error('Could not locate EFIDebug/Lang marker inside assets/bootx64.efi.');
    }

    const textAddr = markerPos + EFI_MARKER_TO_TEXT_OFFSET;
    const colorAddr = textAddr - EFI_TEXT_TO_COLOR_DELTA;

    if (colorAddr < 0 || textAddr + MAX_TEXT_LENGTH * 2 > out.length) {
        throw new Error('UEFI text/color offsets out of bounds inside assets/bootx64.efi.');
    }

    const text = getEncodedPayloadText();
    out[colorAddr] = getColorByte();
    writeUtf16LeBuffer(out, textAddr, text, MAX_TEXT_LENGTH * 2);

    return out;
}

async function buildExeBytes() {
    const exeTemplate = await loadExeTemplate();
    let out = new Uint8Array(exeTemplate);

    const text = getEncodedPayloadText();
    const colorByte = getColorByte();

    if (EXE_UEFI_TEXT_ADDRESS + MAX_TEXT_LENGTH * 2 > out.length) {
        throw new Error('CustomMBR.exe offsets are out of bounds.');
    }

    out[EXE_ENDING_ADDRESS] = el.endingSelect.value.charCodeAt(0);
    out[EXE_MBR_COLOR_ADDRESS] = colorByte;
    writeAsciiBuffer(out, EXE_MBR_TEXT_ADDRESS, text, MAX_TEXT_LENGTH);
    out[EXE_UEFI_COLOR_ADDRESS] = colorByte;
    writeUtf16LeBuffer(out, EXE_UEFI_TEXT_ADDRESS, text, MAX_TEXT_LENGTH * 2);

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

// ---------------- Export Flow (with Educational Warning Modal) ----------------
function requestExport(type) {
    state.pendingExportType = type;
    if (type === 'mbr') {
        el.warningTargetFile.textContent = 'Target: CustomMBR.bin (MBR boot note)';
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
        <div></div>
        <canvas style="display: none;"></canvas>
    `;

    el.qemuStatus.textContent = 'Booting BIOS...';
    openModal(el.qemuModal, el.qemuModalContent);

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
        el.qemuStatus.textContent = isGraphic ? 'VGA Graphics' : 'VGA Text Mode';
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

// ---------------- Editor Events & Init ----------------
el.noteEditor.addEventListener('input', enforceEditorSanitization);

el.btnDefaultText.addEventListener('click', () => {
    el.noteEditor.value = DEFAULT_TEXT;
    enforceEditorSanitization();
});

el.btnClearText.addEventListener('click', () => {
    el.noteEditor.value = '';
    enforceEditorSanitization();
});

syncThemeIcons();
initColorPickers();
el.noteEditor.value = DEFAULT_TEXT;
enforceEditorSanitization();