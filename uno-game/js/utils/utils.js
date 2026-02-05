// @ts-check

import { UnoConfig } from '../config.js';
import { JoinRequestPayload } from '../packets.js';

export class UnoUtils {
    static { // @ts-ignore
        window.UnoUtils = UnoUtils;
    }

    /** Generates a random UUID.
     * @returns {string} A random UUID.
     */
    static randomUUID() {
        return crypto.randomUUID();
    }

    /** Reverses a given string.
     * @param {string|null} str - The string to reverse.
     * @returns {string|null} The reversed string.
     */
    static reverse(str) {
        if (!str) { return str; }
        return str.split('').reverse().join('');
    }

    /**
     * Generates a random integer between min and max (inclusive).
     * @param {number} min - The minimum integer value.
     * @param {number} max - The maximum integer value.
     * @returns {number} A random integer between min and max.
     */
    static randomRange(min, max) {
        return Math.floor(Math.random()*(max-min+1)+min);
    }

    /**
     * Simple hash for private ID hashing
     * @param {string} str
     * @returns {string} base36 public ID
     */
    static hashString(str) {
        let hash = 1469598103934665603n; // arbitrary seed
        const prime = 1099511628211n;

        for (let i = 0; i < str.length; i++) {
            hash ^= BigInt(str.charCodeAt(i));
            hash *= prime;
            hash %= 2n ** 128n; // force information loss (important)
        }

        return hash.toString(36);
    }

    /** Converts a string to a Uint8Array of bytes.
     * @param {string} str - The input string.
     * @returns {Uint8Array} The resulting byte array.
     */
    static strToBytes(str) {
        const bytes = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
        return bytes;
    }

    /** Encrypts a string using a simple XOR cipher with the provided key.
     * @param {string} str - The string to encrypt.
     * @param {string} key - The encryption key.
     * @returns {string} The encrypted string in Base64 format.
     */
    static encryptString(str, key) {
        const encoder = new TextEncoder();
        const strBytes = encoder.encode(str); // UTF-8
        const keyBytes = encoder.encode(key);

        const out = new Uint8Array(strBytes.length);
        for (let i = 0; i < strBytes.length; i++) {
            out[i] = strBytes[i] ^ keyBytes[i % keyBytes.length];
        }

        return btoa(String.fromCharCode(...out)); // Base64 safe
    }

    /** Decrypts a string that was encrypted using the XOR cipher with the provided key.
     * @param {string} encrypted - The encrypted string in Base64 format.
     * @param {string} key - The decryption key.
     * @returns {string} The decrypted string.
     */
    static decryptString(encrypted, key) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const keyBytes = encoder.encode(key);

        const encBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
        const out = new Uint8Array(encBytes.length);
        for (let i = 0; i < encBytes.length; i++) {
            out[i] = encBytes[i] ^ keyBytes[i % keyBytes.length];
        }

        return decoder.decode(out);
    }

    /**
     * Creates a base64 PNG avatar by resizing an input image and compositing it with a frame.
     *
     * @param {ArrayBuffer} input - The source image ArrayBuffer.
     * @param {number} [avatarSize=104] - The width and height to resize the avatar to.
     * @param {string} [frameUrl='/resources/frame.png'] - URL of the frame image to overlay.
     * @returns {Promise<string>} A promise that resolves with the base64 PNG string of the composited avatar.
     */
    static async createAvatar(input, avatarSize = 104, frameUrl) {
        return new Promise(async (resolve, reject) => {
            // Load frame image
            let frameImg = new Image();
            frameImg.onerror = reject;
            frameImg.src = frameUrl || UnoConfig.FRAME_LOCATION;
            await new Promise((res) => { frameImg.onload = res });

            // Load avatar image
            let avatarImg = new Image();
            avatarImg.onerror = reject;
            avatarImg.src = URL.createObjectURL(new Blob([input], { type: 'image/jpeg' }));
            await new Promise((res) => { avatarImg.onload = res });

            // Draw avatar and frame onto canvas
            let canvas = document.createElement('canvas');
            let ctx = canvas.getContext('2d');
            canvas.width = frameImg.width;
            canvas.height = frameImg.height; // @ts-ignore
            ctx.clearRect(0, 0, canvas.width, canvas.height); // @ts-ignore
            ctx.drawImage(avatarImg, 13, 13, avatarSize, avatarSize); // @ts-ignore
            ctx.drawImage(frameImg, 0, 0);
            resolve(canvas.toDataURL('image/png')); // Return base64 PNG
        });
    }

    /**
     * Ensures a value is not null or undefined.
     *
     * @template T
     * @param {T | null | undefined} value
     * @param {string} [message]
     * @returns {T}
     * @throws {TypeError}
     */
    static requireNotNull(value, message = 'Value must not be null or undefined') {
        if (value == null) { throw new TypeError(message); }
        return value;
    }

    /**
     * Validates if the provided avatar is valid.
     * @param {string|null|undefined} avatar - The avatar data (base64 string).
     * @returns {Promise<boolean>} Error object if invalid, otherwise undefined.
     */
    static async isAvatarValid(avatar) {
        if (avatar == null) { return true; } // Allow null or undefined
        if (typeof avatar !== 'string') { return false } // Must be a string
        if (!avatar.match(UnoConfig.AVATAR_REGEX)) { return false; } // Invalid image format
        if (avatar.length > UnoConfig.AVATAR_MAX_SIZE) { return false; } // Avatar too large

        // Check if image can be loaded
        try {
            await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(true);
                img.onerror = () => reject(false);
                img.src = avatar;
            });
        } catch {
            return false; // Image could not be loaded
        }

        return true; // All checks passed
    }

    /** Validates if the provided JoinRequestPayload data is well-formed.
     * @param {JoinRequestPayload} data - The data to validate.
     * @returns {Promise<{ code: number, message: string }>} An error object if invalid, otherwise undefined.
     */
    static async isJoinDataValid(data) {
        //Check if username is string and does match
        if ((typeof data?.username !== 'string') || !data.username.match(UnoConfig.USERNAME_REGEX)) {
            return UnoConfig.ERROR_CODES['1004.0'];
        }

        //Check if invite is string and does match, it also can be empty for creating game
        if ((data?.invite != null) && (typeof data.invite !== 'string' || !data.invite.match(UnoConfig.INVITE_REGEX))) {
            return UnoConfig.ERROR_CODES['1005.0'];
        }

        // Check if avatar is a string if it is valid, can be null or undefined
        if (!await this.isAvatarValid(data.avatar)) {
            return UnoConfig.ERROR_CODES['1006.0']; // Make sure to define a suitable error code for invalid avatar
        }

        return UnoConfig.ERROR_CODES['200.0'];
    }

    /**
     * Preloads all card images (png + gif) defined in UnoConfig.
     *
     * @param {string} [basePath='/resources/cards'] - The base path where card images are located.
     */
    static preloadAssets(basePath = `${window.location.href}/resources/cards`) {
        const cards = [...UnoConfig.CARDS.standart, ...UnoConfig.CARDS.special];
        const normal = cards.map(card => `${basePath}/${card.color}_${card.type}.png`);
        normal.push(`${basePath}/${UnoConfig.CARDS.cover.type}.png`); // Add cover card

        const animated = UnoConfig.CARDS.special.filter(card => card.color.includes("ANY")).map(card => {
            return UnoConfig.COLORS.map(color => `${basePath}/gifs/${color}_${card.type}.gif`);
        }).flat();

        [...normal, ...animated].forEach(url => { new Image().src = url; });
    }
};