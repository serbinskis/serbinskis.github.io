// @ts-check

import { UnoConfig } from './config.js';
import { UnoUtils } from './utils/utils.js';
import { UnoPlayer } from './player.js';
import { EventManager } from './events.js';
import { JoinRequestPayload } from './packets.js';
import { Timer } from './utils/timers.js';
import { GameUI } from './scenes/game.js';

export class GameManager extends EventManager {
    static { // @ts-ignore
        window.GameManager = GameManager;
    }

    /** @protected @type {GameManager | null} */ static GAME_MANAGER = null;
    /** @protected @type {string} */ roomId = '';
    /** @protected @type {JoinRequestPayload} */ data = JoinRequestPayload.EMPTY;
    /** @protected @type {{ [player_id: string]: { [card_id: string]: any; }; }} */ cards = {};
    /** @protected @type {{ [player_id: string]: UnoPlayer; }} */ players = {};
    /** @protected @type {boolean} */ started = false;
    /** @protected @type {number} */ stack = 0;
    /** @protected @type {string | null} */ uno_id = null;
    /** @protected @type {string | null} */ winner_id = null;
    /** @protected @type {{ color: string; type: string } | null} */ current_card = null;
    /** @protected @type {string} */ current_player = ''; //
    /** @protected @type {number} */ direction = UnoConfig.DIRECTION_FORWARD;
    /** @protected @type {boolean} */ skipped = false;
    /** @protected @type {boolean} */ choosing_color = false;
    /** @protected @type {string} */ choosing_id = '';
    /** @protected @type {number | null} */ player_delay = null;
    /** @protected @type {Date | null} */ player_delay_date = null;

    /** @protected */ constructor() {
        super();
        GameManager.GAME_MANAGER = this;
    }

    /** Gets the singleton instance of the GameManager.
     * Under the hood, it creates a new instance of EventManager, which extends GameManager.
     * @returns {GameManager} The singleton instance of the GameManager.
     */
    static getInstance() {
        if (!GameManager.GAME_MANAGER) { GameManager.GAME_MANAGER = new this(); }
        return GameManager.GAME_MANAGER;
    }

    /**
     * Creates a new game with the provided settings.
     * 
     * @param {JoinRequestPayload} data - The settings and player info for the new game.
    **/
    static async createGame(data) {
        const instance = GameManager.getInstance();
        let id = await instance.init().catch(() => {});
        if (!id) { return GameManager.GAME_MANAGER = null; }
        instance.handlePacket(instance.peerId, data); // This will also broadcast, but since we are alone, it doesn't matter
        instance.roomId = instance.peerId;
        instance.data = data;
    }

    /** Joins an existing game using the provided invite code and settings.
     * @param {JoinRequestPayload} data - The invite code and player info to join the game.
    **/
    static async joinGame(data) {
        const instance = GameManager.getInstance();
        let id = await instance.init(data.invite).catch(() => {});
        if (!id) { return GameManager.GAME_MANAGER = null; }
        console.log('Joined game');
        instance.send(data);
        instance.roomId = data.invite;
    }

    async migrateHost() {

    }

    startGame(reset = false) {
        if (this.started && !reset) { return; } // Prevent restarting an already started game
        this.setStarted(true);
        this.setDirection(UnoConfig.DIRECTION_FORWARD);
        this.setStack(0);
        this.setUno(null);
        this.setWinner(null);
        this.setChoosingColor(false);
        this.setSkipped(false);

        let activePlayers = this.getPlayers().filter((e) => e.isOnline(false)); // Player can be disconnected but not left
        this.setCurrentPlayer(activePlayers[UnoUtils.randomRange(0, activePlayers.length-1)].getPlayerId());
        this.setCurrentCard(GameManager.generateCard(false));
        this.getPlayers().forEach((player) => this.generateCards(player.getPlayerId(), true)); // Generate starting cards for each player
        this.startPlayerTimer(); // Start timer for each player turn
    }

