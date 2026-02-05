// @ts-check

import { UnoConfig } from '../config.js';
import { UnoUtils } from '../utils/utils.js';
import { JoinRequestPayload } from '../packets.js';
import { GameManager } from '../game.js';

/** @type {any} */
const $ = (/** @type {any} */(window)).$;

(() => {
	// Preload assets -> cards
	UnoUtils.preloadAssets();

	// Load username and avatar from local storage
	$("#username")[0].value = localStorage["username"] || "";
	$("#avatar")[0].src = localStorage["avatar"] || "resources/defaultAvatar.png";

	// Load settings
	$("#start-cards").children(".setting-state")[0].innerHTML = localStorage["start_cards"] || UnoConfig.START_CARDS.default;
	$("#max-players").children(".setting-state")[0].innerHTML = localStorage["max_players"] || UnoConfig.MAX_PLAYERS.default;
	$("#max-cards").children(".setting-state")[0].innerHTML = localStorage["max_cards"] || UnoConfig.MAX_CARDS.default;
	$("#player-time").children(".setting-state")[0].innerHTML = localStorage["player_time"] || UnoConfig.PLAYER_TIME.default;
	$('#invite')[0].value = localStorage["invite"] || "";

	if (localStorage["draw_to_match"]) {
		$("#draw-to-match").children(".setting-state")[0].innerHTML = localStorage["draw_to_match"];
	}

	if (localStorage["stack_cards"]) {
		$("#stack-cards").children(".setting-state")[0].innerHTML = localStorage["stack_cards"];
	}

	if (localStorage["jump_in"]) {
		$("#jump-in").children(".setting-state")[0].innerHTML = localStorage["jump_in"];
	}

	if (localStorage["can_uno"]) {
		$("#can-uno").children(".setting-state")[0].innerHTML = localStorage["can_uno"];
	}

	if (localStorage["can_rejoin"]) {
		$("#can-rejoin").children(".setting-state")[0].innerHTML = localStorage["can_rejoin"];
	}
})();


//When clicking on avatar allow user to change it
$("#avatar").click(() => {
    let input = document.createElement("input");
    let reader = new FileReader();
    input.setAttribute("type", "file");
    input.setAttribute("accept", ".png,.jpg,.jpeg,.bmp,.gif");

	input.onchange = (/** @type {Event} */ event) => {
		const target = /** @type {HTMLInputElement} */ (event.target);
		if (!target?.files || (target.files.length === 0)) { return console.error("No avatar file selected"); }
		reader.readAsArrayBuffer(target.files[0]);
	};

    reader.onload = async (/** @type {ProgressEvent<FileReader>} */ event) => {
		let buffer = (event.target?.result instanceof ArrayBuffer) ? event.target?.result : null;
		if (!buffer) { return console.error("Failed to read avatar buffer"); }
		let avatar = await UnoUtils.createAvatar(buffer).catch(() => alert(UnoConfig.ERROR_CODES['1006.0'].message));
		if (avatar) { $('#avatar')[0].src = (localStorage["avatar"] = avatar); }
        input.remove();
    }

    input.click();
});


//When click on connect
$('#connect').click(async () => {
    let username = $('#username')[0].value;
    let invite = $('#invite')[0].value;

	localStorage["username"] = username;
	localStorage["invite"] = $('#invite')[0].value;

	let data = new JoinRequestPayload(invite, username);
	let valid = await UnoUtils.isJoinDataValid(data);
	if (valid.code !== 200) { return alert(valid.message); }
	if (!invite) { return await GameManager.createGame(data); }
	await GameManager.joinGame(data);
});


//Show settings
$("#login-container .settings").click(() => {
    $("#login-container #settings-container")[0].style = "transform: translate(-50%, -50%) scale(1);"
});


//Close settings
$("#login-container #setting-close").click(() => {
    $("#login-container #settings-container")[0].style = "transform: translate(-50%, -50%) scale(0);"
	localStorage["start_cards"] = $("#start-cards").children(".setting-state")[0].innerHTML;
	localStorage["max_players"] = $("#max-players").children(".setting-state")[0].innerHTML;
	localStorage["max_cards"] = $("#max-cards").children(".setting-state")[0].innerHTML;
	localStorage["player_time"] = $("#player-time").children(".setting-state")[0].innerHTML;
	localStorage["draw_to_match"] = $("#draw-to-match").children(".setting-state")[0].innerHTML;
	localStorage["stack_cards"] = $("#stack-cards").children(".setting-state")[0].innerHTML;
	localStorage["jump_in"] = $("#jump-in").children(".setting-state")[0].innerHTML;
	localStorage["can_uno"] = $("#can-uno").children(".setting-state")[0].innerHTML;
	localStorage["can_rejoin"] = $("#can-rejoin").children(".setting-state")[0].innerHTML;
});


