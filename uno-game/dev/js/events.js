// @ts-check

import { GameStatePayload, JoinRequestPayload, PeerDisconnectPayload } from './packets.js';
import { NetworkManager } from './network.js';
import { GameUI } from './scenes/game.js';
import { UnoUtils } from './utils/utils.js';

export class EventManager extends NetworkManager {
    constructor() {
        super(); // @ts-ignore, line bellow
        window.events = this; // For debugging purposes

        // All events should only be executed as host or client
        // If request somehow are being sent from other clients
        // They should be ignored in underlying manager, each
        // request contains corresponding peerId of sender, which
        // should not be possible to fake

        // If tab is closed not reloaded this deosn't fire for some reason, fixed with heartbeat method
        // This runs on client and host, because host in network manager automatically boradcasts to all clients
        this.on(PeerDisconnectPayload, async (peerId, payload, game) => {
            if (!this.isHost()) { return console.warn("[EventManager] Received PeerDisconnectPayload on client, ignoring."); }
            let player = game.getPeerPlayer(peerId);
            if (!player) { return console.warn(`[EventManager] Peer[${peerId}] disconnected without being a player.`); }
            game.removePlayer(player.getPlayerId());
        });

        this.on(JoinRequestPayload, async (peerId, payload, game) => {
            if (!this.isHost()) { return console.warn("[EventManager] Received JoinRequestPayload on client, ignoring."); }
            if (!await UnoUtils.isJoinDataValid(payload)) { return; }

            //TODO Add lobby capacity check
            //TODO Add kick check
            //TODO Add started game check

            game.addPlayer(payload.toPlayer(peerId)); // Add player
        });

        // Malicious clients also can send this to host, so only non-hosts should process it
        this.on(GameStatePayload, async (peerId, payload, game) => {
            if (!this.isHost()) { game.fromPacket(payload); }
            if (!this.isHost() || (peerId == game.getPeerId())) { GameUI.showGameScene(); }
            if (!this.isHost() || (peerId == game.getPeerId())) { GameUI.render(); }
        });
    }
}