    /**
     * Generates a random card from the deck.
     * @param {boolean} includeSpecial - Whether to include special cards in the generation.
     * @returns {{ color: string; type: string }} The generated card identifier.
     */
    static generateCard(/** @type boolean **/ includeSpecial) {
        let cards = (includeSpecial && (UnoUtils.randomRange(1, 2) == 2)) ? UnoConfig.CARDS.special : UnoConfig.CARDS.standart;
        return cards[UnoUtils.randomRange(0, cards.length-1)];
    }

    /** Generates starting cards for a player
     * @param {string} player_id - The ID of the player to generate cards for.
     * @param {boolean} includeSpecial - Whether to include special cards in the generation.
     * @returns {{ [card_id: string]: any; }} The generated cards mapped by their unique IDs.
     */
    generateCards(/** @type string **/ player_id, /** @type boolean **/ includeSpecial) {
        if (!this.cards[player_id]) { this.cards[player_id] = {} }

        for (var i = 0; i < this.data?.startCards; i++) {
            this.cards[player_id][crypto.randomUUID()] = GameManager.generateCard(includeSpecial);
        }

        this.getPlayer(player_id)?.setCardCount(this.data?.startCards || 0);
        return this.cards[player_id];
    }

    /** Adds or updates player to the game
     * @param {UnoPlayer} packet_player - TODO
     * @returns {UnoPlayer}
     */
    addPlayer(packet_player) {
        let player = this.getPlayer(packet_player.getPlayerId());
        if (!player) { player = this.players[packet_player.getPlayerId()] = packet_player; }

        //TODO UPDATE PLAYER INFO FROM PACKET
        player.setCardCount(packet_player.getCardCount());

        GameUI.renderPlayers();
        return player;
    }

    /** Removes a player from the game
     * @param {string} playerId - The ID of the player to remove.
     * @returns {string | void} The new owner ID if the owner left, otherwise the current owner ID.
     */
    removePlayer(playerId) {
        let player = this.getPlayer(playerId);
        if (!player) { return console.warn(`[GameManager] Tried to remove non-existing player[playerId=${playerId}]`); }

        player.disconnectPlayer(); // If player leaves we set discconect data in any way
        if (!this.isStarted() || !this.canRejoin()) { player.setLeft(true); }
        if (player.isLeft()) { delete this.players[playerId]; }

        //If left player is not last and he was owner then select new owner
        if ((this.getOnline(true) != 0) && (this.owner_id == playerId)) {
            for (const player of this.getPlayers()) {
                if (!player.isOnline(true)) { continue; }
                return (this.owner_id = player.getPlayerId());
            }
        }
 
        GameUI.renderPlayers();
        return this.owner_id;
    }

    /** Adds a card to a player's hand
     * @param {string} playerId - The ID of the player to add the card to.
     * @param {string} cardId - The unique ID of the card to add.
     * @param {{ color: string; type: string; }} card - The card object to add.
     * @returns {{ color: string; type: string; }} The added card object.
     */
    addCard(playerId, cardId, card) {
        var player = this.getPlayer(playerId);
        player?.setCardCount(player.getCardCount()+1);
        return (this.cards[playerId][cardId] = card);
    }

    /** Sets a player in the game
     * @param {any} socket - The socket associated with the player.
     * @param {{ username: string; avatar: string; player_id: string; card_count: number; }} options - The player options.
     * @returns {UnoPlayer} The UnoPlayer instance that was set.
     */
    setPlayer(socket, options) {
        // @ts-ignore
        this.players_json[options.player_id] = options;
        // @ts-ignore
        return (this.players[options.player_id] = new UnoPlayer(socket, Object.assign({ room_id: this.room_id }, options)));
    }

    /** Gets a player by their ID
     * @param {string} playerId - The ID of the player to retrieve.
     * @returns {UnoPlayer | null} The UnoPlayer instance corresponding to the given ID, or null if not found.
     */
    getPlayer(playerId) {
        return this.players[playerId] ? this.players[playerId] : null;
    }

    /** Gets a player by their peer ID
     * @param {string} peerId - The ID of the player's peer to retrieve.
     * @returns {UnoPlayer | null} The UnoPlayer instance corresponding to the given ID, or null if not found.
     */
    getPeerPlayer(peerId) {
        return Object.values(this.players).filter(player => player.getPeerId() == peerId)[0];
    }