//Switch setting to left
$(".arrow-left").mousedown((/** @type any */ e) => {
	var arrow_left = (/** @type any */ ev) => {
        var type = ev.currentTarget.parentElement.id;
        var state = $(`#${type} .setting-state`)[0];

		switch (type) {
			case "max-players":
				if (parseInt(state.innerHTML) > UnoConfig.MAX_PLAYERS.minimum) {
					state.innerHTML = parseInt(state.innerHTML)-1;
				}
				break;
			case "max-cards":
				if (parseInt(state.innerHTML) > UnoConfig.MAX_CARDS.minimum) {
					state.innerHTML = parseInt(state.innerHTML)-1;
				}
				break;
			case "start-cards":
				if (parseInt(state.innerHTML) > UnoConfig.START_CARDS.minimum) {
					state.innerHTML = parseInt(state.innerHTML)-1;
				}
				break;
			case "player-time":
				if (parseInt(state.innerHTML) > UnoConfig.PLAYER_TIME.minimum) {
					state.innerHTML = parseInt(state.innerHTML)-1;
				}
				break;
			case "draw-to-match":
				state.innerHTML = (state.innerHTML == "ON") ? "OFF" : "ON";
				break;
			case "stack-cards":
				state.innerHTML = (state.innerHTML == "ON") ? "OFF" : "ON";
				break;
			case "jump-in":
				state.innerHTML = (state.innerHTML == "ON") ? "OFF" : "ON";
				break;
			case "can-uno":
				state.innerHTML = (state.innerHTML == "ON") ? "OFF" : "ON";
				break;
			case "can-rejoin":
				state.innerHTML = (state.innerHTML == "ON") ? "OFF" : "ON";
				break;
		}
	}

	arrow_left(e);
    if (e.currentTarget._timeout) { return; } // A long press starts repeating the change after a short delay.
	e.currentTarget._timeout = setTimeout(() => {
		e.currentTarget._interval = setInterval(() => arrow_left(e), UnoConfig.SETTING_INTERVAL);
	}, UnoConfig.SETTING_TIMEOUT);
});


$(".arrow-left").mouseup((/** @type any */ e) => {
    if (e.currentTarget._timeout) { clearTimeout(e.currentTarget._timeout); }
    if (e.currentTarget._interval) { clearInterval(e.currentTarget._interval); }
    e.currentTarget._timeout = null;
    e.currentTarget._interval = null;
});


$(".arrow-left").mouseleave((/** @type any */ e) => {
	$(e.currentTarget).trigger('mouseup');
});


//Switch setting to right
$(".arrow-right").mousedown((/** @type any */ e) => {
	var arrow_right = (/** @type any */ ev) => {
        var type = ev.currentTarget.parentElement.id;
        var state = $(`#${type} .setting-state`)[0];

		switch (type) {
			case "max-players":
				if (parseInt(state.innerHTML)+1 <= UnoConfig.MAX_PLAYERS.maximum) {
					state.innerHTML = parseInt(state.innerHTML)+1;
				}
				break;
			case "max-cards":
				if (parseInt(state.innerHTML)+1 <= UnoConfig.MAX_CARDS.maximum) {
					state.innerHTML = parseInt(state.innerHTML)+1;
				}
				break;
			case "start-cards":
				if (parseInt(state.innerHTML)+1 <= UnoConfig.START_CARDS.maximum) {
					state.innerHTML = parseInt(state.innerHTML)+1;
				}
				break;
			case "player-time":
				if (parseInt(state.innerHTML)+1 <= UnoConfig.PLAYER_TIME.maximum) {
					state.innerHTML = parseInt(state.innerHTML)+1;
				}
				break;
			case "draw-to-match":
				state.innerHTML = (state.innerHTML == "ON") ? "OFF" : "ON";
				break;
			case "stack-cards":
				state.innerHTML = (state.innerHTML == "ON") ? "OFF" : "ON";
				break;
			case "jump-in":
				state.innerHTML = (state.innerHTML == "ON") ? "OFF" : "ON";
				break;
			case "can-uno":
				state.innerHTML = (state.innerHTML == "ON") ? "OFF" : "ON";
				break;
			case "can-rejoin":
				state.innerHTML = (state.innerHTML == "ON") ? "OFF" : "ON";
				break;
		}
	}

	arrow_right(e);
    if (e.currentTarget._timeout) { return; } // A long press starts repeating the change after a short delay.
	e.currentTarget._timeout = setTimeout(() => {
		e.currentTarget._interval = setInterval(() => arrow_right(e), UnoConfig.SETTING_INTERVAL);
	}, UnoConfig.SETTING_TIMEOUT);
});


$(".arrow-right").mouseup((/** @type any */ e) => {
    if (e.currentTarget._timeout) { clearTimeout(e.currentTarget._timeout); }
    if (e.currentTarget._interval) { clearInterval(e.currentTarget._interval); }
    e.currentTarget._timeout = null;
    e.currentTarget._interval = null;
});


$(".arrow-right").mouseleave((/** @type any */ e) => {
	$(e.currentTarget).trigger('mouseup');
});