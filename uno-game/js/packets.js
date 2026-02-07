// @ts-check

import { UnoConfig } from './config.js';
import { GameManager } from './game.js';
import { NetworkManager } from './network.js';
import { UnoPlayer } from './player.js';
import { UnoUtils } from './utils/utils.js';

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

    /** Converts the packet to a JSON string.
     * @returns {string} The JSON string representation of the packet.
     */
    stringify() {
        return JSON.stringify(this.toJSON());
    }

    /**
     * Parses a JSON object or string into a Packet instance.
     * @param {any} packet - The JSON object to populate from.
     * @returns {Packet|null} The populated packet instance.
     */
    static parse(packet) {
        if (typeof packet === 'string') { try { packet = JSON.parse(packet); } catch (e) { console.warn('[Packet] Failed to parse packet data:', e); return null; } }
        if (!PACKET_REGISTRY[packet?.packetType]) { console.warn('[Packet] Trying to parse packet without type:', packet); return null; }
        if (!(packet instanceof Packet)) { packet = Packet.factory(packet); }
        return packet;
    }

    /**
     * Converts the JSON object to a packet.
     * @param {any} packet_obj
     * @returns {Packet} The JSON representation of the packet.
     */
    static factory(packet_obj) {
        let PacketClass = PACKET_REGISTRY[packet_obj.packetType];
        const packet = Object.create(PacketClass.prototype);
        Object.assign(packet, packet_obj);
        return packet;
    }

    /** Clones the packet.
     * @returns {this} The cloned packet.
     */
    clone() {
        return /** @type {this} */ (Packet.parse(this.stringify()));
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
        this.avatar = localStorage.getItem("avatar") || null;
        this.privateId = sessionStorage.getItem("privateId") || "";

        // Game settings from the DOM (with parsing)
        this.startCards = parseInt(this.getSettingValue('#start-cards'), 10) || UnoConfig.START_CARDS.default;
        this.maxPlayers = parseInt(this.getSettingValue('#max-players'), 10) || UnoConfig.MAX_PLAYERS.default;
        this.maxCards = parseInt(this.getSettingValue('#max-cards'), 10) || UnoConfig.MAX_CARDS.default;
        this.playerTime = parseInt(this.getSettingValue('#player-time'), 10); // This can be 0, means no player time
        this.playerTime = Number.isInteger(this.playerTime) ? this.playerTime : UnoConfig.PLAYER_TIME.default;

        // Boolean game rules from the DOM
        const isEnabled = (/** @type {string} */ value) => value.toLowerCase() === 'on' || value.toLowerCase() === 'yes';
        this.drawToMatch = isEnabled(this.getSettingValue('#draw-to-match')) || UnoConfig.DRAW_TO_MATCH;
        this.canStackCards = isEnabled(this.getSettingValue('#stack-cards')) || UnoConfig.CAN_STACK_CARDS;
        this.canJumpIn = isEnabled(this.getSettingValue('#jump-in')) || UnoConfig.CAN_JUMP_IN;
        this.canUno = isEnabled(this.getSettingValue('#can-uno')) || UnoConfig.CAN_UNO;
        this.canRejoin = isEnabled(this.getSettingValue('#can-rejoin')) || UnoConfig.CAN_REJOIN;
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
        return payload;
    }

    /**
     * Converts the JoinRequestPayload to an UnoPlayer instance.
     * @param {string} [peerId] - TODO
     * @returns {UnoPlayer} The UnoPlayer instance created from the validated payload.
     */
    toPlayer(peerId) {
        if (!this.privateId) { this.privateId = UnoUtils.randomUUID(); }
        if (peerId) { this.peerId = peerId; }

        let player = new UnoPlayer({
            privateId: this.privateId,
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

/** Represents the response payload sent by the host after processing a join request.
 * Only sent if there is an error or message to convey.
 */
export class JoinResponsePayload extends Packet {
    static PACKET = 'JOIN_RESPONSE'

    /** The response message containing code and message. @type {{ code: number, message: string }} */
    response;

    /** Creates a JoinResponsePayload object.
     * @param {{ code: number, message: string }} response - The response message.
     */
    constructor(response) {
        super(JoinResponsePayload.PACKET);
        this.response = { ...response };
    }

    getResponse() {
        return this.response;
    }
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

    /** Creates a HostDisconnectPayload payload.
     * @param {string} peerId - The ID of the disconnected host peer.
     * @param {string} reason - The reason for disconnection.   
     */
    constructor(peerId, reason = 'Host disconnected') {
        super(peerId, reason);
        this.packetType = HostDisconnectPayload.PACKET; // Override packet type
    }
}

export class PlayerDisconnectPayload extends PeerDisconnectPayload {
    static PACKET = 'PLAYER_DISCONNECT';

    /** @type {string} */ playerId = '';

    /** Creates a PlayerDisconnectPayload payload.
     * @param {UnoPlayer} player - The ID of the disconnected peer.
     */
    constructor(player) {
        super(player.getPeerId(), 'Player disconnected');
        this.packetType = PlayerDisconnectPayload.PACKET; // Override packet type
        this.playerId = player.getPlayerId();
    }

    getPlayer() {
        GameManager.getInstance().getPlayer(this.playerId);
    }

    validate() {
        return (this.getPlayer() != null);
    }
}

export class GameStatePayload extends Packet {
    static PACKET = 'GAME_STATE';

    //This is map of all GameManager properties
    /** @type {{ [key: string]: any }} */
    state = {};

    constructor() {
        super(GameStatePayload.PACKET);
    }

    /** Converts a GameManager instance into a GameStatePayload.
     * @param {GameManager} game - The game state to convert.
     * @param {boolean} avatar - Whether to include player avatars.
     * @param {string | null} peerId - Optional peer ID to exclude private IDs for other players.
     * @returns {GameStatePayload} The GameStatePayload instance created from the game state.
     */
    static fromGameState(game, avatar = true, peerId = null) {
        // TODO: Broadcast per player, to include their private IDs only to themselves
        // TODO: Broadcast per player, to include their private IDs only to themselves
        // TODO: Broadcast per player, to include their private IDs only to themselves

        let payload = new GameStatePayload();
        Object.entries(game).forEach(([key, value]) => { payload.state[key] = value; });
        Object.entries(new NetworkManager()).forEach(([key, value]) => { delete payload.state[key]; }); // Remove network properties
        const packetPacket = /** @type {GameStatePayload} */ (Packet.parse(payload.stringify())); // Deep clone to avoid mutating original game state
        const manager = packetPacket.getGameManager(packetPacket.getGameState()); // All this only to be sure data is duplicated correctly

        // Remove private IDs for security, except for the specified peerId, and remove avatars if not needed
        manager.getPlayers().forEach(player => {
            if (!peerId || (player.getPeerId() !== peerId)) { player.setPrivateId(null); }
            if (!avatar) { player.setAvatar(null); }
        });

        payload = new GameStatePayload(); // Now we can work on clean copy
        Object.entries(manager).forEach(([key, value]) => { payload.state[key] = value; });
        return payload;
    }

    /** Gets the game state stored in the payload.
     * @returns {{ [key: string]: any }} The game state.
     */
    getGameState() {
        return this.state;
    }

    /** Converts the payload back into a GameManager instance, only for reading.
     * @param {{ [key: string]: any }} [state] - Optional state to use instead of the payload's state.
     * @returns {GameManager} The READ-ONLY GameManager instance created from the payload.
     */
    getGameManager(state) {
        const gm = /** @type GameManager */ (Object.create(GameManager.prototype));
        Object.assign(gm, state || this.state);

        // Convert plain player objects back into UnoPlayer instances
        gm.getPlayers().forEach((objPlayer) => {
            const unoPlayer = /** @type UnoPlayer */ (Object.create(UnoPlayer.prototype));
            Object.assign(unoPlayer, objPlayer);
            gm.setPlayer(unoPlayer.getPlayerId(), unoPlayer);

            // Sync avatars from local players if exists to payload instance
            const localPlayer = GameManager.getInstance().getPlayer(unoPlayer.getPlayerId());
            if (localPlayer && localPlayer.getAvatar() && !unoPlayer.getAvatar()) { unoPlayer.setAvatar(localPlayer.getAvatar()); }
        });

        return gm;
    }
}

export class PlaceCardPayload extends Packet {
    static PACKET = 'PLACE_CARD';

    /** The ID of the card being placed. @type {string} */
    cardId;

    /** Creates a PlaceCardPayload object.
     * @param {string} cardId - The ID of the card being placed.
     */
    constructor(cardId) {
        super(PlaceCardPayload.PACKET);
        this.cardId = cardId;
    }

    getCardId() {
        return this.cardId;
    }
}

export class SaveCardPayload extends Packet {
    static PACKET = 'SAVE_CARD';

    /** The ID of the card being saved. @type {string} */
    cardId;

    /** Creates a SaveCardPayload object.
     * @param {string} cardId - The ID of the card being saved.
     */
    constructor(cardId) {
        super(SaveCardPayload.PACKET);
        this.cardId = cardId;
    }

    getCardId() {
        return this.cardId;
    }
}

export class DrawCardPayload extends Packet {
    static PACKET = 'DRAW_CARD';

    /** Creates a DrawCardPayload object. */
    constructor() {
        super(DrawCardPayload.PACKET);
    }
}

export class ChangeColorPayload extends Packet {
    static PACKET = 'CHANGE_COLOR';

    /** The chosen color. @type {string} */
    color;

    /** Creates a ChangeColorPayload object.
     * @param {string} color - The chosen color.
     */
    constructor(color) {
        super(ChangeColorPayload.PACKET);
        this.color = color;
    }

    /** Gets the chosen color.
     * @returns {string} The chosen color.
     */
    getColor() {
        return this.color;
    }
}

export class UnoPressPayload extends Packet {
    static PACKET = 'UNO_PRESS';

    /** Creates a UnoPressPayload object. */
    constructor() {
        super(UnoPressPayload.PACKET);
    }
}

export class KickPlayerPayload extends Packet {
    static PACKET = 'KICK_PLAYER';

    /** The ID of the player being kicked. @type {string} */
    playerId;
    /** The reason for the kick. @type {string} */
    reason;

    /** Creates a KickPlayerPayload object.
     * @param {string} playerId - The ID of the player being kicked.
     * @param {string} [reason] - The reason for the kick.
     */
    constructor(playerId, reason = 'Kicked by host') {
        super(KickPlayerPayload.PACKET);
        this.playerId = playerId;
        this.reason = reason;
    }

    /** Gets the ID of the player being kicked.
     * @returns {string} The ID of the player being kicked.
     */
    getPlayerId() {
        return this.playerId;
    }

    /** Gets the reason for the kick.
     * @returns {string} The reason for the kick.
     */

    getReason() {
        return this.reason;
    }
}

export const PACKET_REGISTRY = {
    [PeerConnectPayload.PACKET]: PeerConnectPayload,
    [PeerDisconnectPayload.PACKET]: PeerDisconnectPayload,
    [HostDisconnectPayload.PACKET]: HostDisconnectPayload,
    [JoinRequestPayload.PACKET]: JoinRequestPayload,
    [GameStatePayload.PACKET]: GameStatePayload,
    [JoinResponsePayload.PACKET]: JoinResponsePayload,
    [PlaceCardPayload.PACKET]: PlaceCardPayload,
    [SaveCardPayload.PACKET]: SaveCardPayload,
    [DrawCardPayload.PACKET]: DrawCardPayload,
    [ChangeColorPayload.PACKET]: ChangeColorPayload,
    [UnoPressPayload.PACKET]: UnoPressPayload,
    [KickPlayerPayload.PACKET]: KickPlayerPayload,
};

// For debugging purposes, expose all packets under window.Packets

(async () => {
    const mod = await import('./packets.js'); // @ts-ignore, line bellow
    window.Packets = { ...mod }; // Assign all exports to a single object on window
})();