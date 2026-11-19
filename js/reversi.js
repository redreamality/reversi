// Reversi board UI. Loaded on demand (dynamic import) after the visitor presses Play.
// The rules engine and the AI (Monte-Carlo tree search) run in a Web Worker:
// js/engine/* — UCThello by Oliver Merkel, MIT License (see /licenses/UCThello-LICENSE.txt).

const SIZE = 8;
const BLACK = 1; // engine: playerO = 1 moves first = Black
const WHITE = 0;
const COLOR = { [BLACK]: "black", [WHITE]: "white" };
const NAME = { [BLACK]: "Black", [WHITE]: "White" };
const PASS_DELAY = 1600;

function cellName(x, y) {
	return String.fromCharCode(97 + x) + (y + 1);
}

export function createGame({ board, getSettings, onStatus }) {
	const cells = [];
	let worker = null;
	let prev = null; // previous square matrix, for flip animation
	let current = null;
	let passTimer = 0;
	let readyResolve;
	const ready = new Promise((r) => {
		readyResolve = r;
	});

	board.textContent = "";
	board.classList.add("board");
	board.setAttribute("role", "grid");
	board.setAttribute("aria-label", "Reversi board");
	for (let y = 0; y < SIZE; ++y) {
		for (let x = 0; x < SIZE; ++x) {
			const b = document.createElement("button");
			b.type = "button";
			b.className = "cell";
			b.dataset.x = String(x);
			b.dataset.y = String(y);
			b.setAttribute("aria-label", cellName(x, y));
			b.disabled = true;
			b.addEventListener("click", () => play(x, y));
			board.appendChild(b);
			cells.push(b);
		}
	}

	function cell(x, y) {
		return cells[y * SIZE + x];
	}

	function players() {
		const s = getSettings();
		return {
			playerblack: "Human",
			playerwhite: s.mode === "ai" ? "AI" : "Human",
			passingallowed: s.passing,
		};
	}

	function post(msg) {
		worker.postMessage({ class: "request", ...msg, ...players() });
	}

	function boot() {
		clearTimeout(passTimer);
		if (worker) worker.terminate();
		prev = null;
		worker = new Worker(new URL("./engine/controller.js", import.meta.url));
		worker.addEventListener("message", (ev) => {
			const d = ev.data;
			if (d && d.eventClass === "request" && d.request === "redraw") {
				render(d.board);
				readyResolve();
			}
		});
		worker.addEventListener("error", () => {
			onStatus({ text: "The game engine stopped. Reload the page to play again." });
		});
		post({ request: "start" });
	}

	function render(state) {
		current = state;
		const last = state.previous && state.previous.type === "set" ? state.previous : null;
		for (let y = 0; y < SIZE; ++y) {
			for (let x = 0; x < SIZE; ++x) {
				const v = state.square[x][y];
				const before = prev ? prev[x][y] : v;
				const c = cell(x, y);
				c.classList.remove("legal", "last");
				c.disabled = true;
				let disc = c.querySelector(".disc");
				if (v === BLACK || v === WHITE) {
					if (!disc) {
						c.textContent = "";
						disc = document.createElement("span");
						disc.className = "disc";
						c.appendChild(disc);
						if (prev) disc.classList.add("drop");
					} else if (before !== v) {
						disc.classList.remove("flip");
						void disc.offsetWidth; // restart animation
						disc.classList.add("flip");
					}
					disc.classList.toggle("black", v === BLACK);
					disc.classList.toggle("white", v === WHITE);
					c.setAttribute("aria-label", `${cellName(x, y)}, ${COLOR[v]}`);
				} else {
					c.textContent = "";
					c.setAttribute("aria-label", cellName(x, y));
				}
			}
		}
		if (last) cell(last.x, last.y).classList.add("last");
		prev = state.square.map((col) => col.slice());
		next(state);
	}

	function next(state) {
		const black = state.count[BLACK];
		const white = state.count[WHITE];
		const mode = getSettings().mode;
		const who = state.turn;
		const mustPass = state.actions.length === 1 && state.actions[0].type === "pass";
		let text;
		let phase;

		if (state.actions.length === 0) {
			phase = "over";
			if (black === white) text = `Game over: a draw, ${black}–${white}.`;
			else if (mode === "ai") text = black > white ? `You win ${black}–${white}!` : `The AI wins ${white}–${black}.`;
			else text = black > white ? `Black wins ${black}–${white}.` : `White wins ${white}–${black}.`;
			text += " Press New game for another.";
		} else if (mustPass) {
			phase = "pass";
			text = `${NAME[who]} has no legal move and must pass.`;
			passTimer = setTimeout(() => post({ request: "perform", action: { type: "pass" } }), PASS_DELAY);
		} else if (state.nextishuman) {
			phase = "human";
			text = mode === "ai" ? "Your move (Black)." : `${NAME[who]} to move.`;
			for (const a of state.actions) {
				if (a.type !== "set") continue;
				const c = cell(a.x, a.y);
				c.classList.add("legal");
				c.disabled = false;
				if (!c.querySelector(".hint")) {
					const h = document.createElement("span");
					h.className = "hint";
					c.appendChild(h);
				}
			}
		} else {
			phase = "ai";
			text = "The AI (White) is thinking…";
			post({ request: "actionbyai" });
		}
		board.dataset.phase = phase;
		board.dataset.turn = COLOR[who];
		onStatus({ black, white, text, phase });
	}

	function play(x, y) {
		if (!current || !current.nextishuman) return;
		if (!current.actions.some((a) => a.type === "set" && a.x === x && a.y === y)) return;
		for (const c of cells) {
			c.disabled = true;
			c.classList.remove("legal");
			const h = c.querySelector(".hint");
			if (h) h.remove();
		}
		current = { ...current, nextishuman: false };
		board.dataset.phase = "wait";
		post({ request: "perform", action: { type: "set", x, y } });
	}

	boot();
	return { ready, restart: boot };
}
