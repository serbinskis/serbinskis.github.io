// @ts-check

import { GameStatePayload, HostDisconnectPayload, JoinRequestPayload, JoinResponsePayload, KickPlayerPayload, PeerDisconnectPayload } from './packets.js';
import { NetworkManager } from './network.js';
import { GameUI } from './scenes/game.js';
import { UnoUtils } from './utils/utils.js';
import { UnoConfig } from './config.js';

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

        this.on(HostDisconnectPayload, async (peerId, payload, game) => {
            //TODO: Migrate host to another player
        });

        this.on(JoinRequestPayload, async (peerId, payload, game) => {
            if (!this.isHost()) { return console.warn("[EventManager] Received JoinRequestPayload on client, ignoring."); }
            let validation = await UnoUtils.isJoinDataValid(payload);
            if (validation.code != 200) { return this.sendTo(peerId, new JoinResponsePayload(validation)); }

            let canRejoin = game.canPlayerRejoin(payload.privateId || "");
            if (game.isStarted() && !canRejoin) { return this.sendTo(peerId, new JoinResponsePayload(UnoConfig.ERROR_CODES['1002.0'])); }
            if (game.getOnline(false) >= game.getMaxPlayers()) { return this.sendTo(peerId, new JoinResponsePayload(UnoConfig.ERROR_CODES['1003.0'])); }

            if (!canRejoin) { payload.privateId = null; } // New player, reset private ID
            game.addPlayer(payload.toPlayer(peerId)); // Add player
        });

        // If join failed, show message to user
        this.on(JoinResponsePayload, async (peerId, payload, game) => {
            if (this.isHost()) { return console.warn("[EventManager] Received JoinResponsePayload on host, ignoring."); }
            if (payload?.getResponse()?.message) { alert(`${payload.getResponse().message}`); }
        });

        // Malicious clients also can send this to host, so only non-hosts should process it
        this.on(GameStatePayload, async (peerId, payload, game) => {
            if (!this.isHost()) { game.fromPacket(payload); }
            if (!this.isHost()) { localStorage.setItem('privateId', String(game.getPrivateId(game.getPeerId()))); } // Yes this can be null, but I DONT CARE
            if (!this.isHost() || (peerId == game.getPeerId())) { GameUI.showGameScene(); }
            if (!this.isHost() || (peerId == game.getPeerId())) { GameUI.render(); }
        });

        this.on(KickPlayerPayload, async (peerId, payload, game) => {
            if (!this.isHost()) {
                if (payload.getPlayerId() !== game?.getPeerPlayer(game.getPeerId())?.getPlayerId()) { return; } // Check if this kick is for us
                alert(`You have been kicked from the game. Reason: ${payload.getReason()}`);
                location.reload();
            } else {
                if (peerId != game.getPeerId()) { return; } // Check who sent the kick request, only proccess self payload
                if (game.getMyPlayer()?.getPlayerId() === payload.getPlayerId()) { return; } // Host cannot kick self
                let player = game.getPlayer(payload.getPlayerId()); // Get player to be kicked
                if (!player) { return console.warn(`[EventManager] Host received KickPlayerPayload for non-existing player ID ${payload.getPlayerId()}`); }
                game.removePlayer(player.getPlayerId());
            }
        });
    }
}