// Page shell: cover -> loader -> board, plus like / share / fullscreen.
// The game itself (js/reversi.js + the engine worker) is only fetched after Play is pressed.

const $ = (sel) => document.querySelector(sel);
const LOADER_MIN_MS = 700;
const LIKE_KEY = "reversi:liked";

const cover = $("#cover");
const loader = $("#loader");
const boardLayer = $("#boardlayer");
const statusEl = $("#status");
const playBtn = $("#play-btn");
const newBtn = $("#new-game");
const modeBtns = [...document.querySelectorAll("[data-mode]")];

let mode = "ai";
let game = null;
let loading = null;
let revealed = false; // board visible (loader gone)
let pendingStatus = null; // status reported by the game while the loader was still up

// Analytics hook: the site owner's snippet may define window.trackEvent(name).
// Without analytics this is a no-op.
function track(name) {
	try {
		window.trackEvent?.(name);
	} catch {
		/* never let analytics break the game */
	}
}

function onGameStatus(info) {
	if (revealed) setStatus(info);
	else pendingStatus = info;
}

function settings() {
	const passing = !document.getElementById("opt-end")?.checked;
	return { mode, passing };
}

function setStatus({ black, white, text }) {
	statusEl.textContent = "";
	if (typeof black === "number") {
		const s = document.createElement("span");
		s.className = "score";
		s.innerHTML =
			'<span class="chip black" aria-hidden="true"></span><span data-score="black"></span>' +
			'<span class="chip white" aria-hidden="true"></span><span data-score="white"></span>';
		s.querySelector('[data-score="black"]').textContent = String(black);
		s.querySelector('[data-score="white"]').textContent = String(white);
		s.setAttribute("aria-label", `Black ${black}, White ${white}`);
		statusEl.appendChild(s);
	}
	statusEl.appendChild(document.createTextNode(text));
}

async function start() {
	if (game) {
		game.restart();
		return;
	}
	if (loading) return loading;
	cover.hidden = true;
	loader.hidden = false;
	statusEl.textContent = "Loading the board and the AI…";
	track("play_start");
	const t0 = performance.now();
	loading = (async () => {
		try {
			const { createGame } = await import("./reversi.js");
			game = createGame({ board: $("#board"), getSettings: settings, onStatus: onGameStatus });
			await game.ready;
			const wait = LOADER_MIN_MS - (performance.now() - t0);
			if (wait > 0) await new Promise((r) => setTimeout(r, wait));
			loader.hidden = true;
			boardLayer.hidden = false;
			revealed = true;
			if (pendingStatus) setStatus(pendingStatus);
			pendingStatus = null;
			setTimeout(() => {
				if (!document.hidden) track("played_60s");
			}, 60_000);
		} catch (err) {
			loader.querySelector("p").textContent = "The game could not load. Please reload the page and try again.";
			loading = null;
			throw err;
		}
	})();
	return loading;
}

playBtn.addEventListener("click", () => start());
newBtn.addEventListener("click", () => start());

for (const b of modeBtns) {
	b.addEventListener("click", () => {
		if (mode === b.dataset.mode) return;
		mode = b.dataset.mode;
		for (const o of modeBtns) o.setAttribute("aria-pressed", String(o === b));
		if (game) game.restart();
		else statusEl.textContent = mode === "ai" ? "You play Black against the AI." : "Two players, one screen: Black moves first.";
	});
}

document.getElementById("opt-hints")?.addEventListener("change", (e) => {
	$("#board").classList.toggle("hints-off", !e.target.checked);
});

// ---------- toast ----------
let toastTimer = 0;
function toast(msg) {
	let t = $(".toast");
	if (!t) {
		t = document.createElement("div");
		t.className = "toast";
		t.setAttribute("role", "status");
		document.body.appendChild(t);
	}
	t.textContent = msg;
	t.hidden = false;
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		t.hidden = true;
	}, 2200);
}

// ---------- like (stored on this device only; starts at 0) ----------
const likeBtn = $("#like-btn");
function readLiked() {
	try {
		return localStorage.getItem(LIKE_KEY) === "1";
	} catch {
		return false;
	}
}
function paintLike(liked) {
	// Shows only whether *you* liked it on this device — there is no site-wide count yet.
	likeBtn.setAttribute("aria-pressed", String(liked));
	likeBtn.querySelector("[data-like-label]").textContent = liked ? "Liked" : "Like";
	likeBtn.setAttribute("aria-label", liked ? "You liked this game — press to undo" : "Like this game");
}
paintLike(readLiked());
likeBtn.addEventListener("click", () => {
	const liked = !readLiked();
	try {
		localStorage.setItem(LIKE_KEY, liked ? "1" : "0");
	} catch {
		/* storage blocked: still show the state for this visit */
	}
	paintLike(liked);
});

// ---------- share ----------
function pageUrl() {
	return document.querySelector('link[rel="canonical"]')?.href || location.href;
}
async function copyText(text) {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		const ta = document.createElement("textarea");
		ta.value = text;
		ta.setAttribute("readonly", "");
		ta.style.position = "fixed";
		ta.style.opacity = "0";
		document.body.appendChild(ta);
		ta.select();
		let ok = false;
		try {
			ok = document.execCommand("copy");
		} catch {
			ok = false;
		}
		ta.remove();
		return ok;
	}
}
$("#share-btn").addEventListener("click", async () => {
	const url = pageUrl();
	const touch = window.matchMedia("(pointer: coarse)").matches;
	if (touch && navigator.share) {
		try {
			await navigator.share({ title: document.title, text: "Play Reversi in your browser", url });
			return;
		} catch (e) {
			if (e && e.name === "AbortError") return;
		}
	}
	toast((await copyText(url)) ? "Link copied" : `Copy this link: ${url}`);
});

// ---------- fullscreen ----------
const playBox = $("#play");
const fsBtn = $("#fs-btn");
fsBtn.addEventListener("click", async () => {
	try {
		if (document.fullscreenElement) await document.exitFullscreen();
		else if (playBox.requestFullscreen) await playBox.requestFullscreen();
		else if (playBox.webkitRequestFullscreen) playBox.webkitRequestFullscreen();
		else toast("Fullscreen is not available in this browser");
	} catch {
		toast("Fullscreen is not available here");
	}
});
document.addEventListener("fullscreenchange", () => {
	const on = Boolean(document.fullscreenElement);
	if (on) track("fullscreen");
	fsBtn.setAttribute("aria-label", on ? "Exit fullscreen" : "Fullscreen");
	fsBtn.querySelector(".label").textContent = on ? "Exit" : "Fullscreen";
});
