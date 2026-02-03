// @ts-check

import { GameManager } from '../game.js';
import { PlaceCardPayload } from '../packets.js';
import { UnoPlayer } from '../player.js';
import { Timer } from '../utils/timers.js';
import { UnoUtils } from '../utils/utils.js';

/** @type {any} */
const $ = (/** @type {any} */(window)).$;

export class GameUI {
    static { // @ts-ignore
        window.GameUI = GameUI;
    }

    /**
     * Plays a sound effect
     * @param {string} name - Filename in resources/sounds/
     */
    static playSound(name) {
        const audio = new Audio(`${window.location.href}resources/sounds/${name}`);
        audio.volume = 1;
        audio.play().catch(e => console.warn("Audio blocked:", e));
    }

    /** Shows the game scene and hides the login scene. */
    static showGameScene() {
        $("#login-container").addClass("hidden");
        $("#game-container").removeClass("hidden");
    }

    /** Creates or updates player element in the UI.
     * @param {UnoPlayer} player - The player.
     */
    static createPlayer(player) {
        if (player.isLeft()) { return } // We don not render fully left players (THEY SHOULD NOT BE EVEN IN THE LIST)

        if ($(`#${player.getPlayerId()}`)[0]) {
            $(`#username_${player.getPlayerId()}`)[0].className = "username" + (player.isDisconnected() ? " disconnected" : "");
            $(`#username_${player.getPlayerId()}`)[0].innerHTML = player.getUsername();
            $(`#avatar_${player.getPlayerId()}`)[0].src = player.getAvatar() || 'resources/defaultAvatar.png';
            $(`#count_${player.getPlayerId()}`)[0].innerHTML = String(player.getCardCount());
        } else {
            let divElement = document.createElement("div");
            divElement.className = "player";
            divElement.id = player.getPlayerId();
        
            let usernameElement = document.createElement("label");
            usernameElement.className = "username" + (player.isDisconnected() ? " disconnected" : "");
            usernameElement.id = `username_${player.getPlayerId()}`;
            usernameElement.innerHTML = player.getUsername();

            let avatarElement = document.createElement("img");
            avatarElement.className = "avatar";
            avatarElement.id = `avatar_${player.getPlayerId()}`;
            avatarElement.draggable = false;
            avatarElement.width = 64;
            avatarElement.height = 64;
            avatarElement.src = player.getAvatar() || 'resources/defaultAvatar.png';

            let overlayElement = document.createElement("img");
            overlayElement.className = "overlay";
            overlayElement.id = `overlay_${player.getPlayerId()}`;
            overlayElement.draggable = false;
            overlayElement.width = 64;
            overlayElement.height = 64;

            let countElement = document.createElement("label");
            countElement.className = "count";
            countElement.id = `count_${player.getPlayerId()}`;
            countElement.innerHTML = String(player.getCardCount());

            divElement.appendChild(usernameElement);
            divElement.appendChild(avatarElement);
            divElement.appendChild(overlayElement);
            divElement.appendChild(countElement);
            $("#players")[0].appendChild(divElement);
        }

        $(".crown").removeClass("crown");
        const owner = GameManager.getInstance().getOwner();
        if (owner) { $(`#username_${owner.getPlayerId()}`).addClass("crown"); }

        $(".glow").removeClass("glow");
        const current = GameManager.getInstance().getCurrentPlayer();
        if (current) { $(`#username_${current.getPlayerId()}`).addClass("glow"); }
    }

    /** Removes player element in the UI with sliding animation.
     * @param {string} playerId - The player.
     */
    static removePlayer(playerId) {
        if (!$(`#${playerId}`)[0] || $(`#${playerId}`)[0].classList.contains("remove")) { return; }
        $(`#${playerId}`).find(`[id*="${playerId}"]`).attr('id', () => crypto.randomUUID());
        const placeholder = ($(`#${playerId}`)[0].id = crypto.randomUUID()); // Fix renderPlayers()
        setTimeout(() => $(`#${placeholder}`).addClass("remove"), 300);
        $(`#${placeholder}`)[0].addEventListener('animationend', () => $(`#${placeholder}`)[0]?.remove(), { once: true });
    }

