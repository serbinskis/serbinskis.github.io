// @ts-check

import { UnoConfig } from './config.js';
import { UnoUtils } from './utils/utils.js';
import { UnoPlayer } from './player.js';
import { EventManager } from './events.js';
import { ChangeColorPayload, DrawCardPayload, GameStatePayload, JoinRequestPayload, KickPlayerPayload, PlaceCardPayload, SaveCardPayload, UnoPressPayload } from './packets.js';
import { Timer } from './utils/timers.js';

export class GameManager extends EventManager {
    static { // @ts-ignore
        window.GameManager = GameManager;
    }

    /** @protected @type {GameManager | null} */ static GAME_MANAGER = null;
    /** @protected @type {string} */ roomId = '';
    /** @protected @type {JoinRequestPayload} */ settings = JoinRequestPayload.EMPTY;
    /** @protected @type {{ [player_id: string]: { [card_id: string]: any; }; }} */ cards = {};
    /** @protected @type {{ [player_id: string]: UnoPlayer; }} */ players = {};
    /** @protected @type {boolean} */ started = false;
    /** @protected @type {number} */ stack = 0;
    /** @protected @type {string | null} */ unoId = null;
    /** @protected @type {string | null} */ winner_id = null;
    /** @protected @type {{ color: string; type: string, id?: string } | null} */ currentCard = null;
    /** @protected @type {string} */ currentPlayerId = ''; // Player ID of current playing player
    /** @protected @type {number} */ direction = UnoConfig.DIRECTION_FORWARD;
    /** @protected @type {boolean} */ runOutOfTime = false;
    /** @protected @type {boolean} */ choosingColor = false;
    /** @protected @type {string|null} */ choosingCardId = null;
    /** @protected @type {string | null} */ playerTimer = null;
    /** @protected @type {number | null} */ turnTimer = null;
    /** @protected @type {number | null} */ playerTimerCount = null;

