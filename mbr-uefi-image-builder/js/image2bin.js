export const DEFAULT_IMAGE_WIDTH = 320;
export const DEFAULT_IMAGE_HEIGHT = 200;
export const MAXIMUM_IMAGE_SIZE = 100 * 1024;
export const MAXIMUM_MBR_SIZE = 20 * 1024;
export const MBR_SECTOR_SIZE = 512;
export const MAX_COMPRESSED_MBR_PAYLOAD = MAXIMUM_MBR_SIZE - MBR_SECTOR_SIZE; // 19,968 bytes

/**
 * Port of ConvertBmp2Bin from image2bin.pas
 * Converts 320x200 RGBA ImageData into palette-indexed binary format:
 * [1 byte colorCount][colorCount * 3 bytes (6-bit R,G,B)][64000 bytes pixel indices]
 */
export function convertImageDataToBin(imageData) {
    const { width, height, data } = imageData;
    const pixelCount = width * height;

    // 1. Count color occurrences
    const colorCounts = new Map();
    const pixelRGBs = new Uint32Array(pixelCount);

    for (let i = 0; i < pixelCount; i++) {
        const offset = i * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const rgb = (r << 16) | (g << 8) | b;
        pixelRGBs[i] = rgb;
        colorCounts.set(rgb, (colorCounts.get(rgb) || 0) + 1);
    }

    const totalUniqueColors = colorCounts.size;

    // 2. Sort descending by frequency and keep top 255 colors
    const sortedColors = Array.from(colorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 255)
        .map(entry => entry[0]);

    const colorCount = sortedColors.length;
    const paletteR = new Uint8Array(colorCount);
    const paletteG = new Uint8Array(colorCount);
    const paletteB = new Uint8Array(colorCount);

    for (let i = 0; i < colorCount; i++) {
        const rgb = sortedColors[i];
        paletteR[i] = (rgb >> 16) & 0xFF;
        paletteG[i] = (rgb >> 8) & 0xFF;
        paletteB[i] = rgb & 0xFF;
    }

    // 3. Allocate output stream: 1 + colorCount * 3 + pixelCount
    const out = new Uint8Array(1 + colorCount * 3 + pixelCount);
    let outIdx = 0;

    // Write color table count
    out[outIdx++] = colorCount;

    // Write 6-bit VGA DAC RGB palette values (div 4)
    for (let i = 0; i < colorCount; i++) {
        out[outIdx++] = paletteR[i] >> 2;
        out[outIdx++] = paletteG[i] >> 2;
        out[outIdx++] = paletteB[i] >> 2;
    }

    // 4. Map pixels to nearest palette color (with cache for speed)
    const nearestCache = new Map();
    for (let i = 0; i < colorCount; i++) {
        nearestCache.set(sortedColors[i], i);
    }

    for (let i = 0; i < pixelCount; i++) {
        const rgb = pixelRGBs[i];
        let bestIdx = nearestCache.get(rgb);

        if (bestIdx === undefined) {
            const r = (rgb >> 16) & 0xFF;
            const g = (rgb >> 8) & 0xFF;
            const b = rgb & 0xFF;

            bestIdx = 0;
            let bestDistSq = Infinity;

            for (let c = 0; c < colorCount; c++) {
                const dr = r - paletteR[c];
                const dg = g - paletteG[c];
                const db = b - paletteB[c];
                const distSq = dr * dr + dg * dg + db * db;
                if (distSq < bestDistSq) {
                    bestDistSq = distSq;
                    bestIdx = c;
                }
            }
            nearestCache.set(rgb, bestIdx);
        }

        out[outIdx++] = bestIdx;
    }

    return {
        binData: out,
        paletteCount: colorCount,
        totalUniqueColors
    };
}

/**
 * Port of CompressBin from image2bin.pas
 * LZ77 + literal run compression matching the 16-bit MBRCode decompressor.
 * Uses a 4-byte hash chain for instant browser performance while preserving exact tie-breaking.
 */