    static renderPlayers() {
        // Current UI players (ignore ones already removing)
        // Left players should also be removed from game state
        // This should recreate player list in same order as game state
        const uiPlayers = Array.from($(".player")).filter(el => !el.classList.contains("remove"));
        const gamePlayers = GameManager.getInstance().getPlayers();
        const max = Math.max(gamePlayers.length, uiPlayers.length);

        for (var i = 0; i < max; i++) {
            // Game has player, UI missing -> create
            if (!uiPlayers[i] && gamePlayers[i]) {
                GameUI.createPlayer(gamePlayers[i]);
            }

            // Update existing players
            if (gamePlayers[i] && (uiPlayers[i]?.id == gamePlayers[i].getPlayerId())) {
                GameUI.createPlayer(gamePlayers[i]);
            }

            // UI exists but game missing OR wrong order -> remove UI
            // THIS HAS POTENTIAL BUG WITH DEALING MULTIPLE CHANGES AT THE SAME TIME, AND I DO NOT CARE
            // This works correctly, what doesn't is the animation, when order is broken it will removePlayer then createPlayer
            // But technically ui player is not yet removed
            if (uiPlayers[i] && (!gamePlayers[i] || uiPlayers[i].id != gamePlayers[i].getPlayerId())) {
                GameUI.removePlayer(uiPlayers[i].id);
                uiPlayers.splice(i, 1); // BLA BLA BLA, CONCURRENT MODIFICATION, WHO CARES
                i--; // IDK, This only handles for wrong order, might cause some issues
            }
        }

        this.prepareSettings();
    }

    static renderDeck() {
        $("#UNO_CARD").toggleClass("hidden", GameManager.getInstance().isStarted());
        let currentCard = GameManager.getInstance().getCurrentCard();
        if (!currentCard) { return; }

        // If the current card is already shown, do not add another one
        let currentUiCard = $("#cards-desk img").not("#UNO_CARD").last();
        if (currentUiCard?.attr("src")?.includes(`${currentCard.color}_${currentCard.type}`)) { return; }

        // Add card to desk with animation
        var img = document.createElement("img");

        // When animation ends, remove the first card (old one)
        img.addEventListener('animationend', () => {
            if ($("#cards-desk img").not("#UNO_CARD").length > 1) {
                $("#cards-desk img").not("#UNO_CARD").first().remove();
            }
        }, { once: true });

        // Set image properties
        img.className = "card-desk";
        img.src = `resources/cards/${currentCard.color}_${currentCard.type}.png`;
        img.draggable = false;
        $('#cards-desk')[0].appendChild(img);

        // Play sound based on card type
        switch(currentCard.type) {
            case "REVERSE":
                GameUI.playSound("reverse.mp3");
                break;
            case "BLOCK":
                GameUI.playSound("block.mp3");
                break;
            case "PLUS_TWO":
                GameUI.playSound("plus_two.mp3");
                break;
            case "PLUS_FOUR":
                GameUI.playSound("plus_four.mp3");
                break;
            default:
                GameUI.playSound("card_place.mp3");
        }
    }

    // Renders the cards of the current player.
    static renderCards() {
        const game = GameManager.getInstance();
        const me = game.getMyPlayer();
        if (!me) { return; }

        // Get current player's cards
        let cards = GameManager.getInstance().getPlayerCards(me.getPlayerId());

        // Remove non-existing cards from UI
        Array.from($("#cards .card")).filter(el => cards[el.id] == null).forEach(el => el.remove());
        let uiCards = Array.from($("#cards .card")).filter(el => cards[el.id] != null);
        let addCards = Object.keys(cards).filter(cardId => !uiCards.find(el => el.id == cardId));

        // Add missing cards to UI
        addCards.forEach(cardId => {
            var img = document.createElement("img");
            img.className = "card";
            img.id = cardId;
            img.src = `resources/cards/${cards[cardId].color}_${cards[cardId].type}.png`;
            img.draggable = false;
            img.addEventListener("click", () => game.handlePacket(game.getPeerId(), new PlaceCardPayload(cardId)), false);
            $('#cards')[0].appendChild(img);
        });

        // Disable cards if it's not player's turn
        $("#cards .card").toggleClass("disabled", (game.getCurrentPlayerId() != me.getPlayerId()));

        // Enable/disable deck
        $("#carddeck").toggleClass("disabled", (game.getCurrentPlayerId() != me.getPlayerId()));

        //TODO: NOW WE NEED TO RENDER JUMP IN CARDS
        game.sendWhoCanJumpIn
        $("#cards").removeClass("disabled");
        $(".card").removeClass('jumpin')
    }

    // Renders the player cover overlay.
    static renderPlayerCover() {
        // THIS SHOULD ONLY RUN WHEN CURRENT MOVE CHANGES
        // So ideally we should store currentMoveId and compare it here

        const game = GameManager.getInstance();
        if (!game.isStarted()) { return; }
        let currentMoveId = game.getCurrentMoveId();
        if (Timer.exists(currentMoveId)) { return; }

        Timer.start(() => {
            if (currentMoveId !== game.getCurrentMoveId()) { return Timer.stop(currentMoveId); }
            let playerId = game.getCurrentPlayerId();
            GameUI.setOverlayText(playerId, String(Number(Timer.getRemaining(currentMoveId))+1));
        }, 1000, { immediate: true, id: currentMoveId, interval: true, amount: game.getPlayerTime()-1 });
    }

