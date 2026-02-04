// @ts-check

import { ChangeColorPayload, DrawCardPayload, GameStatePayload, HostDisconnectPayload, JoinRequestPayload, JoinResponsePayload, KickPlayerPayload, PeerDisconnectPayload, PlaceCardPayload, SaveCardPayload } from './packets.js';
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
            this.handlePacket(this.getPeerId(), new KickPlayerPayload(this.getPeerId(), 'Host left the game'));

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
            if (this.isHost()) {
                if (peerId != game.getPeerId()) { return; } // Check who sent the kick request, only proccess self payload
                if (game.getMyPlayer()?.getPlayerId() === payload.getPlayerId()) { return; } // Host cannot kick self
                let player = game.getPlayer(payload.getPlayerId()); // Get player to be kicked
                if (!player) { return console.warn(`[EventManager] Host received KickPlayerPayload for non-existing player ID ${payload.getPlayerId()}`); }
                game.removePlayer(player.getPlayerId());
            } else {
                if ((peerId != game.getOwnerId()) && (peerId != this.getPeerId())) { return } // Only accept kick from owner and self
                if (payload.getPlayerId() !== game.getPeerPlayer(game.getPeerId())?.getPlayerId()) { return; } // Check if this kick is for us
                alert(`You have been kicked from the game. Reason: ${payload.getReason()}`);
                location.reload();
            }
        });

        // perrId indicates who placed sent the request
        this.on(PlaceCardPayload, async (peerId, payload, game) => {
            if (!this.isHost()) { return console.warn("[EventManager] Received PlaceCardPayload on client, ignoring."); }

            // Game must be started, not choosing color, player must exist
            let player = game.getPeerPlayer(peerId);
            if (!game.isStarted() || game.isChoosingColor() || !player) { return; }

            // If turn delay is inactive, only current player can play
            if (!game.getTurnDelay() && (game.getCurrentPlayerId() != player.getPlayerId())) { return; }

            // Check if player has the card
            let card = game.getPlayerCard(player.getPlayerId(), payload.getCardId());
            if (!card) { return; }

            // When jump-in you interrupt another player's turn
            // And you can stil play your turn as normal after that
            // So technically without stacking you can place 2 cards
            // NOTE: You cannot jump-in on yourself

            let isJumpIn = (game.getCurrentPlayerId() != player.getPlayerId());

            if (game.getTurnDelay()) {
                // TODO: Check if stacking or jump-in is allowed
                //var jump_in = ((room.getCurrentMove() != player.getId()) && room.canJumpIn()); //Check if player can jump in
                //var card_color = (card.color != 'ANY') ? card.color : room.getCurrentCard().color;
                //if (!(room.canStackCards() || jump_in) || (card_color != room.getCurrentCard().color) || (card.type != room.getCurrentCard().type)) { return; }
            }

            if (isJumpIn) {
                // TODO: Handle jump-in logic (skip current player, etc.)
            }

            let canPlayInfo = game.canPlayCard(card);
            if (!canPlayInfo.canPlay) { return; }

            game.setCurrentCard(card);
            game.setCurrentPlayerId(player.getPlayerId()); // In case of jump-in
            game.setStack(game.getStack() + (canPlayInfo.stack || 0));
            game.removeCard(payload.getCardId());
            game.setChoosingCardId(null);
            game.broadcastGameState();
            game.startTurnDelay(game.getCurrentPlayerId(), 1);
        });

        this.on(ChangeColorPayload, async (peerId, payload, game) => {
            if (!this.isHost()) { return console.warn("[EventManager] Received ChangeColorPayload on client, ignoring."); }
            if (!UnoConfig.COLORS.includes(payload.getColor())) { return console.warn(`[EventManager] Received invalid color ${payload.getColor()} in ChangeColorPayload, ignoring.`); }

            let player = game.getPeerPlayer(peerId);
            if (!player) { return console.warn(`[EventManager] Received ChangeColorPayload from non-player Peer[${peerId}], ignoring.`); }
            
            // Game must be started, player must be current player, and must be choosing color
            if (!game.isStarted() || !game.isChoosingColor() || game.getTurnDelay() || (game.getCurrentPlayerId() != player.getPlayerId())) { return; }
        
            // This also sets choosing color to false, so it also acts as confirmation of color change
            if (!game.changeColor(payload.getColor())) { return; }

            // If color change is successful, start next turn with delay
            game.startTurnDelay(game.getCurrentPlayerId(), 1);

            // Broadcast game state after color change and turn delay started
            game.broadcastGameState();
        });

        this.on(SaveCardPayload, async (peerId, payload, game) => {
            if (!this.isHost()) { return console.warn("[EventManager] Received SaveCardPayload on client, ignoring."); }

            // Get player who sent the request
            let player = game.getPeerPlayer(peerId);
            if (!player) { return console.warn(`[EventManager] Received SaveCardPayload from non-player Peer[${peerId}], ignoring.`); }

            // Game must be started, player must be current player, and must be choosing card
            if (!game.isStarted() || (game.getCurrentPlayerId() != player.getPlayerId()) || !game.getChoosingCardId()) { return; }

            // Check if player has the card
            let card = game.getPlayerCard(player.getPlayerId(), payload.getCardId());
            if (!card) { return console.warn(`[EventManager] Received SaveCardPayload with invalid card ID ${payload.getCardId()} from Peer[${peerId}], ignoring.`); }

            // The card is already saved for player, player only choosed to play it or not
            game.setCurrentPlayerId(game.getNextPlayerId(player.getPlayerId(), 1)); // Move to next player
            game.setChoosingCardId(null);
            game.startPlayerTimer(); // This also triggers broadcastGameState()
        });

        this.on(DrawCardPayload, async (peerId, payload, game) => {
            if (!this.isHost()) { return console.warn("[EventManager] Received DrawCardPayload on client, ignoring."); }
            let player = game.getPeerPlayer(peerId);
            if (!player) { return console.warn(`[EventManager] Received DrawCardPayload from non-player Peer[${peerId}], ignoring.`); }
            
            // Game must be started, not choosing color, not in turn delay, not in choosing card state, and must be current player
            if (!game.isStarted() || game.isChoosingColor() || game.getTurnDelay() || game.getChoosingCardId() || (game.getCurrentPlayerId() != player.getPlayerId())) { return; }

            let cloudPlayCardBefore = Object.values(game.getPlayerCards(player.getPlayerId())).some(card => game.canPlayCard(card).canPlay);
            let drawCardAmount = (game.getStack() > 0) ? game.getStack() : 1; // If there is a stack, draw the whole stack, otherwise just 1 card
            let canPlayCardAfter = false; // This will be used to check if player can play any card after drawing, if not and draw to match is enabled, player will keep drawing until they can play or reach max cards
            let choosableCardId = null;

            console.log(`[EventManager] Player[${player.getPlayerId()}] is drawing ${drawCardAmount} card(s).`);

            // If taking a stack, we don't draw to match, we just take the cards and skip our turn
            // If draw to match enabled, we take card 1 one by one until we can play it, then we play it or save it
            // If player already had playable cards, he just takes 1 card and skips his turn
            // If player ran out of time, and draw to match is enabled, he will keep drawing until he can play

            // I FUCKING HATE MYSELF FOR NOT COMMENTING THIS PEACE OF SHIT, THAT I DONT REMEMBER HOW IT WORKS
            while ((drawCardAmount != 0) && (player.getCardCount() < game.getMaxCards())) {
                let [cardId, card] = Object.entries(game.generateCards(player.getPlayerId(), true, 1))[0]; // Generate one card with special cards included
                if (!canPlayCardAfter) { canPlayCardAfter = game.canPlayCard(card).canPlay; } // Check if player can play this card
                if (canPlayCardAfter && !choosableCardId) { choosableCardId = cardId; }

                // If player ran out of time and draw to match is enabled, player will take cards until he can play
                // Should take in count that draw to match has no power if player is taking stack
                let shouldRepeat = (game.hasRunOutOfTime() && game.drawToMatch() && !(game.getStack() > 0) && !cloudPlayCardBefore && !canPlayCardAfter);
                if (!shouldRepeat) { drawCardAmount -= 1; } //Decrease amount to take
            }

            // If player was taking a stack, could played card before or run out if time, we forward turn to next player
            let playersTurnOver = (game.getStack() > 0) || cloudPlayCardBefore || game.hasRunOutOfTime();

            // If draw to match is enabled, and player could not play after drawing and did not have playable card before, and has reached max cards, end turn his turn
            playersTurnOver = playersTurnOver || (game.drawToMatch() && (player.getCardCount() >= game.getMaxCards()) && !canPlayCardAfter && !cloudPlayCardBefore);

            // If draw to match is disabled and player cannot play, end turn
            playersTurnOver = playersTurnOver || (!game.drawToMatch() && !canPlayCardAfter && !cloudPlayCardBefore);

            // If turn is over, move to next player
            if (playersTurnOver) { game.setCurrentPlayerId(game.getNextPlayerId(player.getPlayerId(), 1)); }
            if (playersTurnOver) { game.startPlayerTimer(); }

            // If turn is not over, and player can play a card now, ask him to play or save
            // No need reset current player id, because he is still current player
            if (!playersTurnOver) { game.setChoosingCardId(canPlayCardAfter ? choosableCardId : null); }
            console.log(`[EventManager] Player[${player.getPlayerId()}] finished drawing cards. Turn over: ${playersTurnOver}, Can play after draw: ${canPlayCardAfter}, Choosing card ID: ${game.getChoosingCardId()}`);

            // We do not reset player timer, because drawing a card is part of player's turn
            game.setStack(0); // Reset stack after drawing
            game.broadcastGameState();
        });
    }
}