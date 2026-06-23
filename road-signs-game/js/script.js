// Theme Toggle Logic
function updateThemeIcons() {
	const isDark = document.documentElement.classList.contains('dark');
	document.getElementById('theme-icon-light').classList.toggle('hidden', !isDark);
	document.getElementById('theme-icon-dark').classList.toggle('hidden', isDark);
}

document.getElementById('theme-toggle').addEventListener('click', () => {
	const isDark = document.documentElement.classList.toggle('dark');
	localStorage.theme = isDark ? 'dark' : 'light';
	updateThemeIcons();
});

updateThemeIcons();

// Toast Notification Logic
function showToast(message, type = 'error') {
	const container = document.getElementById('toast-container');
	const toast = document.createElement('div');
	const colorClass = type === 'error' ? 'bg-red-500' : 'bg-green-500';
	
	toast.className = `toast ${colorClass} text-white px-4 py-3 rounded shadow-lg flex items-center justify-between pointer-events-auto`;
	toast.innerHTML = `
		<span class="font-medium text-sm">${message}</span>
		<button class="ml-4 text-white hover:text-gray-200 font-bold" onclick="this.parentElement.remove()">&times;</button>
	`;
	container.appendChild(toast);
	setTimeout(() => {
		toast.style.opacity = '0';
		toast.style.transition = 'opacity 0.3s';
		setTimeout(() => toast.remove(), 300);
	}, 4000);
}

// Game State Variables
let correct;
let current = 0;
let selectedSign;
let chooseCount = 8;
let custom = [];

function randomInt(max) {
	return Math.floor(Math.random() * max);
}

function updateURL() {
	const newUrl = `${window.location.pathname}?id=${current + 1}`;
	window.history.replaceState(null, '', newUrl);
}

// Navigation Buttons
document.getElementById('random').addEventListener('click', () => {
	if (custom.length === 0) { current = randomInt(signs.length); }
	else { current = custom[randomInt(custom.length)] - 1; }
	prepareSelect(chooseCount);
});

document.getElementById('previous').addEventListener('click', () => {
	if (custom.length === 0) {
		if (current - 1 >= 0) current -= 1;
	} else {
		let prevIdx = custom.indexOf(current + 1) - 1;
		if (prevIdx >= 0) current = custom[prevIdx] - 1;
	}
	prepareSelect(chooseCount);
});

document.getElementById('next').addEventListener('click', () => {
	if (custom.length === 0) {
		if (current + 1 < signs.length) current += 1;
	} else {
		let nextIdx = custom.indexOf(current + 1) + 1;
		if (nextIdx < custom.length) current = custom[nextIdx] - 1;
	}
	prepareSelect(chooseCount);
});

// Generate the HTML for the options grid
function generateAmount(size) {
	const grid = document.getElementById('image-grid');
	grid.innerHTML = ''; // Clear previous

	for (let i = 1; i <= size; i++) {
		const html = `
			<label class="relative cursor-pointer group sign-option">
				<input type="radio" name="sign_choice" value="${i}" class="peer sr-only" onchange="submitAnswer()">
				<div id="wrapper-${i}" class="p-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 peer-checked:border-blue-500 peer-checked:ring-2 peer-checked:ring-blue-300 dark:peer-checked:ring-blue-800 transition-all hover:shadow-md rounded-xl">
					<img id="img-${i}" src="" class="w-16 h-16 object-contain pointer-events-none">
				</div>
			</label>
		`;
		grid.insertAdjacentHTML('beforeend', html);
	}
}

// Prepare the specific question data
function prepareSelect(size) {
	updateURL();
	
	selectedSign = signs[current];
	correct = randomInt(size) + 1; // ID of the correct radio button

	// Populate Text
	document.getElementById('current').innerText = current + 1;
	document.getElementById('text').innerText = selectedSign.name;
	document.getElementById('type').innerText = selectedSign.type;
	document.getElementById('description').innerText = selectedSign.description;

	// Reset Result Message
	document.getElementById('result-message').style.opacity = '1';
	document.getElementById('result-message').innerText = 'Select the correct sign.';
	document.getElementById('result-message').className = "select-none text-lg font-bold transition-opacity duration-300 text-yellow-600 dark:text-yellow-400";

	// Reset selection styles & re-enable inputs
	document.querySelectorAll('input[name="sign_choice"]').forEach(radio => {
		radio.checked = false;
		radio.disabled = false;
	});

	document.querySelectorAll('[id^="wrapper-"]').forEach(wrapper => {
		// Restore default classes, remove success/fail classes
		wrapper.className = `p-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 peer-checked:border-blue-500 peer-checked:ring-2 peer-checked:ring-blue-300 dark:peer-checked:ring-blue-800 transition-all hover:shadow-md rounded-xl`;
	});

	// Populate Images
	for (let i = 1; i <= size; i++) {
		let imgEl = document.getElementById(`img-${i}`);
		
		if (correct === i) {
			imgEl.src = selectedSign.image;
		} else {
			let found = false;
			let attempts = 0;
			while (!found && attempts < 50) {
				let randomSign = signs[randomInt(signs.length)];
				if (randomSign.name !== selectedSign.name && randomSign.type === selectedSign.type) {
					imgEl.src = randomSign.image;
					found = true;
				}
				attempts++;
			}
			if (!found) {
				let fallback = signs[randomInt(signs.length)];
				imgEl.src = fallback.image;
			}
		}
	}
}