    /** Renders the game UI, updating player list and room ID display. */
    static render() {
        GameUI.renderPlayers();
        GameUI.renderCards();
        GameUI.renderDeck();
        GameUI.renderPlayerCover();
        GameUI.setStack(GameManager.getInstance().getStack());

        $("#room-id")[0].innerText = '*'.repeat(GameManager.getInstance().getRoomId().length);
        $("#arrow").toggleClass("hidden", !GameManager.getInstance().isStarted());

        let direction = GameManager.getInstance().getDirection();
        $("#arrow").toggleClass("directionRight", direction > 0);
        $("#arrow").toggleClass("directionLeft", direction < 0);
    }

    /** Sets overlay image on player's avatar.
     * @param {string} playerId - The ID of the player.
     * @param {string} src - The source URL of the overlay image.
     */
    static setOverlay(playerId, src) {
        if (!$(`#overlay_${playerId}`)[0]) { return; }
        $(`#overlay_${playerId}`)[0].src = src;
        $(`#overlay_${playerId}`).removeClass("popup");
        void $(`#overlay_${playerId}`)[0].offsetWidth;
        $(`#overlay_${playerId}`).addClass("popup");
    }

    /** Sets overlay text on player's avatar.
     * @param {string} playerId - The ID of the player.
     * @param {string} text - The text to display on the overlay.
     */
    static setOverlayText(playerId, text) {
        var canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        let ctx = canvas.getContext("2d");
        if (!ctx) { throw new Error("2D context not supported"); }

        ctx.font = "27px Uni_Sans_Heavy";
        ctx.fillStyle = "white";
        ctx.lineWidth = 1.7;
        ctx.strokeStyle = "black";
        let x = (canvas.width - ctx.measureText(text).width)/2;
        let fontSizeMatch = ctx.font.match(/\d+/);
        let fontSize = fontSizeMatch ? parseInt(fontSizeMatch[0], 10) : 27;
        let y = (canvas.height/2 + fontSize/2)-2;

        ctx.fillText(text, x, y);
        ctx.strokeText(text, x, y);
        GameUI.setOverlay(playerId, canvas.toDataURL("image/png"));
    }

    /** Creates or updates player element in the settings UI.
     * @param {UnoPlayer} player - The player.
     */
    static createSettingPlayer(player) {
        let divElement = document.createElement("div");
        divElement.className = "setting setting-player";

        let avatarElement = document.createElement("img");
        avatarElement.className = "setting-avatar";
        avatarElement.src = player.getAvatar() || 'resources/defaultAvatar.png';
        avatarElement.draggable = false;

        let usernameElement = document.createElement("label");
        usernameElement.className = "setting-username";
        usernameElement.innerHTML = player.getUsername();

        let owner = GameManager.getInstance().getOwner();
        if (owner?.getPlayerId() == player.getPlayerId()) { usernameElement.className += " crown"; }
        if (player.isDisconnected()) { usernameElement.className += " disconnected"; }

        let kickElement = document.createElement("span");
        kickElement.className = "button kick";
        kickElement.innerHTML = "Kick";

        kickElement.addEventListener("click", () => {
            GameManager.getInstance().kickPlayer(player.getPlayerId());
        }, false);

        let mePlayer = GameManager.getInstance().getPeerPlayer(GameManager.getInstance().getPeerId())
        if (mePlayer?.getPlayerId() == player?.getPlayerId()) { kickElement.className += " disabled"; }
        if (mePlayer?.getPlayerId() != owner?.getPlayerId()) { kickElement.className += " invisible"; }

        divElement.appendChild(avatarElement);
        divElement.appendChild(usernameElement);
        divElement.appendChild(kickElement);
        $("#game-container #settings-wrapper")[0].appendChild(divElement);
    }

    /** Prepares the settings UI by populating it with current players. */
    static prepareSettings() {
        $(".setting-player").remove();
        let scrollTop = $("#game-container #settings-wrapper")[0].scrollTop;
        let players = GameManager.getInstance().getPlayers();
        players.forEach((player) => this.createSettingPlayer(player));
        $("#game-container #settings-wrapper")[0].scrollTop = scrollTop;
    }

