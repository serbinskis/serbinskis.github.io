// @ts-check

import { UnoConfig } from '../config.js';
import { GameManager } from '../game.js';
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
     * @param {string|null} name - Filename in resources/sounds/
     */
    static playSound(name) {
        if (!name) { return; }
        console.warn('Playing sound:', name);
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
        $(`#${playerId}`).find(`[id*="${playerId}"]`).attr('id', () => UnoUtils.randomUUID());
        const placeholder = ($(`#${playerId}`)[0].id = UnoUtils.randomUUID()); // Fix renderPlayers()
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
        let game = GameManager.getInstance();
        let justStarted = !$("#UNO_CARD").hasClass("hidden"); // The game just started or we just rejoined
        $("#UNO_CARD").toggleClass("hidden", game.isStarted() && !game.isWinner());
        let currentCard = game.getCurrentCard();
        if (!currentCard) { return; }

        // Winner animation removes last card, to prevent any other game state packets putting the removed card back
        // we just have to check if there currently is a winner and if the card exists, currentUiCard will also be null
        // when we start the game, and will become null shortly after starting to show the winner animation.
        let currentUiCard = $("#cards-desk img").not("#UNO_CARD").last();
        if (!currentUiCard[0] && game.isWinner()) { return; }

        // If player is choosing color, show color chooser
        GameUI.showColorChoose(game.isChoosingColor() && (game.getCurrentPlayerId() == game.getMyPlayer()?.getPlayerId()));

        // Show UNO button if someone has 1 card
        GameUI.showUnoButton(game.getUnoId());

        // If player is choosing card, show choose card container
        let choosableCardId = game.getChoosingCardId();
        let choosingCard = game.getCard(choosableCardId);
        if (game.getCurrentPlayerId() == game.getMyPlayer()?.getPlayerId()) { GameUI.showChooseCard(choosableCardId, choosingCard); }

        // If the current card is already shown, do not add another one
        if (currentUiCard?.attr("cardId")?.includes(String(currentCard?.id))) { return; }

        // If current card is wild and color changed, update the card color with animation and sound
        if (currentUiCard?.attr("src")?.includes('ANY') && (currentCard?.color != "ANY")) {
            currentUiCard.attr("src", `resources/cards/gifs/${currentCard.color}_${currentCard.type}.gif`);
            currentUiCard.attr("cardId", String(currentCard.id));
            return GameUI.playSound("change_color.mp3");
        }

        // Add card to desk with animation
        var img = document.createElement("img");

        // When animation ends, remove the first card (old one)
        img.addEventListener("animationend", () => {
            if ($("#cards-desk img").not("#UNO_CARD").length > 1) {
                $("#cards-desk img").not("#UNO_CARD").first().remove();
            }
        }, { once: true });

        // Set image properties
        img.className = "card-desk";
        img.setAttribute("cardId", String(currentCard?.id));
        img.src = `resources/cards/${currentCard.color}_${currentCard.type}.png`;
        img.draggable = false;
        $('#cards-desk')[0].appendChild(img);

        // Play sound based on card type
        switch(currentCard.type) {
            case "REVERSE": GameUI.playSound(justStarted ? "card_place.mp3" : "reverse.mp3"); break;
            case "BLOCK": GameUI.playSound(justStarted ? "card_place.mp3" : "block.mp3"); break;
            case "PLUS_TWO": GameUI.playSound(justStarted ? "card_place.mp3" : "plus_two.mp3"); break;
            case "PLUS_FOUR": GameUI.playSound(justStarted ? "card_place.mp3" : "plus_four.mp3"); break;
            default: GameUI.playSound("card_place.mp3");
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
            img.className = "card clickable";
            img.id = cardId;
            img.src = `resources/cards/${cards[cardId].color}_${cards[cardId].type}.png`;
            img.draggable = false;
            img.addEventListener("click", () => GameManager.getInstance().clientPlaceCard(cardId), false);
            $('#cards')[0].appendChild(img);
        });

        if (addCards.length > 0) { GameUI.playSound("card_pickup.mp3"); }

        // Disable cards if it's not player's turn
        $("#cards .card").toggleClass("disabled", (game.getCurrentPlayerId() != me.getPlayerId()));

        // Enable/disable deck
        $("#carddeck").toggleClass("disabled", (game.getCurrentPlayerId() != me.getPlayerId()));

        // Render playable cards (highlight)
        $(".card").removeClass('jumpin');
        game.getPlayableCards(game.getMyPlayerId()).forEach(cardId => $(`#${cardId}`).removeClass('disabled'));
        game.getPlayableCards(game.getMyPlayerId()).forEach(cardId => $(`#${cardId}`).addClass('jumpin'));
    }

    // Renders the player cover overlay.
    static renderPlayerCover() {
        const game = GameManager.getInstance();
        if (!game.isStarted()) { return; }

        // If we rejoin, we use current timer count for visual purpose, to sync with host
        let justStarted = !$("#UNO_CARD").hasClass("hidden"); // The game just started or we just rejoined
        let amount = justStarted ? game.getPlayerTimerCount() : game.getPlayerTime();

        // We flip this because timers are shared on host and client, so host timer ID would conflict with client timer ID
        const playerTimerId = UnoUtils.reverse(game.getPlayerTimer());
        if (playerTimerId && !Timer.exists(playerTimerId)) {
            Timer.start((timer) => {
                if (playerTimerId !== UnoUtils.reverse(game.getPlayerTimer())) { return Timer.stop(playerTimerId); }
                if ((timer?.amount || 0) <= 1) { Timer.change(playerTimerId, 1000, { amount: undefined }); } // If time runs out, continue the timer until the player timer id changes, but don't render number anymore
                if ((timer?.amount || 0 >= 1)) { GameUI.setOverlayText(game.getCurrentPlayerId(), String(timer?.amount || 0)) }; // This is done so that in timer cannot retsart when turn delay send game state update, because we need Timer.exists(playerTimerId) -> true, until next player's turn starts
            }, 1000, { immediate: true, id: playerTimerId, interval: true, amount: amount });
        }

        // This must be after timer, otherwise immediate timer will just replace the current overlay
        if (!justStarted) { GameUI.showBlocked(game.getBlockedId()); }
        if (!justStarted) { GameUI.showJumped(game.getWhoJumpedId(), game.getWhoGotJumpedId()); }
        if (!justStarted) { GameUI.showDrawCower(); }
    }

    /** Renders the game UI, updating player list and room ID display. */
    static render() {
        GameUI.renderPlayers();
        GameUI.renderPlayerCover();
        GameUI.renderDeck();
        GameUI.renderCards();
        GameUI.setStack(GameManager.getInstance().getStack());
        GameUI.showWinner(GameManager.getInstance().getWinnerId());
        GameUI.showMigratingHost(GameManager.getInstance().isMigrating());

        // This is easier for host migration
        let roomId = GameManager.getInstance().getRoomId();
        if (roomId) { localStorage.setItem("invite", roomId); }

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
        $(`#overlay_${playerId}`)[0].src = src?.includes("data:image") ? src : `resources/overlays/${src}`;
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
        kickElement.className = "button kick clickable";
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
     * Shows or hides the "migrating host" overlay.
     * When shown, the screen is darkened and gameplay interaction is visually blocked.
     *
     * @param {boolean} show - Whether to display the migrating host overlay.
     */
    static showMigratingHost(show) {
        $("#migrating-host").toggleClass("active", show);
    }

    /**
     * @param {boolean} enabled - Show or hide settings window
     */
    static showSettings(enabled) {
        $("#game-container #settings-container")[0].style = `transform: translate(-50%, -50%) scale(${enabled ? 1 : 0});`
    }

    /**
     * Checks whether the settings window is currently open.
     * @returns {boolean}
     */
    static isSettingsOpen() {
        return $("#game-container #settings-container")[0].style.transform.includes("scale(1)");
    }

    /** Shows block overlay on player's avatar if they are blocked.
     * @param {string|null} blockedId - The ID of the player.
     */
    static showBlocked(blockedId) {
        // Do not animate again if already blocked, in case if game state update arrives while blocked state not rested
        if (!blockedId) { return $(`#players`)[0].blockedId = null; }
        if (!$(`#overlay_${blockedId}`)[0]) { return; }
        if ($(`#players`)[0].blockedId == blockedId) { return; }
        $(`#players`)[0].blockedId = blockedId;
        GameUI.setOverlay(blockedId, 'BLOCK.png');
        if (blockedId == GameManager.getInstance().getMyPlayerId()) { GameUI.setScreenCover("SKIP.png"); }
    }

    /** Shows jump-in overlay on player's avatar if they got jumped.
     * @param {string|null} jumpedId - The ID of the player who jumped in.
     * @param {string|null} gotJumpedId - The ID of the player who got jumped.
     */
    static showJumped(jumpedId, gotJumpedId) {
        // If null it will just update the current value, still condition will not be met to show cover if null
        if ($(`#players`)[0] && ($(`#players`)[0].gotJumpedId != gotJumpedId)) {
            $(`#players`)[0].gotJumpedId = gotJumpedId;
            let myPlayerId = GameManager.getInstance().getMyPlayerId()
            if (gotJumpedId == myPlayerId) { GameUI.setScreenCover("JUMP_IN.png"); } // This this will show overlay for the victim of jump-in
        }
 
        // If null this will still be triggered, setOverlay will just ignore null value
        if ($(`#players`)[0] && ($(`#players`)[0].jumpedId != jumpedId)) {
            $(`#players`)[0].jumpedId = jumpedId;
            GameUI.setOverlay(String(jumpedId), 'JUMP_IN.png'); // This will show who jumped in, not who got jumped by
        }
    }

    /** Show draw card overlay for a players who drew a card. */
    static showDrawCower() {
        GameManager.getInstance().getPlayers().forEach(player => {
            if (!$(`#overlay_${player.getPlayerId()}`)[0]) { return; }

            // We only show overlay if player card amount increased, also for first time we do not animate, only store
            //if (!$(`#overlay_${playerId}`)[0].cardCount) { return $(`#overlay_${playerId}`)[0].cardCount = player.getCardCount(); }
            if (Number($(`#overlay_${player.getPlayerId()}`)[0].cardCount) >= player.getCardCount()) { return; }
            $(`#overlay_${player.getPlayerId()}`)[0].cardCount = player.getCardCount();
            GameUI.setOverlay(player.getPlayerId(), 'DRAW.png');

            if (player.getPlayerId() == GameManager.getInstance().getMyPlayerId()) { return; }
            GameUI.playSound("card_pickup.mp3"); // Yeah we also play this when other player pick up cards
        });
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
     * @param {{ color: string; type: string; }|null} [card] - The card object containing color and type (optional, required if cardId is not null).
     */
    static showChooseCard(cardId, card) {
        $("#choose-container").toggleClass("hidden", (cardId == null));
        if (card) { $("#choose-card")[0].card = { cardId: cardId, ...card }; }
        if (card) { $("#choose-card")[0].src = `resources/cards/${card.color}_${card.type}.png`; }
        $("#choose-card").toggleClass("ChooseAnimation", (cardId != null));
    }

    /** Shows or hides the UNO button based on the provided UNO caller ID.
     * @param {string | null} unoId - The ID of the player who called UNO or null to hide the button.
     */
    static showUnoButton(unoId) {
        if (unoId && (!$("#uno")[0].style.transform.includes("scale(1)") || (unoId != $("#uno")[0].unoId))) {
            let unoX = (200+UnoUtils.randomRange(0, 150))*(UnoUtils.randomRange(1, 2) == 1 ? -1 : 1);
            let unoY = UnoUtils.randomRange(-100, 100);
            $("#uno-wrapper")[0].style = `left: calc(50% + ${unoX}px); top: calc(50% + ${unoY}px);`
            $("#uno")[0].unoId = unoId;
            $("#uno")[0].style = "transform: scale(1);"
        } else if (!unoId) {
            $("#uno")[0].style = "transform: scale(0);"
        }
    }

    /** Shows or hides the winner container with the specified winner's information.
     * @param {string | null} winnerId - The ID of the winning player or null to hide the container.
     */
    static showWinner(winnerId) {
        const winner = winnerId && GameManager.getInstance().getPlayer(String(winnerId));
        let callback = () => $(`#winner-container`).toggleClass("hidden", !winner);
        $(`#winner-wrapper`).toggleClass("ScaleUp", Boolean(winner));
    
        if (winner) { setTimeout(callback, 500); } else { callback(); }
        if (winnerId && winner) { $(`#winner-username`)[0].innerHTML = $(`#username_${winnerId}`)[0]?.innerHTML; }
        if (winnerId && winner) { $(`#winner-avatar`)[0].src = $(`#avatar_${winnerId}`)[0]?.src; }
        if (!winner || Timer.exists(winnerId)) { return; }

        // Give some time for final animations
        Timer.start(() => {
            $("#cards-desk img").not("#UNO_CARD").last().remove(); // Remove current card from desk to prevent confusion
            GameUI.showColorChoose(false); // Also hide color choose if winner wins while choosing color
            GameUI.showUnoButton(null); // Also hide UNO button if winner wins while someone has 1 card
            GameUI.setStack(0); // Also reset stack if winner wins while stack is active
        }, 500);

        Timer.start((timer) => { // DONT ASK, GUGU GAGA TIME
            let seconds = Math.round((timer?.amount || 1)/2)-1;
            $(`#winner-timeout`)[0].innerHTML = `Next game will start in ${seconds} seconds.`;
        }, 500, { immediate: false, id: winnerId, interval: true, amount: (UnoConfig.NEXT_GAME_TIMEOUT+1)*2 });
    }

    /** Sets a full-screen cover image with a popup animation.
     * @param {string} src - The source URL of the cover image.
     */
    static setScreenCover(src) {
        $("#cover")[0].src = `resources/covers/${src}`;
        $("#cover").removeClass("popupCover");
        void $("#cover")[0].offsetWidth;
        $("#cover").addClass("popupCover");
    }
}

// ============================
// ===== SETTINGS WINDOWS =====
// ============================

// Settings button
$("#game-container #settings").click(() => {
    GameUI.showSettings(!GameUI.isSettingsOpen());
});

// Close settings when press escape
$(document).on("keydown", (/** @type {any} */ e) => {
    if (e.key !== "Escape") { return; }
    if (!GameUI.isSettingsOpen()) { return; }

    e.preventDefault();
    e.stopPropagation();
    GameUI.showSettings(false);
});

// Close settings
$("#game-container #setting-close").click(() => {
    GameUI.showSettings(false);
});

// Leave game
$("#game-container #setting-leave").click(() => {
    location.reload();
});

// When mouse hovers where is room id, show it
$("#room-id").mouseenter((/** @type {any} */ e) => {
    $(e.target)[0].timer = setTimeout(() => {
        $(e.target)[0].innerText = GameManager.getInstance().getRoomId();
    }, 200);
});

// When mouse leaves where is room id, hide it
$("#room-id").mouseleave((/** @type {any} */ e) => {
    if ($(e.target)[0].timer) { clearTimeout($(e.target)[0].timer); }
	$(e.target)[0].innerText = '*'.repeat(GameManager.getInstance().getRoomId().length);
});

// Copy room id when pressed (no alert, floaty text instead)
$("#room-id").mousedown((/** @type {any} */ e) => {
    const roomId = GameManager.getInstance().getRoomId();

    // Copy to clipboard
    const copy = document.createElement("textarea");
    copy.value = roomId;
    document.body.appendChild(copy);
    copy.select();
    document.execCommand("copy");
    document.body.removeChild(copy);

    // Remove existing toast if any
    $(".room-id-toast").remove();

    // Create floaty "Copied" text
    const $toast = $("<div>").addClass("room-id-toast").text("Copied");
    $("body").append($toast);

    const offset = $("#room-id").offset();
    const width = $("#room-id").outerWidth();
    $toast.css({ left: offset.left + width / 2, top: offset.top - 10 });
    $toast.animate({ top: "-=20px", opacity: 0 }, 700, () => $toast.remove()); // Animate up + fade out
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