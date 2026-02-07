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
    /** @protected @type {{ [playerId: string]: { [cardId: string]: any; }; }} */ cards = {};
    /** @protected @type {{ [playerId: string]: UnoPlayer; }} */ players = {};
    /** @protected @type {boolean} */ started = false;
    /** @protected @type {boolean} */ migrating = false;
    /** @protected @type {number} */ stack = 0;
    /** @protected @type {string | null} */ unoId = null;
    /** @protected @type {string | null} */ blockedId = null;
    /** @protected @type {string | null} */ whoGotJumpedId = null;
    /** @protected @type {string | null} */ whoJumpedId = null;
    /** @protected @type {string | null} */ winnerId = null;
    /** @protected @type {{ color: string; type: string, id?: string } | null} */ currentCard = null;
    /** @protected @type {string} */ currentPlayerId = ''; // Player ID of current playing player
    /** @protected @type {number} */ direction = UnoConfig.DIRECTION_FORWARD;
    /** @protected @type {boolean} */ runOutOfTime = false;
    /** @protected @type {boolean} */ choosingColor = false;
    /** @protected @type {string|null} */ choosingCardId = null;
    /** @protected @type {string | null} */ playerTimer = null;
    /** @protected @type {number | null} */ turnTimer = null;
    /** @protected @type {string | null} */ playerTimerCounter = null;
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
    }

    async migrateHost() {
        this.setMigrating(true);
        this.broadcastGameStateSelf(false); // This will only notify us about the change, to show migrating screen

        // NOTE: If 2 players (HOST and NEXT OWNER) are disconnected one after another in very short time
        // We will not know it since if HOST is disconnected, we cannot know when other players diconnect
        // And then we won't be able to connect to NEXT OWNER, and there is honestly not really much we can do about it
        // Since trying to fix this will bring a lot of other issues

        //NOTE: If NEW HOST leaves before continuing the game, this really should not matter, since at that point we already should know
        // Who else in the list can be canditate for being NEXT HOST, and just try to connect to him or become HOST

        // Now get next player from current owner, and set them as new owner, we also have the check if next player is not disconnected
        // This will either find someone else who is not disconnected or just stop on us, and then we become a host
        do {
            let currentOwnerId = this.getOwner()?.getPlayerId();
            if (!currentOwnerId) { throw new Error("Current owner ID is null, cannot migrate host."); }
            let nexOwnerId = this.getNextPlayerId(currentOwnerId, 1)
            let nextOwnerPeerId = this.getPlayer(nexOwnerId)?.getPeerId();
            if (!nextOwnerPeerId) { throw new Error("Could not find next owner peer ID"); }
            this.setOwnerPeerId(nextOwnerPeerId);
        } while (this.getOwner()?.isDisconnected())

        if (this.getOwnerPeerId() == this.getPeerId()) {
            this.setHost(true); // This will allow us to accept connections and packets
            this.stopGame(); // This only stops timers, only resets variables, since clients do not really have any of these timers running
            this.getPlayers().forEach((player) => player.disconnectPlayer()); // Render all players as disconnected
            this.getMyPlayer()?.setReconnected(); // Set ourself as reconnected
            this.broadcastGameStateSelf(false); // Render players as disconnected for ourself
            await UnoUtils.wait(UnoConfig.MIGRATION_TIME); // Wait a bit to let players connect before we continue game

            // Before removing diconnected players, we have to check who is current player, if they are disconnected, we have to skip their turn
            let currentlyDisconnected = this.getPlayer(this.getCurrentPlayerId())?.isDisconnected()
            if (!this.isWinner() && currentlyDisconnected) { this.setCurrentPlayerId(this.getNextPlayerId(this.getCurrentPlayerId(), 1, true)); }
            if (!this.isWinner() && currentlyDisconnected && this.getChoosingCardId()) { this.setChoosingCardId(null); }
            if (!this.isWinner() && currentlyDisconnected && this.isChoosingColor()) { this.changeColor(this.getRanomColor()); }

            let temp = UnoConfig.NEXT_GAME_TIMEOUT;
            UnoConfig.NEXT_GAME_TIMEOUT = 1; // Shorten time for next game start, since we want to start it as sooner after host migration (BEAUSE WE DON'T KNOW ACTUAL GAME TIME)
            if (this.isWinner()) { this.setWinnerId(this.getCurrentPlayerId()); } // This will also trigger restart game after timeout
            UnoConfig.NEXT_GAME_TIMEOUT = temp; // Reset next game timeout to default value

            // We as a new host cannot continue game with disconnected players, because if they did not recconect in this small period of time
            // We have no clue what is their privtate ID, so we cannot nor get their cards, nor add them, so only option is to remove these players
            let disconnectedPlayers = this.getPlayers().filter(p => p.isDisconnected());
            disconnectedPlayers.forEach(p => this.removePlayer(p.getPlayerId())); // Now fully remove players who are still disconnected after timeout
            if (!this.isWinner()) { this.startPlayerTimer(false); } // removePlayer() also skips turns if current player is disconnected
            this.setMigrating(false);
            return this.broadcastGameState();
        }

        await UnoUtils.wait(500); // Wait a bit to let new host set up before we start sending packets to them
        let invite = this.getOwnerPeerId();

        // Theoretically our peerId should not change, because we are already connected to peer server we just changing host peerId
        for (let i = 1; i <= UnoConfig.MIGRATION_ATTEMPTS; i++) {
            let id = await this.init(invite, true).catch(() => {});
            if (!id && (i == UnoConfig.MIGRATION_ATTEMPTS)) { alert("Failed to migrate host after " + UnoConfig.MIGRATION_ATTEMPTS + " attempts, returning to main menu."); location.reload(); }
            if (id) { break; } else if (i == UnoConfig.MIGRATION_ATTEMPTS) { return; } // If failed to connect to new host after max attempts, just return
        }

        // Now we are connected to new host, we just need to send them join request again
        let myPlayer = this.getMyPlayer();
        if (!myPlayer) { throw new Error("My player is null, cannot send join request after host migration."); }
        this.send(new JoinRequestPayload(invite, myPlayer.getUsername()));
    }

    /** Starts the game if the caller is the host. If the game has already started, it will reset the game state if reset is true.
     * @param {boolean} reset - Whether to reset the game state if the game has already started.
     */
    startGame(reset = false) {
        if (!this.isHost()) { return console.warn("[GameManager] Only host can start the game."); }
        if (this.isStarted() && !reset) { return; } // Prevent restarting an already started game

        this.stopGame(); // Stop any existing timers
        this.setStarted(true);
        this.setDirection(UnoConfig.DIRECTION_FORWARD);
        this.setStack(0);
        this.setUnoId(null);
        this.setWinnerId(null);
        this.setWhoGotJumpedId(null);
        this.setWhoJumpedId(null);
        this.setBlockedId(null);
        this.setChoosingColor(false);
        this.setChoosingCardId(null);
        this.setRunOutOfTime(false);

        this.cards = {}; // Clear all player cards
        this.setCurrentPlayerId(this.getRandomPlayerId()); // Set random player as starting player
        this.setCurrentCard(GameManager.generateCard(false));
        this.getPlayers().forEach((player) => this.generateCards(player.getPlayerId(), true, this.getStartCards())); // Generate starting cards for each player
        this.startPlayerTimer(); // Start timer for each player turn

        this.broadcastGameState();
    }

    /** Stops the game if the caller is the host. This will remove any active timers. */
    stopGame() {
        if (!this.isHost()) { return console.warn("[GameManager] Only host can stop the game."); }
        this.removeTurnDelay();
        this.removePlayerTimer();
    }

    /** Sends a request to place a card on the current card. The actual card placement will be handled by the host after validating the move.
     * @param {string} cardId - The uncrypted ID of the card to place.
    **/
    clientPlaceCard(cardId) {
        if (this.isHost()) { this.handlePacket(this.getPeerId(), new PlaceCardPayload(cardId)); }
        if (!this.isHost()) { this.send(new PlaceCardPayload(cardId)); }   
    }

    /** Sends a request to change the color of the current card. The actual color change will be handled by the host after validating the move.
     * @param {string} color - The new color to change to.
    */
    clientChangeColor(color) {
        if (!UnoConfig.COLORS.includes(color)) { return alert(`[GameManager] clientChangeColor() -> Invalid color ${color}.`); }
        if (this.isHost()) { this.handlePacket(this.getPeerId(), new ChangeColorPayload(color)); }
        if (!this.isHost()) { this.send(new ChangeColorPayload(color)); }
        
    }

    /** Sends a request to save a card for later play. The actual saving will be handled by the host after validating the move.
     * @param {string} cardId - The uncrypted ID of the card to save.
    **/
    clientSaveCard(cardId) {
        if (this.isHost()) { this.handlePacket(this.getPeerId(), new SaveCardPayload(cardId)); }
        if (!this.isHost()) { this.send(new SaveCardPayload(cardId)); }
    }

    /** Sends a request to draw a card from the deck. The actual drawing will be handled by the host after validating the move.
     * Remeber this also can be called as host, so we have to handle that as well.
    */
    clientDrawCard() {
        if (this.isHost()) { this.handlePacket(this.getPeerId(), new DrawCardPayload()); }
        if (!this.isHost()) { this.send(new DrawCardPayload()); }
    }

    /** Sends a request to call UNO. The actual call will be handled by the host after validating the move.
     * Remeber this also can be called as host, so we have to handle that as well.
    */
    clientCallUno() {
        if (this.isHost()) { this.handlePacket(this.getPeerId(), new UnoPressPayload()); }
        if (!this.isHost()) { this.send(new UnoPressPayload()); }
    }

    /**
     * Generates a random card from the deck.
     * @param {boolean} includeSpecial - Whether to include special cards in the generation.
     * @returns {{ color: string; type: string }} The generated card identifier.
     */
    static generateCard(/** @type boolean **/ includeSpecial) {
        let cards = (includeSpecial && (UnoUtils.randomRange(1, 2) == 2)) ? UnoConfig.CARDS.special : UnoConfig.CARDS.standart;
        return { ...cards[UnoUtils.randomRange(0, Object.keys(cards).length - 1)] }; // Return a copy of the card object
    }

    /** Generates encrypted starting cards for a player
     * @param {string} playerId - The ID of the player to generate cards for.
     * @param {boolean} includeSpecial - Whether to include special cards in the generation.
     * @param {number} amount - The number of cards to generate.
     * @returns {{ [cardId: string]: { color: string; type: string } }} The generated unencrypted cards mapped by their unique IDs.
     */
    generateCards(/** @type string **/ playerId, /** @type boolean **/ includeSpecial, amount = 0) {
        let player = this.getPlayer(playerId);
        if (!player || !player.getPrivateId()) { throw new Error(`[GameManager] generateCards() -> Player[playerId=${playerId}] not found or has no private ID.`); }
        if (!this.cards[playerId]) { this.cards[playerId] = {} }

        /** @type {{ [cardId: string]: { color: string; type: string } }} */
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
     * @returns {{ [cardId: string]: { color: string; type: string } }} The decrypted cards of the specified player.
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

    /** Gets the owner player of a card by its uncrypted ID
     * @param {string} cardId - The uncrypted ID of the card to find the owner for.
     * @returns {UnoPlayer | null} The owner UnoPlayer instance, or null if not found.
     */
    getCardOwner(cardId) {
        for (const playerId in this.cards) {
            let card = this.getPlayerCard(playerId, cardId);
            if (card) { return this.getPlayer(playerId); }
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
     * @param {UnoPlayer} packetPlayer - The UnoPlayer instance to add or update in the game.
     * @returns {UnoPlayer}
     */
    addPlayer(packetPlayer) {
        // First check if player with same private ID exists and allow rejoin
        let privatePlayer = this.getPrivatePlayer(packetPlayer.getPrivateId());
        privatePlayer?.setPeerId(packetPlayer.getPeerId());
        privatePlayer?.setReconnected();
        let privateId = privatePlayer?.getPrivateId() || packetPlayer.getPrivateId(); // In case if player is migrating, we as new host have no clue what is their private ID, so we take on from packet
        if (privatePlayer) { packetPlayer = privatePlayer; }

        // Set secret id for host migration, others don't know player private ID, but they can verify it by using secret ID
        privatePlayer?.setPrivateId(privateId); // We either set same private ID for rejoining player, or set one for migrating player, in both cases secret ID will be the same
        if (!packetPlayer.getPrivateId()) { throw new Error(`[GameManager] addPlayer() -> Player[playerId=${packetPlayer.getPlayerId()}] has no private ID.`); }
        packetPlayer.setSecretId(UnoUtils.encryptString(packetPlayer.getPlayerId(), String(packetPlayer.getPrivateId())));

        let player = this.getPlayer(packetPlayer.getPlayerId());
        if (!player) { player = this.players[packetPlayer.getPlayerId()] = packetPlayer; }
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

        // In case if game not yet started or player didn't rejoin in time, remove him fully
        if (!this.isStarted() || player.isDisconnected()) { delete this.players[playerId]; }
        if (!this.isStarted() || player.isDisconnected()) { delete this.cards[playerId]; }
        if (!this.isStarted() || player.isDisconnected()) { return this.broadcastGameState(); }

        // If player is not disconnected we set him as disconnected and start the timer
        // If player cannot rejoin timer will not be started and player will be immediately delete later after some game logic
        // If timer runs out, the player will also just be removed immediately
        player.disconnectPlayer(this.canRejoin() ? () => this.removePlayer(playerId) : () => {});

        // This is in case if player left while it was his turn
        if (this.getCurrentPlayerId() != playerId) { this.broadcastGameState(); } // Remember: startPlayerTimer() -> broadcastGameState()
        if (this.getCurrentPlayerId() == playerId) { this.startPlayerTimer(); } // In case if player is disconnected, this will fire timer inmediately

        if (!this.canRejoin()) { delete this.players[playerId]; } // Have to remove player after startPlayerTimer()
        if (!this.canRejoin()) { this.broadcastGameState(); } // Yeah double sending message, not good, but who cares
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
     * @param {string|null} playerId - The ID of the player to retrieve.
     * @returns {UnoPlayer | null} The UnoPlayer instance corresponding to the given ID, or null if not found.
     */
    getPlayer(playerId) {
        // OH NOOOO :(((, CHECKING WITH "null", WHO CARES!!!, IT IS STILL GONNA NOT FIND ANYTHING WITH "null" ID :D
        return this.players[String(playerId)] ? this.players[String(playerId)] : null;
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

    /** Gets my player ID
     * @returns {string | null} My player ID, or null if not found.
     */
    getMyPlayerId() {
        return this.getMyPlayer()?.getPlayerId() || null;
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
        let player = Object.values(this.players).find(player => player.getPrivateId() == privateId);
        return player ? player : this.getSecretPlayer(privateId);
    }

    /** Gets a player by their secret ID (used for host migration)
     * @param {string | null} privateId - The private ID to match against the decrypted secret IDs of players.
     * @returns {UnoPlayer | undefined} The UnoPlayer instance corresponding to the given private ID, or null if not found.
     */
    getSecretPlayer(privateId) {
        return Object.values(this.players).find(player => {
            if (!player.getSecretId()) { return false; }
            let decryptedSecretId = UnoUtils.decryptString(String(player.getSecretId()), String(privateId));
            return (decryptedSecretId == player.getPlayerId());
        });
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
    getOwnerPeerId() {
        return this.roomId;
    }

    /** Gets game owner
     * @returns {UnoPlayer | undefined} The owner player instance or null if owner is not yet added (WHEN JOINING)
     */
    getOwner() {
        let owner = this.getPeerPlayer(this.getOwnerPeerId());
        //if (!owner) { throw new Error("[GameManager] getOwner() -> Owner player not found."); }
        return owner;
    }

    /** Sets the owner ID of the game. (roomId = ownerId)
     * @param {string} peerId - The new owner ID.
     * @returns {string} The updated owner ID.
     */
    setOwnerPeerId(peerId) {
        return (this.roomId = peerId);
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

    /** Checks if the host migration process is currently ongoing.
     * @param {boolean} migrating - The new migrating status.
     * @returns {boolean} True if the host migration process is ongoing, false otherwise.
     */
    setMigrating(migrating) {
        return (this.migrating = migrating);
    }

    /** Checks if the host migration process is currently ongoing.
     * @returns {boolean} True if the host migration process is ongoing, false otherwise.
     */
    isMigrating() {
        return this.migrating;
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
        return Math.max((this.playerTimerCount || 0), 0);
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

    /** Gets the ID of the current card in deck, the id is randomly generated when the card is set as current card, and is used for animation purposes on client side, it has no meaning on server side.
     * @returns {string | null} The current card ID, or null if there is no current card.
     */
    getCurrentCardId() {
        return this.currentCard?.id || null;
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
        return (this.unoId = unoId);
    }

    /** Gets the UNO caller ID.
     * @returns {string | null} The UNO caller ID or null if no one called UNO.
     */
    getUnoId() {
        return this.unoId;
    }

    /** Sets the blocked player ID.
     * @param {string | null} blockedId - The ID of the blocked player.
     */
    setBlockedId(blockedId) {
        this.blockedId = blockedId;
    }

    /** Gets the blocked player ID.
     * @returns {string | null} The blocked player ID or null if no player is blocked.
     */
    getBlockedId() {
        return this.blockedId;
    }

    /** Sets the ID of the player who got jumped in the last turn.
     * @param {string | null} whoGotJumpedId - The ID of the player who got jumped.
     */
    setWhoGotJumpedId(whoGotJumpedId) {
        this.whoGotJumpedId = whoGotJumpedId;
    }

    /** Gets the ID of the player who got jumped in the last turn.
     * @returns {string | null} The ID of the player who got jumped, or null if no player got jumped.
     */
    getWhoGotJumpedId() {
        return this.whoGotJumpedId;
    }

    /** Sets the ID of the player who jumped in the last turn.
     * @param {string | null} whoJumpedId - The ID of the player who jumped.
     */
    setWhoJumpedId(whoJumpedId) {
        this.whoJumpedId = whoJumpedId;
    }

    /** Gets the ID of the player who jumped in the last turn.
     * @returns {string | null} The ID of the player who jumped, or null if no player jumped.
     */
    getWhoJumpedId() {
        return this.whoJumpedId;
    }

    /**
     * Sets the winner ID of the game.
     * @param {string | null} winnerId - The ID of the winner.
     * @returns {string | null} The winner ID.
     */
    setWinnerId(winnerId) {
        if (!winnerId) { return (this.winnerId = null); }
        this.stopGame(); // This will only stop timers
        Timer.start(() => this.startGame(true), UnoConfig.NEXT_GAME_TIMEOUT * 1000 + 500); // Restart game after n amount of time
        return (this.winnerId = winnerId);
    }

    /**
     * Gets the winner ID of the game.
     * @returns {string | null} The winner ID or null if no winner exists.
     */
    getWinnerId() {
        return this.winnerId;
    }

    /** Checks if there is a winner in the game.
     * @returns {boolean} True if there is a winner, false otherwise.
     */
    isWinner() {
        return (this.winnerId != null);
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

    /** Gets a random color from the available Uno colors.
     * @returns {string} A random color from the Uno colors.
     */
    getRanomColor() {
        return UnoConfig.COLORS[UnoUtils.randomRange(0, UnoConfig.COLORS.length-1)];
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

    /** Removes the turn delay timer if it exists. */
    removeTurnDelay() {
        if (this.turnTimer) { Timer.stop(this.turnTimer); }
        this.turnTimer = null;
    }

    /** Removes the player timer for the current player's turn if it exists. */
    removePlayerTimer() {
        if (this.playerTimer) { Timer.stop(this.playerTimer); }
        if (this.playerTimerCounter) { Timer.stop(this.playerTimerCounter); }
        this.playerTimerCount = 0;
        this.playerTimer = null;
        this.playerTimerCounter = null;
    }

    /** Starts the player timer for the current player's turn.
     * If the timer expires, the player is skipped and a card is drawn automatically.
     * @param {boolean} broadcast - Whether to broadcast the game state after starting the timer.
     */
    startPlayerTimer(broadcast = true) {
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

        this.setBlockedId(null); // Clear blocked ID on new turn
        if (this.playerTimer) { Timer.stop(this.playerTimer); }
        if (this.playerTimerCounter) { Timer.stop(this.playerTimerCounter); }

        this.playerTimer = String(Timer.start(() => {            
            this.setRunOutOfTime(true);
            let isChoosingColor = this.isChoosingColor();
            let choosingCardId = this.getChoosingCardId();

            if (isChoosingColor) { this.handlePacket(this.getCurrentPlayer()?.getPeerId() || '', new ChangeColorPayload(this.getRanomColor())); }
            if (choosingCardId) { this.handlePacket(this.getPeerId(), new SaveCardPayload(choosingCardId)); }
            if (!isChoosingColor && !choosingCardId) { this.handlePacket(this.getCurrentPlayer()?.getPeerId() || '', new DrawCardPayload()); }
            this.setRunOutOfTime(false);
        }, this.getPlayerTime() * 1000 + 500, { id: UnoUtils.randomUUID() })); // Extra 500ms to prevent instant skip due to timer reaching 0

        // Just current second counter for visual purposes, when player rejoins
        this.playerTimerCount = this.getPlayerTime(); // Goes from playerTime to 0
        this.playerTimerCounter = String(Timer.start((timer) => {
            this.playerTimerCount = this.getPlayerTimerCount() - 1;
        }, 1000, { interval: true }));

        let player = this.getCurrentPlayer();
        if (this.isWinner()) { this.removePlayerTimer(); } // In case if game has a winner, we just don't allow timers, but we do allow broadcast
        if (player?.isDisconnected()) { Timer.finish(this.playerTimer); } // If disconnected players turn arives then finish timer instantly
        if ((this.getPlayerTime() <= 0) && !player?.isDisconnected()) { this.removePlayerTimer(); } // If player time is 0 or less, they have infinite time

        // Update game state for all players, so they can see the timer
        if (broadcast) { this.broadcastGameState(); }
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
    getNextPlayerId(playerId, by, onlyOnline = false) {
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
        let nextPlayerId = ((by <= 1) && player?.isOnline(false)) ? playerId : this.getNextPlayerId(playerId, (!player?.isOnline(false) ? by : by-1));
        if (this.getPlayer(nextPlayerId)?.isDisconnected()) { return this.getNextPlayerId(nextPlayerId, by); } // Skip disconnected players
        return nextPlayerId;
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

    /** Gets a list of playable card IDs for the current player based on the game state.
     * @param {string|null} playerId - The ID of the player to check for playable cards.
     * @returns {string[]} An array of playable card IDs.
     */
    getPlayableCards(playerId) {
        // If we are current player and there are no turn delay, just highlight all playable cards
        // If we are current player and turn delay is active, highlight only stackable cards
        // If we are not current player and turn delay is active, highlight only jump in cards

        let myPlayer = this.getPlayer(playerId);
        if (!myPlayer) { return []; }

        // Current player and no turn delay -> all playable cards
        let rule1 = (myPlayer.getPlayerId() == this.getCurrentPlayerId()) && !this.getTurnDelay();

        // Current player, turn delay active, and stacking enabled -> only stackable cards
        let rule2 = (myPlayer.getPlayerId() == this.getCurrentPlayerId()) && this.getTurnDelay() && this.canStackCards();

        // Not current player, not blocked, turn delay active, and jump in enabled -> only jump in cards
        let rule3 = (myPlayer.getPlayerId() != this.getCurrentPlayerId()) && (myPlayer.getPlayerId() != this.getBlockedId()) && this.getTurnDelay() && this.canJumpIn();

        // These are all playable cards, even those that you should not be able to stack or jump in with
        let cards = Object.fromEntries(Object.entries(this.getPlayerCards(myPlayer.getPlayerId())).filter(([_, card]) => this.canPlayCard(card).canPlay));
        if (rule1) { return Object.keys(cards); }

        // Filter only stackable or jump in cards
        cards = !(rule2 || rule3) ? {} : Object.fromEntries(Object.entries(cards).filter(([_, card]) => {
            var card_color = (card.color != 'ANY') ? card.color : this.currentCard?.color;
            return ((card_color == this.currentCard?.color) && (card.type == this.currentCard?.type));
        }));

        return Object.keys(cards);
    }

    /** Checks if a specific card can be played by its ID.
     * @param {string} cardId - The ID of the card to check.
     * @returns {boolean} True if the card is playable, false otherwise.
     */
    isPlayableCard(cardId) {
        let player = this.getCardOwner(cardId);
        if (!player) { return false; }
        return this.getPlayableCards(player.getPlayerId()).includes(cardId);
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
            this.sendTo(player.getPeerId(), this.toPacket(avatar, player.getPeerId())); // This wont work for US, because OUR connection is not in the list
        });

        this.broadcastGameStateSelf(avatar); // Handle OURSELF, to also see changes
    }

    broadcastGameStateSelf(avatar = true) {
        this.handlePacket(this.getPeerId(), this.toPacket(avatar, this.getPeerId()), true); // Also handle for self packet, this will trigger events
    }
}