    /**
     * @param {boolean} enabled - Show or hide settings window
     */
    static showSettings(enabled) {
        $("#game-container #settings-container")[0].style = `transform: translate(-50%, -50%) scale(${enabled ? 1 : 0});`
    }

    /** Sets the stack count display and shows/hides the stacking container based on the stack value.
     * @param {number} stack - The current stack count.
     **/
    static setStack(stack) {
        // If stack is 0 and container is not already hidden, hide it or show it if false
        if ((stack == 0) && !$("#stacking-container").hasClass("PopIn")) { return; }
        if (stack > 0) { $("#stacking-count")[0].innerHTML = `+${stack}`; }
        $("#stacking-container").toggleClass("PopIn", stack > 0);
        $("#stacking-container").toggleClass("PopOut", stack == 0);
    }

    /** Shows or hides the color selection container.
     * @param {boolean} show - Whether to show the color selection container.
     */
    static showColorChoose(show) {
        if (!show && !$("#color-select").hasClass("PopIn")) { return; }
        $("#color-select").toggleClass("PopOut", !show);
        $("#color-select").toggleClass("PopIn", show);
    }

    /** Shows the choose card container with the specified card or hides it if cardId is null.
     * @param {string|null} cardId - The ID of the card to choose or null to hide the container.
     * @param {{ color: string; type: string; }} [card] - The card object containing color and type (optional, required if cardId is not null).
     */
    static showChooseCard(cardId, card) {
        $("#choose-container").toggleClass("hidden", (cardId == null));
        if (card) { $("#choose-card")[0].card = { cardId: cardId, ...card }; }
        if (card) { $("#choose-card")[0].src = `resources/cards/${card.color}_${card.type}.png`; }
        $("#choose-card").toggleClass("ChooseAnimation", (cardId != null));
    }

    /** Sets a full-screen cover image with a popup animation.
     * @param {string} src - The source URL of the cover image.
     */
    static setScreenCover(src) {
        $("#cover")[0].src = src;
        $("#cover").removeClass("popupCover");
        void $("#cover")[0].offsetWidth;
        $("#cover").addClass("popupCover");
    }
}

// ============================
// ===== SETTINGS WINDOWS =====
// ============================

//Settings button
$("#game-container #settings").click(() => {
    GameUI.showSettings(true);
});

//Close settings
$("#game-container #setting-close").click(() => {
    GameUI.showSettings(false);
});

//Leave game
$("#game-container #setting-leave").click(() => {
    location.reload();
});

//When mouse hovers where is room id, show it
$("#room-id").mouseenter((/** @type {any} */ e) => {
    $(e.target)[0].timer = setTimeout(() => {
        $(e.target)[0].innerText = GameManager.getInstance().getRoomId();
    }, 200);
});

//When mouse leaves where is room id, hide it
$("#room-id").mouseleave((/** @type {any} */ e) => {
    if ($(e.target)[0].timer) { clearTimeout($(e.target)[0].timer); }
	$(e.target)[0].innerText = '*'.repeat(GameManager.getInstance().getRoomId().length);
});

//Copy room id when pressed
$("#room-id").mousedown(() => {
    const /** @type {any} */ copy = document.createElement('textArea');
    copy.value = GameManager.getInstance().getRoomId();
    document.body.appendChild(copy);
    copy.select();
    document.execCommand('copy');
    document.body.removeChild(copy);
    alert('Room id copied.');
});

// ============================
// ========= BUTTONS ==========
// ============================

// When click on UNO CARD, start the game (only host can press this button, so no need to check if host)
$("#UNO_CARD").click(() => {
    GameManager.getInstance().startGame();
});

// When click on deck, send draw card request to host
$("#carddeck").click(() => {
    GameManager.getInstance().clientDrawCard();
});

// When click on UNO button, send UNO press payload to host
$("#uno").click(() => {
    GameManager.getInstance().clientCallUno();
});

// If player decided to place a card instead of keepint it, send that to host
$("#choose-place").click(() => {
    GameUI.showChooseCard(null);
    GameManager.getInstance().clientPlaceCard($("#choose-card")[0].card.cardId);
    $("#choose-card")[0].card = null;
});

// If player decided to save a card instead of placing it, send that to host
$("#choose-save").click(() => {
    GameUI.showChooseCard(null);
    GameManager.getInstance().clientSaveCard($("#choose-card")[0].card.cardId);
    $("#choose-card")[0].card = null;
});

$(".color").click((/** @type {any} */ e) => {
    GameManager.getInstance().clientChangeColor(e.target.id);
    GameUI.playSound("color_press.mp3");
});

// When click on winner return button, reload page
$("#winner-return").click(() => {
    location.reload();
});