    /** Gets all players in the game
     * @returns {UnoPlayer[]} An array of all UnoPlayer instances in the game.
     */
    getPlayers() {
        return Object.values(this.players);
    }

    /** Gets all count of players who are still connected
     * @param {boolean} includeDisconnected - If we want to include temporary disconnected players
     * @returns {number} Count of players who are still connected.
     */
    getOnline(includeDisconnected) {
        return this.getPlayers().filter((e) => e.isOnline(includeDisconnected)).length;
    }

    /** Gets the cards of a player
     * @param {string} playerId - The ID of the player whose cards to retrieve.
     * @returns {{ [card_id: string]: { color: string; type: string; }; }} The cards of the specified player.
     */
    getPlayerCards(playerId) {
        return this.cards[playerId];
    }

    /** Gets the room ID of the game.
     * @returns {string} The room ID.
     */
    getRoomId() {
        return this.roomId;
    }

    /** Gets the owner peer ID of the game. (roomId = ownerId)
     * @returns {string} The owner ID.
     */
    getOwnerId() {
        return this.roomId;
    }

    /** Gets game owner
     * @returns {UnoPlayer | null} The owner player instance or null if owner is not yet added (WHEN JOINING)
     */
    getOwner() {
        let owner = this.getPeerPlayer(this.getOwnerId());
        //if (!owner) { throw new Error("[GameManager] getOwner() -> Owner player not found."); }
        return owner;
    }

    /** Sets the owner ID of the game. (roomId = ownerId)
     * @param {string} ownerId - The new owner ID.
     * @returns {string} The updated owner ID.
     */
    setOwner(ownerId) {
        return (this.roomId = ownerId);
    }

    /** Checks if the game has started.
     * @returns {boolean} True if the game has started, false otherwise.
     */
    isStarted() {
        return this.started;
    }

    /** Sets the started status of the game.
     * @param {boolean} started - The new started status.
     * @returns {boolean} The updated started status.
     */
    setStarted(started) {
        return (this.started = started);
    }

    /** Checks if the player is currently choosing a color.
     * @returns {boolean} True if the player is choosing a color, false otherwise.
     */
    isChoosingColor() {
        return this.choosing_color;
    }

    /** Sets the choosing color status of the player.
     * @param {boolean} choosing_color - The new choosing color status.
     * @returns {boolean} The updated choosing color status.
     */
    setChoosingColor(choosing_color) {
        return (this.choosing_color = choosing_color);
    }

    /** Gets the ID of the player currently choosing a color.
     * @returns {string} The choosing player ID.
     */
    getChoosingId() {
        return this.choosing_id;
    }

    /** Sets the ID of the player currently choosing a color.
     * @param {string} choosing_id - The new choosing player ID.
     * @returns {string} The updated choosing player ID.
     */
    setChoosingId(choosing_id) {
        return (this.choosing_id = choosing_id);
    }

    /** Gets the delay timestamp for the current player's turn.
     * @returns {number | null} The player delay timestamp, or null if no delay is set.
     */
    getPlayerDelay() {
        return this.player_delay;
    }

    //Will return aproximate player delay in seconds since last time it was started
    //FUCK, have no clue how to explain this
    getCurrentPlayerDelay() {
        if (!this.player_delay) { return 0; }
        // @ts-ignore
        return Math.round(this.player_time-((new Date().getTime() - this.player_delay_date.getTime())/1000));
    }

    /**
     * Sets the direction of the game.
     * @param {number} direction - The new direction.
     * @returns {number} The updated direction.
     */
    setDirection(direction) {
        return (this.direction = direction);
    }

    /**
     * Gets the current direction of the game.
     * @returns {number} The current direction.
     */
    getDirection() {
        return this.direction;
    }

    /**
     * Gets the current player in the game.
     * @returns {string} The current player ID.
     */
    getCurrentPlayer() {
        return this.current_player;
    }

    /**
     * Sets the current player in the game.
     * @param {string} current_player - The new current player ID.
     * @returns {string} The updated current player ID.
     */
    setCurrentPlayer(current_player) {
        return (this.current_player = current_player);
    }