// Submission Logic
function submitAnswer() {
	const selectedRadio = document.querySelector('input[name="sign_choice"]:checked');
	if (!selectedRadio) { return showToast('Please select a sign first!', 'error'); }

	const selectedValue = parseInt(selectedRadio.value);
	const resultMsg = document.getElementById('result-message');
	
	// Disable all inputs so user can't click around after submitting
	document.querySelectorAll('input[name="sign_choice"]').forEach(radio => radio.disabled = true);
	
	// Update Text Message
	resultMsg.style.opacity = '1';
	if (selectedValue === correct) {
		resultMsg.innerText = "Correct!";
		resultMsg.className = "select-none text-lg font-bold transition-opacity duration-300 text-green-600 dark:text-green-400";
	} else {
		resultMsg.innerText = "Incorrect! The correct answer is highlighted in green.";
		resultMsg.className = "select-none text-lg font-bold transition-opacity duration-300 text-red-600 dark:text-red-400";
	}

	// Highlight Correct Answer (Green)
	const correctWrapper = document.getElementById(`wrapper-${correct}`);
	// Strip the peer-checked blue classes so they don't override our green
	correctWrapper.className = correctWrapper.className.replace(/peer-checked:[^\s]+/g, '');
	correctWrapper.classList.remove('border-gray-200', 'dark:border-gray-600', 'bg-white', 'dark:bg-gray-800');
	correctWrapper.classList.add('border-green-500', 'dark:border-green-500', 'ring-2', 'ring-green-400', 'dark:ring-green-600', 'bg-green-50', 'dark:bg-green-900/30');

	// Highlight Selected Wrong Answer (Red)
	if (selectedValue !== correct) {
		const selectedWrapper = document.getElementById(`wrapper-${selectedValue}`);
		// Strip the peer-checked blue classes so they don't override our red
		selectedWrapper.className = selectedWrapper.className.replace(/peer-checked:[^\s]+/g, '');
		selectedWrapper.classList.remove('border-gray-200', 'dark:border-gray-600', 'bg-white', 'dark:bg-gray-800');
		selectedWrapper.classList.add('border-red-500', 'dark:border-red-500', 'ring-2', 'ring-red-400', 'dark:ring-red-600', 'bg-red-50', 'dark:bg-red-900/30');
	}
};

// Settings Listeners
document.getElementById('selected').addEventListener('keypress', (e) => {
	if (e.key === 'Enter') { document.getElementById('select').click(); }
});

document.getElementById('select').addEventListener('click', () => {
	try {
		const val = document.getElementById('selected').value;
		const parsed = JSON.parse(val);
		if (!Array.isArray(parsed)) { throw new Error(); }
		
		custom = parsed.filter(e => !isNaN(e));
		document.getElementById('selected').value = JSON.stringify(custom).split(',').join(', ');
		document.getElementById('random').click();
		showToast('Custom signs applied successfully!', 'success');
	} catch (e) {
		showToast('Invalid format. Please use arrays like [1, 2, 3].', 'error');
	}
});

document.getElementById('amount').addEventListener('keypress', (e) => {
	if (e.key === 'Enter') { document.getElementById('amount-button').click(); }
});

document.getElementById('amount-button').addEventListener('click', () => {
	const val = parseInt(document.getElementById('amount').value);
	if (isNaN(val) || val < 2) { return showToast('Please enter a valid number (min 2).', 'error'); }

	chooseCount = val;
	generateAmount(chooseCount);
	prepareSelect(chooseCount);
});

// Initialize the game on page load
window.addEventListener('load', async () => {
	if (typeof signs === 'undefined') {
		return document.getElementById('text').innerText = "Error: signs.js not loaded";
	}

	// Defaults
	document.getElementById('selected').value = "[1, 44, 45, 49, 50, 53, 54, 78, 79]";
	document.getElementById('amount').value = chooseCount;
	generateAmount(chooseCount);

	const urlParams = new URLSearchParams(window.location.search);
	const id = urlParams.get('id');

	if (id !== null && !isNaN(id) && Number(id) > 0 && Number(id) <= signs.length) {
		current = Number(id) - 1;
		prepareSelect(chooseCount);
	} else {
		document.getElementById('previous').click();
	}

	// Preload images
	for (let i = 0; i < signs.length; i++) {
		const img = new Image();
		img.src = signs[i].image;
		await new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
	}
});