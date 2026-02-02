// @ts-check

import { UnoConfig } from './config.js';
import { GameManager } from './game.js';
import { UnoPlayer } from './player.js';

export class Packet {
    /** The type of the packet. @type {string} */
    packetType;

    /**
     * @param {string} packetType
     */
    constructor(packetType) {
        this.packetType = packetType;
    }

    /**
     * Gets the type of the packet.
     * @returns {string} The packet type.
     */
    getPacketType() {
        return this.packetType;
    }

    /**
     * Converts the packet to a JSON object.
     * @returns {Object} The JSON representation of the packet.
     */
    toJSON() {
        return { ...this }
    }

    /**
     * Converts the JSON object to a packet.
     * @param {any} packet_obj
     * @returns {Packet} The JSON representation of the packet.
     */
    static parse(packet_obj) {
        let PacketClass = PACKET_REGISTRY[packet_obj.packetType];
        const packet = Object.create(PacketClass.prototype);
        Object.assign(packet, packet_obj);
        return packet;
    }

    /**
     * Override to validate packets on host
     * @returns {boolean} The validation result
     */
    validate() { return true; }
}

/**
 * Represents the data payload sent when a player initiates or joins a game.
 * Also represent player state used to update info about player
 * It encapsulates all the game settings and player information.
 */
export class JoinRequestPayload extends Packet {
    static EMPTY = new JoinRequestPayload("", "");
    static PACKET = 'JOIN_REQUEST';

    /** The invite code for the game lobby. @type {string} */
    invite;
    /** The player's chosen username. @type {string} */
    username;
    /** The player's avatar data in base64 PNG. @type {string | null} */
    avatar;
    /** The number of cards each player starts with. @type {number} */
    startCards;
    /** The maximum number of players allowed in the game. @type {number} */
    maxPlayers;
    /** The maximum number of cards a player can hold. @type {number} */
    maxCards;
    /** The time limit in seconds for a player's turn. @type {number} */
    playerTime;
    /** Rule: Whether a player must draw cards until they can play one. @type {boolean} */
    drawToMatch;
    /** Rule: Whether +2 and +4 cards can be stacked. @type {boolean} */
    canStackCards;
    /** Rule: Whether players can "jump in" out of turn with an identical card. @type {boolean} */
    canJumpIn;
    /** Rule: Whether players must call "UNO". @type {boolean} */
    canUno;
    /** Rule: Whether players can rejoin a game in progress. @type {boolean} */
    canRejoin;

    // ===========================
    // === Player state fields ===
    // ===========================

    /** @type {string | null} */ privateId;
    /** @type {string} */ playerId = '';
    /** @type {string} */ peerId = '';
    /** @type {null} */ cards = null; //TODO: Implement

    /**
     * Creates and populates a JoinRequestPayload object from the current UI state.
     * @param {string} invite - The game invite code.
     * @param {string} username - The player's username.
     */
    constructor(invite, username) {
        super(JoinRequestPayload.PACKET);
        this.invite = invite;
        this.username = username;

        // Data from Local Storage
        this.avatar = localStorage.getItem("avatar") || "";
        this.privateId = localStorage.getItem("privateId") || "";

        // Game settings from the DOM (with parsing)
        this.startCards = parseInt(this.getSettingValue('#start-cards'), 10) || UnoConfig.START_CARDS.default;
        this.maxPlayers = parseInt(this.getSettingValue('#max-players'), 10) || UnoConfig.MAX_PLAYERS.default;
        this.maxCards = parseInt(this.getSettingValue('#max-cards'), 10) || UnoConfig.MAX_CARDS.default;
        this.playerTime = parseInt(this.getSettingValue('#player-time'), 10) || UnoConfig.PLAYER_TIME.default;

        // Boolean game rules from the DOM
        const isEnabled = (/** @type {string} */ value) => value.toLowerCase() === 'on' || value.toLowerCase() === 'yes';
        this.drawToMatch = isEnabled(this.getSettingValue('#draw-to-match'));
        this.canStackCards = isEnabled(this.getSettingValue('#stack-cards'));
        this.canJumpIn = isEnabled(this.getSettingValue('#jump-in'));
        this.canUno = isEnabled(this.getSettingValue('#can-uno'));
        this.canRejoin = isEnabled(this.getSettingValue('#can-rejoin'));
    }