    /**
     * Gets the current card in deck.
     * @returns {{ color: string; type: string; } | null} The current card.
     */
    getCurrentCard() {
        return this.current_card;
    }

    /**
     * Sets the current card in deck.
     * @param {{ color: string; type: string; }} current_card - The new current card.
     * @returns {{ color: string; type: string; }} The updated current card.
     */
    setCurrentCard(current_card) {
        return (this.current_card = current_card);
    }

    /** Sets the UNO caller ID.
     * @param {string | null} uno_id - The ID of the player who called UNO.
     * @returns {string | null} The UNO caller ID.
     */
    setUno(uno_id) {
        return (this.uno_id = uno_id);
    }

    /** Gets the UNO caller ID.
     * @returns {string | null} The UNO caller ID or null if no one called UNO.
     */
    getUno() {
        return this.uno_id;
    }

    /**
     * Sets the winner ID of the game.
     * @param {string | null} winner_id - The ID of the winner.
     * @returns {string | null} The winner ID.
     */
    setWinner(winner_id) {
        return (this.winner_id = winner_id);
    }

    /**
     * Gets the winner ID of the game.
     * @returns {string | null} The winner ID or null if no winner exists.
     */
    getWinner() {
        return this.winner_id;
    }

    /** Checks if there is a winner in the game.
     * @returns {boolean} True if there is a winner, false otherwise.
     */
    isWinner() {
        return (this.winner_id != null);
    }

    /** Sets whether the next player is skipped.
     * @param {boolean} skipped - Whether the next player is skipped.
     * @returns {boolean} The updated skipped status.
     */
    setSkipped(skipped) {
        return (this.skipped = skipped);
    }

    /** Checks if the next player is skipped.
     * @returns {boolean} True if the next player is skipped, false otherwise.
     */
    isSkipped() {
        return this.skipped;
    }

    /** Sets the current stack count.
     * @param {number} stack - The new stack count.
     * @returns {number} The updated stack count.
     */
    setStack(stack) {
        return (this.stack = stack);
    }

    /** Gets the current stack count.
     * @returns {number} The current stack count.
     */
    getStack() {
        return this.stack;
    }

    /** Get max players in the game.
     * @returns {number} The maximum number of players allowed in the game.
     */
    getMaxPlayers() {
        return this.data.maxPlayers;
    }

    /** Whether players can "jump in" out of turn with an identical card.
     * @returns {boolean} True if players can jump in, false otherwise.
     */
    canJumpIn() {
        return this.data.canJumpIn;
    }

    /** Whether players must call "UNO".
     * @returns {boolean} True if players must call "UNO", false otherwise.
     */
    canUno() {
        return this.data.canUno;
    }

    /** Whether players can rejoin a game in progress.
     * @returns {boolean} True if players can rejoin, false otherwise.
     */
    canRejoin() {
        return this.data.canRejoin;
    }

    /** Gets the maximum number of cards a player can hold.
     * @returns {number} The maximum number of cards.
     */
    getMaxCards() {
        return this.data.maxCards;
    }

    /** Gets the time limit for each player's turn.
     * @returns {number} The time limit in seconds.
     */
    getPlayerTime() {
        return this.data.playerTime;
    }

    /** Whether drawing to match is enforced.
     * @returns {boolean} True if drawing to match is enforced, false otherwise.
     */
    drawToMatch() {
        return this.data.drawToMatch;
    }

    /** Whether stacking of +2 and +4 cards is allowed.
     * @returns {boolean} True if stacking is allowed, false otherwise.
     */
    canStackCards() {
        return this.data.canStackCards;
    }

    /** Changes the color of the current card if it's a PLUS_FOUR or COLOR_CHANGE card.
     * @param {string} color - The new color to set.
     * @returns {boolean} True if the color was changed, false otherwise.
     */
    changeColor(color) {
        //Check if current card is PLUS_FOUR or COLOR_CHANGE
        if ((this.current_card?.type != 'PLUS_FOUR') && (this.current_card?.type != 'COLOR_CHANGE')) { return false; }
        this.setChoosingColor(false);
        this.setCurrentCard({ color: color, type: this.current_card.type });
        // @ts-ignore
        this.emit('change_color', { color: color, type: this.current_card.type });
        return true;
    }

