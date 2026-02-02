// @ts-check

import { JoinRequestPayload, PeerConnectPayload, PeerDisconnectPayload } from './packets.js';
import { NetworkManager } from './network.js';
import { GameUI } from './scenes/game.js';
import { UnoUtils } from './utils/utils.js';

export class EventManager extends NetworkManager {
    constructor() {
        super();

        // All events should only be executed as host or client
        // If request somehow are being sent from other clients
        // They should be ignored in underlying manager, each
        // request contains corresponding peerId of sender, which
        // should not be possible to fake

        this.on(PeerConnectPayload, async (peerId, payload, game) => {

        });

        // IF tab is closed not reloaded this doesnt fire for some reason
        this.on(PeerDisconnectPayload, async (peerId, payload, game) => {
            let player = game.getPeerPlayer(peerId);
            if (!player) { return console.warn(`[EventManager] Peer[${peerId}] disconnected without being a player.`); }
            game.removePlayer(player.getPlayerId());
        });

        this.on(JoinRequestPayload, async (peerId, payload, game) => {
            let player;

            if (this.isHost()) {
                if (!await UnoUtils.isJoinDataValid(payload)) { return; }

                // publicId -> Doesn't change, is hashed privateId
                // privateId -> Doesn't change, used to encrypt desk data
                // peerId -> Changes, used for communication

                player = game.addPlayer(payload.toPlayer(peerId));
                this.broadcast(JoinRequestPayload.fromPlayer(player, true));

                //TODO SYNC NEW PEER WITH GAME STATE
            } else {
                player = game.addPlayer(payload.toPlayer());
                console.warn("Received JoinRequestPayload on client, ignoring.");
            }

            GameUI.showGameScene();
            GameUI.render();
        });
    }
}