    /**
     * Populates the JoinRequestPayload fields from an existing UnoPlayer instance.
     * @param {UnoPlayer} player - The UnoPlayer instance to copy data from.
     * @param {boolean} avatar - TODO
     * @param {boolean} secret - TODO
     * @returns {JoinRequestPayload} The updated JoinRequestPayload instance.
     */
    static fromPlayer(player, avatar = false, secret = false) {
        let payload = new this("", player.getUsername());
        payload.playerId = player.getPlayerId();
        payload.peerId = player.peerId;
        if (secret) { payload.privateId = player.getPrivateId(); }
        payload.avatar = avatar ? player.getAvatar() : null;

        //TODO ENCRYPT CARDS

        return payload;
    }

    /**
     * Converts the JoinRequestPayload to an UnoPlayer instance.
     * @param {string} [peerId] - TODO
     * @returns {UnoPlayer} The UnoPlayer instance created from the validated payload.
     */
    toPlayer(peerId) {
        if (!this.privateId) { this.privateId = crypto.randomUUID(); }
        if (!this.peerId && peerId) { this.peerId = peerId; }

        let player = new UnoPlayer({
            privateId: this.privateId,
            playerId: this.playerId, // If null, it will by default hash private ID as public ID
            peerId: this.peerId,
            avatar: this.avatar,
            username: this.username,
        });

        return player;
    }

    /**
     * A helper function to safely query the DOM and get the inner HTML of a setting's state.
     * @param {string} selector - The CSS selector for the setting container (e.g., '#start-cards').
     * @returns {string} The inner HTML of the .setting-state element, or an empty string if not found.
     */
    getSettingValue = (selector) => {
        const element = document.querySelector(`${selector} .setting-state`);
        return element ? element.innerHTML.trim() : '';
    };
}

export class PeerConnectPayload extends Packet  {
    static PACKET = 'PEER_CONNECT';
    /** The ID of the connected peer. @type {string} */
    peerId;
    /** The timestamp of the connection. @type {number} */
    timestamp;

    /** Creates a ConnectPayload object.
     * @param {string} peerId - The ID of the connected peer.
     */
    constructor(peerId) {
        super(PeerConnectPayload.PACKET);
        this.peerId = peerId;
        this.timestamp = Date.now();
    }
}

export class PeerDisconnectPayload extends Packet {
    static PACKET = 'PEER_DISCONNECT';
    /** The ID of the disconnected peer. @type {string} */
    peerId;
    /** The reason for disconnection. @type {string} */
    reason;
    /** The timestamp of the disconnection. @type {number} */
    timestamp;

    /** Creates a DisconnectPayload object.
     * @param {string} peerId - The ID of the disconnected peer.
     * @param {string} reason - The reason for disconnection.   
     */
    constructor(peerId, reason = 'Connection closed') {
        super(PeerDisconnectPayload.PACKET);
        this.peerId = peerId;
        this.reason = reason;
        this.timestamp = Date.now();
    }
}

export class HostDisconnectPayload extends PeerDisconnectPayload {
    static PACKET = 'HOST_DISCONNECT';
}

export class PlayerDisconnectPayload extends PeerDisconnectPayload {
    static PACKET = 'PLAYER_DISCONNECT';

    /** @type {string} */ playerId = '';

    /** Creates a PlayerDisconnectPayload object.
     * @param {UnoPlayer} player - The ID of the disconnected peer.
     */
    constructor(player) {
        super(player.getPeerId());
        this.playerId = player.getPlayerId();
    }

    getPlayer() {
        GameManager.getInstance().getPlayer(this.playerId);
    }

    validate() {
        return (this.getPlayer() != null);
    }
}

export const PACKET_REGISTRY = {
    [PeerConnectPayload.PACKET]: PeerConnectPayload,
    [PeerDisconnectPayload.PACKET]: PeerDisconnectPayload,
    [HostDisconnectPayload.PACKET]: HostDisconnectPayload,
    [JoinRequestPayload.PACKET]: JoinRequestPayload,
};