    /** Sets the turn delay timer.
     * @param {number} turn_delay - The turn delay timer.
     * @returns {number} The updated turn delay timer.
     */
    setTurnDelay(turn_delay) {
        return (this.turn_delay = turn_delay);
    }

    /** Gets the turn delay timer.
     * @returns {number} The turn delay timer.
     */
    getTurnDelay() {
        return this.turn_delay;
    }

    /** Starts the turn delay timer for the player.
     * After the delay, it sets the next player as the current player.
     * This is small delay after placing a card, to prevent instant next turn in case if stakcking or jump in enabled.
     * @param {string} player_id - The ID of the current player.
     * @param {number} next_by - The number of players to skip for the turn.
     */
    startTurnDelay(player_id, next_by) {
        if (this.turn_delay) { Timer.stop(this.turn_delay); }

        //Delay next move after selecting color
        this.turn_delay = Timer.start(() => {
            this.turn_delay = null; //Clear delay variable
            // @ts-ignore
            this.setCurrentPlayer(this.nextPlayer(player_id, next_by)); //Get and set next player
            this.setUno(null); //Clear uno variable
            // @ts-ignore
            this.emit1('next_move', { next_move: this.current_player, player_time: this.data.playerTime });
            this.startPlayerTimer();
        }, UnoConfig.TURN_DELAY);
    }

    /** Starts the player timer for the current player's turn.
     * If the timer expires, the player is skipped and a card is drawn automatically.
     */
    startPlayerTimer() {
        //+ If game finishes, like there is a winner, crash happends
        //game.js:324 -> var socket = this.getPlayer(this.current_move).getSocket();
        //Cannot read properties of null (reading 'getSocket')

        //+ If player leaves timer does not reset, It just executes faster
        //Probaly should execute startPlayerTimer() inside disconnect event

        //+ If draw_to_match enabled timer will rerun.
        //Instead better make loop and new variable skipped

        //+ Also this will not prevent save or place dialog
        //Better if it would be skipped aswell

        //- BTW this will not work if player is stacking, since
        //when player is stacking the turn dealy is active which prevents
        //taking cards, so timer by default when taking cards will not work

        if (this.player_delay) { Timer.stop(this.player_delay); }
        this.player_delay_date = new Date();

        this.player_delay = Timer.start(() => {
            this.skipped = true;
            // @ts-ignore
            var socket = this.getPlayer(this.current_move).getSocket();
            // @ts-ignore
            var color = config.colors[sutils.randomRange(0, config.colors.length-1)];

            var isChoosingColor = this.isChoosingColor();
            var choosingId = this.getChoosingId();

            // @ts-ignore
            if (isChoosingColor) { UnoEvents.execute(this.io, socket, 'change_color', { color: color }); }
            // @ts-ignore
            if (choosingId) { UnoEvents.execute(this.io, socket, 'save_card', { card_id: choosingId }); }
            // @ts-ignore
            if (!isChoosingColor && !choosingId) UnoEvents.execute(this.io, socket, 'take_card');
            this.skipped = false;
        // @ts-ignore
        }, this.player_time*1000 + 500);

        var player = this.getPlayer(this.current_player);
        if (player?.isDisconnected()) { Timer.finish(this.player_delay); }
        // @ts-ignore
        if ((this.player_time <= 0) && !player?.isDisconnected()) { Timer.stop(this.player_delay); }
    }

    /** Starts the disconnection timer for a player.
     * @param {string} player_id - The ID of the player to start the disconnection timer for.
     */
    startPlayerDisconnect(player_id) { //TODO INSTEAD OF THIS STUPID TIMER JUST STORE PLAYER DISCONNECT TIME AND CHECK IT WHEN NEEDED
        //Some weird error in here
        var player = this.getPlayer(player_id);
        // @ts-ignore
        player.disconnect_delay = Timer.start(() => {
            // @ts-ignore
            if (this.deleted) { return; }
            // @ts-ignore
            player.setLeft(true);
            // @ts-ignore
            this.players_json[player_id].left = true;
            // @ts-ignore
            this.emit('disconnected', { left_id: player_id });
        }, UnoConfig.REJOIN_TIME);
    }

