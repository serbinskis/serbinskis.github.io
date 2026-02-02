// @ts-check

import { GameManager } from '../game.js';
import { UnoPlayer } from '../player.js';

/** @type {any} */
const $ = (/** @type {any} */(window)).$;

export class GameUI {
    static { // @ts-ignore
        window.GameUI = GameUI;
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
            // TODO ADD KICK PACKET
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

    /** Renders the game UI, updating player list and room ID display. */
    static render() {
        GameUI.renderPlayers();
        $("#room-id")[0].innerText = '*'.repeat(GameManager.getInstance().getRoomId().length);
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