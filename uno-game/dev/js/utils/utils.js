// @ts-check

import { UnoConfig } from '../config.js';
import { JoinRequestPayload } from '../packets.js';

export class UnoUtils {
    /**
     * Shuffles an array in place using the Fisher-Yates algorithm.
     * @param {Array<any>} array - The array to shuffle.
     * @returns {Array<any>} The shuffled array.
     */
    static shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Plays a sound effect
     * @param {string} name - Filename in resources/sounds/
     */
    static playSound(name) {
        const audio = new Audio(`resources/sounds/${name}`);
        audio.volume = 0.5;
        audio.play().catch(e => console.warn("Audio blocked:", e));
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
};