    /** Gets the next player in turn order.
     * @param {string} player_id - The current player ID.
     * @param {number} by - The number of players to skip.
     * @returns {string | null} The next player ID or null if not found.
     */
    nextPlayer(player_id, by) {
        var players_id = Object.keys(this.players);
        var index = players_id.indexOf(player_id);
        if (index == -1) { return null; } // -1, not found

        index += this.direction;
        while (index > players_id.length-1) { index = index - players_id.length; }
        while (index < 0) { index = players_id.length + index; }

        var player_id = players_id[index];
        var player = this.getPlayer(player_id);

        //Return only if last by and player has not left
        return ((by <= 1) && player?.isOnline(false)) ? player_id : this.nextPlayer(player_id, (!player?.isOnline(false) ? by : by-1));
    }

    /** Sends information about who can jump in to all eligible players.
     * @param {string | null} [blocked_id] - The ID of the player to block from receiving the information.
     */
    sendWhoCanJumpIn(blocked_id) {
        for (const player of this.getPlayers()) {
            //Yes, I know, blocked_id may be undefined, and, WHO CARES
            if (!player.isOnline(true) || (player.getPlayerId() == blocked_id)) { continue; }

            //FUCK if I am current player then this (player.getId() == blocked_id) will prevent
            //me from getting info

            //Don't send info to current playing player if stacking is disabled
            if ((player.getPlayerId() == this.current_player) && !this.canStackCards()) { continue; }

            var cards = Object.entries(this.getPlayerCards(player.getPlayerId())).filter(([_, card]) => {
                var card_color = (card.color != 'ANY') ? card.color : this.current_card?.color;
                return ((card_color == this.current_card?.color) && (card.type == this.current_card?.type));
            }).map(([card_id, _]) => card_id);

            // @ts-ignore
            if (cards.length > 0) { player.emit1('can_jump_in', { cards: cards }); }
        }
    }

    /** Checks if a card can be played based on the current game state.
     * @param {{ color: string; type: string; }} card - The card to check.
     * @param {boolean} [update=false] - Whether to update the game state if the card can be played.
     * @returns {{ canPlay: boolean; nextBy?: number; pickColor?: boolean; }} An object indicating if the card can be played and additional info.
    */
    canPlayCard(card, update = false) {
        let next_by = 1;
        let pick_color = false;

        switch (card.type) {
            case 'REVERSE': //Can put on same color or same type, reverse direction, can be put after stack was taken
                if (this.stack > 0 || (card.color != this.current_card?.color && card.type != this.current_card?.type)) { return { canPlay: false }; }
                if (update) { this.direction *= UnoConfig.DIRECTION_REVERSE; }
                break;
            case 'BLOCK': //Can put on same color or same type, just skip by 1 more, can be put after stack was taken
                if (this.stack > 0 || (card.color != this.current_card?.color && card.type != this.current_card?.type)) { return { canPlay: false }; }
                next_by += 1;
                break;
            case 'PLUS_TWO': //Cannot put PLUS_TWO on PLUS_FOUR, but can put it on anything else with same color, can be put after stack was taken
                if ((this.stack > 0 && this.current_card?.type == 'PLUS_FOUR') || (card.color != this.current_card?.color && card.type != this.current_card?.type)) { return { canPlay: false }; }
                if (update) { this.stack += 2; }
                break;
            case 'PLUS_FOUR': //PLUS_FOUR can be aplied to everything there is no limits, so no need to check color or type
                pick_color = true;
                if (update) { this.stack += 4; }
                break;
            case 'COLOR_CHANGE': //Cannot be put on PLUS_FOUR and PLUS_TWO, but can put it on anything else with different color, can be put after stack was taken
                if ((this.stack > 0 && (this.current_card?.type == 'PLUS_FOUR' || this.current_card?.type == 'PLUS_TWO'))) { return { canPlay: false }; }
                pick_color = true;
                break;
            default:
                if (this.stack > 0 || ((card.color != this.current_card?.color) && (card.type != this.current_card?.type))) { return { canPlay: false }; }
        }

        return { canPlay: true, nextBy: next_by, pickColor: pick_color };
    }
}