export function compressBin(buffer) {
    const BUFFER_SIZE = 65536;
    const LMIN = 4;
    const LMAX = 32767;
    const fsize = buffer.length;

    if (fsize <= 0 || fsize > BUFFER_SIZE) {
        return null;
    }

    const out = [];
    const literals = new Uint8Array(BUFFER_SIZE);
    let bi = 0;
    let pos = 0;

    // 4-byte hash table for O(1) candidate lookup within 32767-byte lookback window
    const HASH_BITS = 16;
    const HASH_SIZE = 1 << HASH_BITS;
    const HASH_MASK = HASH_SIZE - 1;
    const head = new Int32Array(HASH_SIZE).fill(-1);
    const prev = new Int32Array(BUFFER_SIZE).fill(-1);

    const hash4 = (idx) => {
        const v = (buffer[idx] << 24) ^ (buffer[idx + 1] << 16) ^ (buffer[idx + 2] << 8) ^ buffer[idx + 3];
        return ((v * 2654435761) >>> (32 - HASH_BITS)) & HASH_MASK;
    };

    const insertHash = (idx) => {
        if (idx + 3 < fsize) {
            const h = hash4(idx);
            prev[idx] = head[h];
            head[h] = idx;
        }
    };

    const flushLiterals = () => {
        let bs = 0;
        while (bi > 0) {
            const bx = bi > 128 ? 128 : bi;
            out.push(0x80 | (bx - 1));
            for (let k = 0; k < bx; k++) {
                out.push(literals[bs + k]);
            }
            bi -= bx;
            bs += bx;
        }
    };

    while (pos < fsize) {
        let ml = 0;
        let mp2 = 0;

        if (pos + 3 < fsize) {
            const h = hash4(pos);
            let pStart = head[h];
            const minP = pos > 32767 ? pos - 32767 : 0;

            while (pStart >= minP) {
                // Quick check on 4 bytes and current best length byte before full scan
                if (
                    buffer[pStart] === buffer[pos] &&
                    buffer[pStart + 1] === buffer[pos + 1] &&
                    buffer[pStart + 2] === buffer[pos + 2] &&
                    buffer[pStart + 3] === buffer[pos + 3]
                ) {
                    let l = 4;
                    while (l < LMAX && pos + l < fsize && buffer[pStart + l] === buffer[pos + l]) {
                        l++;
                    }
                    // Strictly > because backward scan visits largest pStart first (matching forward >=)
                    if (l > ml) {
                        ml = l;
                        mp2 = pos - pStart;
                        if (ml === LMAX || pos + ml === fsize) break;
                    }
                }
                pStart = prev[pStart];
            }
        }

        if (ml >= LMIN) {
            flushLiterals();

            if (ml < 64) {
                out.push(ml & 0xFF);
            } else {
                const ml3 = 0x4000 | ml;
                out.push((ml3 >> 8) & 0xFF);
                out.push(ml3 & 0xFF);
            }

            // Little-endian 16-bit distance
            out.push(mp2 & 0xFF);
            out.push((mp2 >> 8) & 0xFF);

            for (let k = 0; k < ml; k++) {
                insertHash(pos + k);
            }
            pos += ml;
        } else {
            literals[bi++] = buffer[pos];
            insertHash(pos);
            pos++;
        }
    }

    flushLiterals();
    return new Uint8Array(out);
}

/**
 * Converts 320x200 RGBA ImageData into a standard Windows 24-bit bottom-up BMP (192,054 bytes).
 * Header starts with 42 4D 36 EE 02 00 ("BM" + size 192054).
 */
export function build24BitBmp(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;

    const rowSize = Math.ceil((width * 3) / 4) * 4; // 960 bytes for width=320 (no padding)
    const pixelDataSize = rowSize * height;         // 192,000 bytes
    const headerSize = 54;
    const totalSize = headerSize + pixelDataSize;   // 192,054 bytes (0x0002EE36)

    const bmp = new Uint8Array(totalSize);
    const view = new DataView(bmp.buffer);

    // BITMAPFILEHEADER (14 bytes)
    bmp[0] = 0x42; // 'B'
    bmp[1] = 0x4D; // 'M'
    view.setUint32(2, totalSize, true);
    view.setUint32(6, 0, true);
    view.setUint32(10, headerSize, true);

    // BITMAPINFOHEADER (40 bytes)
    view.setUint32(14, 40, true);
    view.setInt32(18, width, true);
    view.setInt32(22, height, true); // positive = bottom-up
    view.setUint16(26, 1, true);
    view.setUint16(28, 24, true);
    view.setUint32(30, 0, true);     // BI_RGB
    view.setUint32(34, pixelDataSize, true);
    view.setInt32(38, 0, true);
    view.setInt32(42, 0, true);
    view.setUint32(46, 0, true);
    view.setUint32(50, 0, true);

    // BGR bottom-up pixels
    let dstOffset = headerSize;
    for (let y = height - 1; y >= 0; y--) {
        const rowStart = y * width * 4;
        for (let x = 0; x < width; x++) {
            const s = rowStart + x * 4;
            bmp[dstOffset++] = src[s + 2]; // B
            bmp[dstOffset++] = src[s + 1]; // G
            bmp[dstOffset++] = src[s];     // R
        }
    }

    return bmp;
}