    /** @protected */ constructor() {
        super();
        GameManager.GAME_MANAGER = this; // @ts-ignore, line bellow
        window.game = this; // For debugging purposes
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
     * @param {JoinRequestPayload} settings - The settings and player info for the new game.
    **/
    static async createGame(settings) {
        const instance = GameManager.getInstance();
        let id = await instance.init().catch(() => {});
        if (!id) { return GameManager.GAME_MANAGER = null; }
        instance.handlePacket(instance.getPeerId(), settings); // This will also broadcast, but since we are alone, it doesn't matter
        instance.roomId = instance.getPeerId();
        instance.settings = settings.clone();
        instance.settings.avatar = null; // No need to store avatar in settings
    }

    /** Joins an existing game using the provided invite code and settings.
     * @param {JoinRequestPayload} settings - The invite code and player info to join the game.
    **/
    static async joinGame(settings) {
        const instance = GameManager.getInstance();
        let id = await instance.init(settings.invite).catch(() => {});
        if (!id) { return GameManager.GAME_MANAGER = null; }
        console.log('Joined game');
        instance.send(settings);
        instance.roomId = settings.invite;
    }

    async migrateHost() {

    }

    /** Starts the game if the caller is the host. If the game has already started, it will reset the game state if reset is true.
     * @param {boolean} reset - Whether to reset the game state if the game has already started.
     */
    startGame(reset = false) {
        if (!this.isHost()) { return console.warn("[GameManager] Only host can start the game."); }
        if (this.isStarted() && !reset) { return; } // Prevent restarting an already started game
        this.setStarted(true);
        this.setDirection(UnoConfig.DIRECTION_FORWARD);
        this.setStack(0);
        this.setUnoId(null);
        this.setWinner(null);
        this.setChoosingColor(false);
        this.setRunOutOfTime(false);

        this.setCurrentPlayerId(this.getRandomPlayerId()); // Set random player as starting player
        this.setCurrentCard(GameManager.generateCard(false));
        this.getPlayers().forEach((player) => this.generateCards(player.getPlayerId(), true, this.getStartCards())); // Generate starting cards for each player
        this.startPlayerTimer(); // Start timer for each player turn

        this.broadcastGameState();
    }

    /** Sends a request to place a card on the current card. The actual card placement will be handled by the host after validating the move.
     * @param {string} cardId - The uncrypted ID of the card to place.
    **/
    clientPlaceCard(cardId) {
        this.handlePacket(this.getPeerId(), new PlaceCardPayload(cardId));
    }

    /** Sends a request to change the color of the current card. The actual color change will be handled by the host after validating the move.
     * @param {string} color - The new color to change to.
    */
    clientChangeColor(color) {
        if (!UnoConfig.COLORS.includes(color)) { return alert(`[GameManager] clientChangeColor() -> Invalid color ${color}.`); }
        this.handlePacket(this.getPeerId(), new ChangeColorPayload(color));
    }

    /** Sends a request to save a card for later play. The actual saving will be handled by the host after validating the move.
     * @param {string} cardId - The uncrypted ID of the card to save.
    **/
    clientSaveCard(cardId) {
        this.handlePacket(this.getPeerId(), new SaveCardPayload(cardId));
    }

    /** Sends a request to draw a card from the deck. The actual drawing will be handled by the host after validating the move.
     * Remeber this also can be called as host, so we have to handle that as well.
    */
    clientDrawCard() {
        this.handlePacket(this.getPeerId(), new DrawCardPayload());
    }

    /** Sends a request to call UNO. The actual call will be handled by the host after validating the move.
     * Remeber this also can be called as host, so we have to handle that as well.
    */
    clientCallUno() {
        this.handlePacket(this.getPeerId(), new UnoPressPayload());
    }

    /**
     * Generates a random card from the deck.
     * @param {boolean} includeSpecial - Whether to include special cards in the generation.
     * @returns {{ color: string; type: string }} The generated card identifier.
     */
    static generateCard(/** @type boolean **/ includeSpecial) {
        let cards = (includeSpecial && (UnoUtils.randomRange(1, 2) == 2)) ? UnoConfig.CARDS.special : UnoConfig.CARDS.standart;
        return { ...cards[UnoUtils.randomRange(0, cards.length-1)] }; // Return a copy of the card object
    }

    /** Generates encrypted starting cards for a player
     * @param {string} playerId - The ID of the player to generate cards for.
     * @param {boolean} includeSpecial - Whether to include special cards in the generation.
     * @param {number} amount - The number of cards to generate.
     * @returns {{ [card_id: string]: { color: string; type: string } }} The generated unencrypted cards mapped by their unique IDs.
     */
    generateCards(/** @type string **/ playerId, /** @type boolean **/ includeSpecial, amount = 0) {
        let player = this.getPlayer(playerId);
        if (!player || !player.getPrivateId()) { throw new Error(`[GameManager] generateCards() -> Player[playerId=${playerId}] not found or has no private ID.`); }
        if (!this.cards[playerId]) { this.cards[playerId] = {} }

        /** @type {{ [card_id: string]: { color: string; type: string } }} */
        let generatedCards = {}; // To hold the generated cards to return

        // NOW WE HAVE TO ENCRYPT CARDS WITH PLAYER PRIVATE ID TO PREVENT CHEATING
        for (var i = 0; i < amount; i++) {
            let cardId = UnoUtils.randomUUID();
            console.log('Generated cardId:', cardId, 'for playerId:', playerId);
            generatedCards[cardId] = GameManager.generateCard(includeSpecial);
            let color = UnoUtils.encryptString(generatedCards[cardId].color, String(player.getPrivateId()));
            let type = UnoUtils.encryptString(generatedCards[cardId].type, String(player.getPrivateId()));
            cardId = UnoUtils.encryptString(cardId, String(player.getPrivateId()));
            console.log('Encrypted cardId:', cardId);
            console.log('Decrypted cardId:', UnoUtils.decryptString(cardId, String(player.getPrivateId())));
            this.cards[playerId][cardId] = { color, type };
        }

        this.getPlayer(playerId)?.setCardCount(Object.keys(this.cards[playerId]).length);
        return generatedCards;
    }

    /** Gets the decrypted cards of a player
     * @param {string} playerId - The ID of the player whose cards to retrieve.
     * @returns {{ [card_id: string]: { color: string; type: string } }} The decrypted cards of the specified player.
     */
    getPlayerCards(playerId) {
        let player = this.getPlayer(playerId);
        if (!player || !player.getPrivateId()) { throw new Error(`[GameManager] getPlayerCards() -> Player[playerId=${playerId}] not found or has no private ID.`); }

        return Object.fromEntries(Object.entries(this.cards[playerId] || {}).map(([cardId, card]) => {
            cardId = UnoUtils.decryptString(cardId, String(player.getPrivateId()));
            let color = UnoUtils.decryptString(card.color, String(player.getPrivateId()));
            let type = UnoUtils.decryptString(card.type, String(player.getPrivateId()));
            return [cardId, { color, type }];
        }));
    }

    /** Gets a decrypted card of a player by its uncrypted ID
     * @param {string} playerId - The ID of the player whose card to retrieve.
     * @param {string} cardId - The uncrypted ID of the card to retrieve.
     * @returns {{ color: string; type: string } | null} The decrypted card object, or null if not found.
     */
    getPlayerCard(playerId, cardId) {
        let playerCards = this.getPlayerCards(playerId);
        return playerCards[cardId] || null;
    }

    /** Gets a decrypted card by its uncrypted ID
     * @param {string|null} cardId - The uncrypted ID of the card to retrieve.
     * @returns {{ color: string; type: string } | null} The decrypted card object, or null if not found.
     */
    getCard(cardId) {
        for (const playerId in this.cards) {
            let player = this.getPlayer(playerId);
            if (!player || !player.getPrivateId()) { continue; }

            for (const cId in this.cards[playerId]) {
                let decryptedCardId = UnoUtils.decryptString(cId, String(player.getPrivateId()));
                if (decryptedCardId != cardId) { continue; }
                let card = this.cards[playerId][cId];
                let color = UnoUtils.decryptString(card.color, String(player.getPrivateId()));
                let type = UnoUtils.decryptString(card.type, String(player.getPrivateId()));
                return { color, type };
            }
        }

        return null;
    }

    /** Removes a card from a player's hand by its uncrypted ID
     * @param {string} cardId - The uncrypted ID of the card to remove.
     */
    removeCard(cardId) {
        for (const playerId in this.cards) {
            let player = this.getPlayer(playerId);
            if (!player || !player.getPrivateId()) { continue; }

            for (const cId in this.cards[playerId]) {
                let decryptedCardId = UnoUtils.decryptString(cId, String(player.getPrivateId()));
                if (decryptedCardId != cardId) { continue; }
                delete this.cards[playerId][cId];
                player.setCardCount(player.getCardCount()-1);
                return;
            }
        }
    }

    /** Adds or updates player to the game
     * @param {UnoPlayer} packet_player - TODO
     * @returns {UnoPlayer}
     */
    addPlayer(packet_player) {
        // First check if player with same private ID exists and allow rejoin
        let privatePlayer = this.getPrivatePlayer(packet_player.getPrivateId());
        privatePlayer?.setPeerId(packet_player.getPeerId());
        privatePlayer?.setReconnected();
        if (privatePlayer) { packet_player = privatePlayer; }

        let player = this.getPlayer(packet_player.getPlayerId());
        if (!player) { player = this.players[packet_player.getPlayerId()] = packet_player; }
        this.broadcastGameState(); // Broadcast updated game state and trigger on(GameStatePayload)
        return player;
    }

    /** Removes a player from the game
     * @param {string} playerId - The ID of the player to remove.
     * @returns {string | void} The new owner ID if the owner left, otherwise the current owner ID.
     */
    removePlayer(playerId) {
        let player = this.getPlayer(playerId);
        if (!player) { return console.warn(`[GameManager] Tried to remove non-existing player[playerId=${playerId}]`); }

        if (player.isDisconnected()) { player.setLeft(true); } // If player is disconnected and removePlayer is called, mark as left
        if (!this.isStarted() || !this.canRejoin()) { player.setLeft(true); }
        if (player.isLeft()) { delete this.players[playerId]; }

        // If player is disconnected but not left, just mark as disconnected
        // After n amount of time remove him from game
        if (!player.isLeft()) { player.disconnectPlayer(() => this.removePlayer(playerId)); }

        //If left player is not last and he was owner then select new owner
        if ((this.getOnline(true) != 0) && (this.owner_id == playerId)) {
            for (const player of this.getPlayers()) {
                if (!player.isOnline(true)) { continue; }
                return (this.owner_id = player.getPlayerId());
            }
        }
 
        this.broadcastGameState(); // Broadcast updated game state and trigger on(GameStatePayload)
        return this.owner_id;
    }

    /** Kicks a player from the game
     * @param {string} playerId - The ID of the player to kick.
     * @param {string} [reason] - The reason for the kick.
     */
    kickPlayer(playerId, reason = 'Kicked by host') {
        let player = this.getPlayer(playerId);
        if (!player) { return console.warn(`[GameManager] Tried to kick non-existing player[playerId=${playerId}]`); }
        this.handlePacket(this.getPeerId(), new KickPlayerPayload(playerId, reason));
    }

    /** Sets or updates a player in the game
     * @param {string} playerId - The ID of the player to set.
     * @param {UnoPlayer} player - The UnoPlayer instance to set.
     * @returns {UnoPlayer} The updated UnoPlayer instance.
     */
    setPlayer(playerId, player) {
        return (this.players[playerId] = player);
    }

    /** Gets a player by their ID
     * @param {string} playerId - The ID of the player to retrieve.
     * @returns {UnoPlayer | null} The UnoPlayer instance corresponding to the given ID, or null if not found.
     */
    getPlayer(playerId) {
        return this.players[playerId] ? this.players[playerId] : null;
    }

    /** Gets the current playing player instance
     * @returns {UnoPlayer | null} The current playing UnoPlayer instance, or null if not found.
     */
    getCurrentPlayer() {
        return this.getPlayer(this.getCurrentPlayerId());
    }

    /** Gets my player instance
     * @returns {UnoPlayer | undefined} The UnoPlayer instance corresponding to my peer ID, or null if not found.
     */
    getMyPlayer() {
        return this.getPeerPlayer(this.getPeerId());
    }

    /** Gets a player by their peer ID
     * @param {string} peerId - The ID of the player's peer to retrieve.
     * @returns {UnoPlayer | undefined} The UnoPlayer instance corresponding to the given ID, or null if not found.
     */
    getPeerPlayer(peerId) {
        return Object.values(this.players).find(player => player.getPeerId() == peerId);
    }

    /** Gets a player by their private ID
     * @param {string | null} privateId - The private ID of the player to retrieve.
     * @returns {UnoPlayer | undefined} The UnoPlayer instance corresponding to the given private ID, or null if not found.
     */
    getPrivatePlayer(privateId) {
        return Object.values(this.players).find(player => player.getPrivateId() == privateId);
    }

    /** Gets a player's private ID by their peer ID
     * @param {string} peerId - The ID of the player's peer.
     * @returns {string | null} The private ID of the player, or null if not found.
     */
    getPrivateId(peerId) {
        const player = this.getPeerPlayer(peerId);
        return player ? player.getPrivateId() : null;
    }

    /** Gets all players in the game
     * @returns {UnoPlayer[]} An array of all UnoPlayer instances in the game.
     */
    getPlayers() {
        return Object.values(this.players || {});
    }

    /** Gets all count of players who are still connected
     * @param {boolean} includeDisconnected - If we want to include temporary disconnected players
     * @returns {number} Count of players who are still connected.
     */
    getOnline(includeDisconnected) {
        return this.getPlayers().filter((e) => e.isOnline(includeDisconnected)).length;
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
     * @returns {UnoPlayer | undefined} The owner player instance or null if owner is not yet added (WHEN JOINING)
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
        return this.choosingColor;
    }

    /** Sets the choosing color status of the player.
     * @param {boolean} choosingColor - The new choosing color status.
     * @returns {boolean} The updated choosing color status.
     */
    setChoosingColor(choosingColor) {
        return (this.choosingColor = choosingColor);
    }

    /** Gets the ID of the card currently being choosen to place or save a card.
     * @returns {string|null} The choosing card ID.
     */
    getChoosingCardId() {
        return this.choosingCardId;
    }

    /** Sets the ID of the card currently being choosen to place or save a card.
     * @param {string|null} choosingCardId - The new choosing card ID.
     * @returns {string|null} The updated choosing card ID.
     */
    setChoosingCardId(choosingCardId) {
        return (this.choosingCardId = choosingCardId);
    }

    /** Gets the player timer count for the current player's turn.
     * @returns {number} The player timer count.
     */
    getPlayerTimerCount() {
        return this.playerTimerCount || 0;
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
    getCurrentPlayerId() {
        return this.currentPlayerId;
    }

    /**
     * Sets the current player in the game.
     * @param {string} currentPlayerId - The new current player ID.
     * @returns {string} The updated current player ID.
     */
    setCurrentPlayerId(currentPlayerId) {
        return (this.currentPlayerId = currentPlayerId);
    }

    /**
     * Gets the current card in deck.
     * @returns {{ color: string; type: string; id?: string } | null} The current card.
     */
    getCurrentCard() {
        return this.currentCard;
    }

    /**
     * Sets the current card in deck.
     * @param {{ color: string; type: string; }} currentCard - The new current card.
     * @returns {{ color: string; type: string; id?: string }} The updated current card.
     */
    setCurrentCard(currentCard) {
        // This ID is used only for animation purpose on client side
        return (this.currentCard = { ...currentCard, id: UnoUtils.randomUUID() });
    }

    /** Sets the UNO caller ID.
     * @param {string | null} unoId - The ID of the player who called UNO.
     * @returns {string | null} The UNO caller ID.
     */
    setUnoId(unoId) {
        return (this.uno_id = unoId);
    }

    /** Gets the UNO caller ID.
     * @returns {string | null} The UNO caller ID or null if no one called UNO.
     */
    getUnoId() {
        return this.unoId;
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

    /** Sets the run out of time status for the current player.
     * @param {boolean} runOutOfTime - The new run out of time status.
     * @returns {boolean} The updated run out of time status.
     */
    setRunOutOfTime(runOutOfTime) {
        return (this.runOutOfTime = runOutOfTime);
    }

    /** Gets the run out of time status for the current player.
     * @returns {boolean} The run out of time status.
     */
    hasRunOutOfTime() {
        return this.runOutOfTime;
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
        return this.settings.maxPlayers;
    }

    /** Whether players can "jump in" out of turn with an identical card.
     * @returns {boolean} True if players can jump in, false otherwise.
     */
    canJumpIn() {
        return this.settings.canJumpIn;
    }

    /** Whether players must call "UNO".
     * @returns {boolean} True if players must call "UNO", false otherwise.
     */
    canUno() {
        return this.settings.canUno;
    }

    /** Whether players can rejoin a game in progress.
     * @returns {boolean} True if players can rejoin, false otherwise.
     */
    canRejoin() {
        return this.settings.canRejoin;
    }

    /** Checks if a player can rejoin the game.
     * @param {string} privateId - The private ID of the player to check.
     * @returns {UnoPlayer|null} The UnoPlayer instance if the player can rejoin, null otherwise.
     */
    canPlayerRejoin(privateId) {
        let player = this.getPrivatePlayer(privateId);
        if (!player) { return null; }
        if (!this.canRejoin()) { return null; }
        if (!player.isDisconnected() && (Date.now() - player.getDisconnectTime()) > UnoConfig.REJOIN_TIME) { return null; }
        if (player.isLeft()) { return null; }
        return player;
    }

    /** Gets the number of starting cards for each player.
     * @returns {number} The number of starting cards.
     */
    getStartCards() {
        return this.settings.startCards || UnoConfig.START_CARDS.default;
    }

    /** Gets the maximum number of cards a player can hold.
     * @returns {number} The maximum number of cards.
     */
    getMaxCards() {
        return this.settings.maxCards;
    }

    /** Gets the time limit for each player's turn.
     * @returns {number} The time limit in seconds.
     */
    getPlayerTime() {
        return this.settings.playerTime;
    }

    /** Whether drawing to match is enforced.
     * @returns {boolean} True if drawing to match is enforced, false otherwise.
     */
    drawToMatch() {
        return this.settings.drawToMatch;
    }

    /** Whether stacking of +2 and +4 cards is allowed.
     * @returns {boolean} True if stacking is allowed, false otherwise.
     */
    canStackCards() {
        return this.settings.canStackCards;
    }

    /** Changes the color of the current card if it's a PLUS_FOUR or COLOR_CHANGE card.
     * @param {string} color - The new color to set.
     * @returns {boolean} True if the color was changed, false otherwise.
     */
    changeColor(color) {
        //Check if current card is PLUS_FOUR or COLOR_CHANGE
        if ((this.currentCard?.type != 'PLUS_FOUR') && (this.currentCard?.type != 'COLOR_CHANGE')) { return false; }
        this.setChoosingColor(false);
        this.setCurrentCard({ color: color, type: this.currentCard.type });
        return true;
    }

    /** Gets the turn delay timer.
     * @returns {number|null} The turn delay timer.
     */
    getTurnDelay() {
        return this.turnTimer;
    }

    /** Starts the turn delay timer for the player.
     * After the delay, it sets the next player as the current player.
     * This is small delay after placing a card, to prevent instant next turn in case if stacking or jump in is enabled.
     * @param {string} playerId - The ID of the current player.
     * @param {number} by - The number of players to skip for the turn.
     */
    startTurnDelay(playerId, by) {
        if (this.turnTimer) { Timer.stop(this.turnTimer); }

        // Cache player ID in case if current player leaves during delay
        let nextPlayerId = this.getNextPlayerId(playerId, by);

        // Delay next move after selecting color or placing a card
        this.turnTimer = Number(Timer.start(() => {
            this.turnTimer = null; //Clear delay variable
            this.setCurrentPlayerId(nextPlayerId); //Get and set next player
            this.setUnoId(null); //Clear uno variable
            this.startPlayerTimer(); // This also triggers broadcastGameState()
        }, UnoConfig.TURN_DELAY));
    }

    /** Removes the turn delay timer and starts the player timer immediately. */
    removeTurnDelay() {
        if (this.turnTimer) { Timer.stop(this.turnTimer); }
        this.turnTimer = null;
        this.startPlayerTimer();
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

        if (this.playerTimer) { Timer.stop(this.playerTimer); }

        this.playerTimer = String(Timer.start((timer) => {            
            this.setRunOutOfTime(true);
            let isChoosingColor = this.isChoosingColor();
            let choosingCardId = this.getChoosingCardId();

            if (isChoosingColor) { this.handlePacket(this.getCurrentPlayer()?.getPeerId() || '', new ChangeColorPayload(UnoConfig.COLORS[UnoUtils.randomRange(0, UnoConfig.COLORS.length-1)])); }
            if (choosingCardId) { this.handlePacket(this.getPeerId(), new SaveCardPayload(choosingCardId)); }
            if (!isChoosingColor && !choosingCardId) { this.handlePacket(this.getCurrentPlayer()?.getPeerId() || '', new DrawCardPayload()); }
            this.setRunOutOfTime(false);
        }, this.getPlayerTime() * 1000 + 500, { id: UnoUtils.randomUUID() })); // Extra 500ms to prevent instant skip due to timer reaching 0

        let player = this.getCurrentPlayer();
        if (player?.isDisconnected()) { Timer.finish(this.playerTimer); } // If disconnected players turn arives then finish timer instantly
        if ((this.getPlayerTime() <= 0) && !player?.isDisconnected()) { Timer.stop(this.playerTimer); }

        // Update game state for all players, so they can see the timer
        this.broadcastGameState();
    }

    /** Gets the player timer for the current player's turn.
     * @returns {string | null} The player timer.
     */
    getPlayerTimer() {
        return this.playerTimer;
    }

    /** Gets the next player in turn order.
     * @param {string} playerId - The current player ID.
     * @param {number} by - The number of players to skip.
     * @returns {string} The next player ID or null if not found.
     */
    getNextPlayerId(playerId, by) {
        let playerIds = this.getPlayers().map((p) => p.getPlayerId());
        if (playerIds.length == 0) { throw new Error("[GameManager] getNextPlayerId -> No players in game"); }
        let index = playerIds.indexOf(playerId);
        if (index == -1) { return this.getRandomPlayerId(); } // If player not found, return random player

        index += this.getDirection(); // Move to next player based on direction
        while (index > playerIds.length-1) { index = index - playerIds.length; }
        while (index < 0) { index = playerIds.length + index; }

        playerId = playerIds[index];
        let player = this.getPlayer(playerId);

        // Return only if last by and player has not left
        // This check is NOW obsolete since fully left players are removed from game
        // But I will leave it here just in case
        return ((by <= 1) && player?.isOnline(false)) ? playerId : this.getNextPlayerId(playerId, (!player?.isOnline(false) ? by : by-1));
    }

    /** Gets a list of active players who are online.
     * @returns {UnoPlayer[]} An array of active UnoPlayer instances.
     */
    getActivePlayers() {
        return this.getPlayers().filter((e) => e.isOnline(false)); // Player can be disconnected but not left
    }

    /** Gets a random player ID from the list of active players.
     * @returns {string} A random player ID.
     */
    getRandomPlayerId() {
        let activePlayers = this.getActivePlayers();
        return activePlayers[UnoUtils.randomRange(0, activePlayers.length-1)].getPlayerId();
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
                var card_color = (card.color != 'ANY') ? card.color : this.currentCard?.color;
                return ((card_color == this.currentCard?.color) && (card.type == this.currentCard?.type));
            }).map(([card_id, _]) => card_id);

            // @ts-ignore
            if (cards.length > 0) { player.emit1('can_jump_in', { cards: cards }); }
        }
    }

