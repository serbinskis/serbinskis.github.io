//@ts-check

import { UnoConfig } from './config.js';
import { Timer } from './utils/timers.js';
import { UnoUtils } from './utils/utils.js';

export class UnoPlayer {
    /**
     * A static object that holds all players by their player_id.
     * @type {Object<string, UnoPlayer>}
     */
    static players = {};

    /**
     * Player's private ID for reconnections and decryption.
     * @type {string | null}
     */
    privateId = null;

    /**
     * The unique ID of the player.
     * @type {string}
     */
    playerId;

    /**
     * The unique ID of the peer connection.
     * @type {string}
     */
    peerId;

    /**
     * The avatar of the player.
     * @type {string | null}
     */
    avatar;

    /**
     * The username of the player.
     * @type {string}
     */
    username;

    /**
     * The number of cards the player has.
     * @type {number}
     */
    cardCount = 0;

    /**
     * Whether the player has left the game.
     * @type {boolean}
     */
    left = false;

    /**
     * Whether the player has disconnected.
     * @type {boolean}
     */
    disconnected = false;

    /**
     * The time when the player disconnected.
     * @type {number}
     */
    disconnectTime = 0;

    /**
     * The timer for handling disconnection timeouts.
     * @type {number|string|null}
     */
    disconnectTimer = null;

    /**
     * Creates an instance of UnoPlayer.
     * @param {Object} opts - The options for the player.
     * @param {string} opts.privateId - The private ID of the player.
     * @param {string} opts.peerId - The public ID of the player connection.
     * @param {string | null} opts.avatar - The avatar of the player.
     * @param {string} opts.username - The username of the player.
     */
    constructor(opts) {
        this.privateId = opts.privateId;
        this.playerId = UnoUtils.hashString(opts.privateId);
        this.peerId = opts.peerId;
        this.avatar = opts.avatar;
        this.username = opts.username;
        if (!this.peerId) { alert("[DEV ERROR]: UnoPlayer.peerId -> null"); }
        UnoPlayer.players[this.playerId] = this;
    }

    /**
     * Gets the time when the player disconnected.
     * @returns {number} The disconnect time of the player.
     */
    getDisconnectTime() {
        return this.disconnectTime;
    }

    /**
     * Marks the player as disconnected.
     * @param {Function | null} cb - The callback to execute after disconnection time expires.
     */
    disconnectPlayer(cb = null) {
        this.disconnected = true;
        this.disconnectTime = Date.now();
        this.disconnectTimer = Number(Timer.start(() => cb && cb(), UnoConfig.REJOIN_TIME)); // After timeout, execute callback (e.g., remove player)
    }

    /**
     * Marks the player as reconnected.
     */
    setReconnected() {
        if (this.disconnectTimer != null) { Timer.stop(this.disconnectTimer); }
        this.disconnected = false;
        this.disconnectTime = 0;
        this.disconnectTimer = null;
    }

    /**
     * Checks if the player has left the game.
     * This is different from being disconnected, if a player is disconnected they can still rejoin.
     * But if they have left, they cannot rejoin. This also works as kick.
     * @returns {boolean} True if the player has left, false otherwise.
     */
    isLeft() {
        return this.left;
    }

    /**
     * Sets the player's "left" status.
     * @param {boolean} left - Whether the player has left the game.
     * @returns {boolean} The updated "left" status of the player.
     */
    setLeft(left) {
        return this.left = left;
    }

    /**
     * Checks if the player is disconnected.
     * @returns {boolean} True if the player is disconnected, false otherwise.
     */
    isDisconnected() {
        return this.disconnected;
    }

    /**
     * Gets the player's unique ID.
     * @returns {string} The player's ID.
     */
    getPlayerId() {
        return this.playerId;
    }

    /**
     * Sets the player's unique peer ID.
     * @param {string} peerId - The new peer ID for the player.
     */
    setPeerId(peerId) {
        this.peerId = peerId;
    }

    /**
     * Gets the player's unique peer ID.
     * @returns {string} The player's peer ID.
     */
    getPeerId() {
        return this.peerId;
    }

    /**
     * Gets the player's private ID for reconnections.
     * @returns {string | null} The player's private ID.
     */
    getPrivateId() {
        return this.privateId;
    }

    /**
     * Sets the player's private ID for reconnections.
     * @param {string|null} privateId - The new private ID for the player.
     */
    setPrivateId(privateId) {
        this.privateId = privateId;
    }

    /**
     * Gets the player's username.
     * @returns {string} The player's username.
     */
    getUsername() {
        return this.username;
    }

    /**
     * Sets the player's avatar.
     * @param {string | null} avatar - The new avatar for the player.
     */
    setAvatar(avatar) {
        this.avatar = avatar;
    }

    /**
     * Gets the player's avatar in base64.
     * @returns {string | null} The player's avatar.
     */
    getAvatar() {
        return this.avatar;
    }

    /**
     * Checks if the player is online.
     * @param {boolean} includeDisconnected - Whether to include disconnected players.
     * @returns {boolean} True if the player is online, false otherwise.
     */
    isOnline(includeDisconnected) {
        return includeDisconnected ? (!this.left && !this.disconnected) : !this.left;
    }

    /**
     * Gets the number of cards the player currently has.
     * @returns {number} The number of cards the player has.
     */
    getCardCount() {
        return this.cardCount;
    }

    /**
     * Sets the number of cards the player has.
     * @param {number} cardCount - The new card count for the player.
     * @returns {number} The updated card count of the player.
     */
    setCardCount(cardCount) {
        return this.cardCount = cardCount;
    }
}