    /** Checks if a card can be played based on the current placed card.
     * @param {{ color: string; type: string; }} card - The card to check.
     * @returns {{ canPlay: boolean; direction?: number; stack?: number; nextBy?: number; shouldPickColor?: boolean; }} An object indicating if the card can be played and additional info.
    */
    canPlayCard(card) {
        let stack = 0;
        let nextBy = 1;
        let direction = this.direction;
        let shouldPickColor = false;

        switch (card.type) {
            case 'REVERSE': //Can put on same color or same type, reverse direction, can be put after stack was taken
                if (this.stack > 0 || (card.color != this.currentCard?.color && card.type != this.currentCard?.type)) { return { canPlay: false }; }
                direction *= UnoConfig.DIRECTION_REVERSE;
                break;
            case 'BLOCK': //Can put on same color or same type, just skip by 1 more, can be put after stack was taken
                if (this.stack > 0 || (card.color != this.currentCard?.color && card.type != this.currentCard?.type)) { return { canPlay: false }; }
                nextBy += 1;
                break;
            case 'PLUS_TWO': //Cannot put PLUS_TWO on PLUS_FOUR, but can put it on anything else with same color, can be put after stack was taken
                if ((this.stack > 0 && this.currentCard?.type == 'PLUS_FOUR') || (card.color != this.currentCard?.color && card.type != this.currentCard?.type)) { return { canPlay: false }; }
                stack += 2;
                break;
            case 'PLUS_FOUR': //PLUS_FOUR can be aplied to everything there is no limits, so no need to check color or type
                shouldPickColor = true;
                stack += 4;
                break;
            case 'COLOR_CHANGE': //Cannot be put on PLUS_FOUR and PLUS_TWO, but can put it on anything else with different color, can be put after stack was taken
                if ((this.stack > 0 && (this.currentCard?.type == 'PLUS_FOUR' || this.currentCard?.type == 'PLUS_TWO'))) { return { canPlay: false }; }
                shouldPickColor = true;
                break;
            default:
                if (this.stack > 0 || ((card.color != this.currentCard?.color) && (card.type != this.currentCard?.type))) { return { canPlay: false }; }
        }

        return { canPlay: true, direction: direction, stack: stack, nextBy: nextBy, shouldPickColor: shouldPickColor };
    }

    /** Converts the current game state to a packet format.
     * @param {boolean} [avatar=true] - Whether to include player avatars in the packet.
     * @param {string | null} [peerId=null] - The peer ID of the player requesting the packet (for personalized data).
     * @returns {GameStatePayload} The game state in packet format.
     */
    toPacket(avatar = true, peerId = null) {
        return GameStatePayload.fromGameState(this, avatar, peerId);
    }

    /** Loads the game state from a packet.
     * @param {GameStatePayload} packet - The game state packet to load from.
     */
    fromPacket(packet) {
        let manager = packet.getGameManager();
        Object.assign(this, manager);
    }

    /** Broadcasts the current game state to all players.
     * @param {boolean} [avatar=true] - Whether to include player avatars in the broadcast.
     */
    broadcastGameState(avatar = true) {
        this.getPlayers().forEach((player) => {
            this.sendTo(player.getPeerId(), this.toPacket(avatar, player.getPeerId()));
        });

        this.handlePacket(this.getPeerId(), this.toPacket(avatar, this.getPeerId()), true); // Also handle for self packet, this will trigger events
    }
}