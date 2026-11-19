// Player talk section. Injected after page load so no visitor text is in the page source.
// DEMO STORAGE: posts live in this browser's localStorage only. Before launch, replace
// `store` with calls to a real backend (see site/README.md, "Comments").

const KEY = "reversi:talk";
const MAX_NAME = 40;
const MAX_TEXT = 1000;
// Demo-only owner switch: on a local preview (localhost / 127.0.0.1) open the page with
// ?owner-demo to post as the site owner. It never works on a real domain: until a backend
// checks who the owner is, production shows no owner badge at all.
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
const OWNER = LOCAL_HOSTS.includes(location.hostname) && new URLSearchParams(location.search).has("owner-demo");

const store = {
	load() {
		try {
			const v = JSON.parse(localStorage.getItem(KEY) || "[]");
			return Array.isArray(v) ? v : [];
		} catch {
			return [];
		}
	},
	save(list) {
		try {
			localStorage.setItem(KEY, JSON.stringify(list));
		} catch {
			/* storage full or blocked */
		}
	},
};

function el(tag, attrs = {}, text) {
	const n = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
	if (text != null) n.textContent = text;
	return n;
}

function when(ts) {
	return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function uid() {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function buildForm(onSubmit, { compact = false, label = "Post" } = {}) {
	const f = el("form", { novalidate: "" });
	const name = el("input", {
		name: "name",
		maxlength: String(MAX_NAME),
		placeholder: "Your name",
		"aria-label": "Your name",
		autocomplete: "nickname",
	});
	if (OWNER) name.value = "Site owner";
	const text = el("textarea", {
		name: "text",
		maxlength: String(MAX_TEXT),
		placeholder: compact ? "Write a reply" : "Your score, a tip, or a question about the game",
		"aria-label": compact ? "Reply" : "Your message",
		required: "",
	});
	const row = el("div", { class: "row" });
	const btn = el("button", { type: "submit", class: "textbtn" }, label);
	row.append(btn);
	if (!compact) {
		row.append(el("p", { class: "note" }, "Be kind. Messages here are saved on this device only for now."));
	}
	f.append(name, text, row);
	f.addEventListener("submit", (e) => {
		e.preventDefault();
		const body = text.value.trim();
		if (!body) {
			text.focus();
			return;
		}
		onSubmit({ name: name.value.trim().slice(0, MAX_NAME) || "Guest", text: body.slice(0, MAX_TEXT) });
		text.value = "";
	});
	return f;
}

function renderPost(p, onReply) {
	const owner = p.owner && LOCAL_HOSTS.includes(location.hostname);
	const li = el("li", { class: "post" + (owner ? " by-owner" : ""), "data-id": p.id });
	const meta = el("div", { class: "meta" });
	meta.append(el("span", { class: "who" }, p.name));
	if (owner) meta.append(el("span", { class: "badge" }, "Site owner"));
	meta.append(el("time", { datetime: new Date(p.ts).toISOString() }, when(p.ts)));
	li.append(meta, el("p", { class: "body" }, p.text));
	if (onReply) {
		const rb = el("button", { type: "button", class: "linkbtn" }, "Reply");
		rb.addEventListener("click", () => {
			const existing = li.querySelector(":scope > form");
			if (existing) {
				existing.remove();
				return;
			}
			const form = buildForm((data) => onReply(p.id, data), { compact: true, label: "Post reply" });
			rb.after(form);
			form.querySelector("textarea").focus();
		});
		li.append(rb);
	}
	if (p.replies && p.replies.length) {
		const ol = el("ol", { class: "replies" });
		for (const r of p.replies) ol.append(renderPost(r, null));
		li.append(ol);
	}
	return li;
}

function mount(root) {
	const list = el("ol", { class: "posts", "aria-live": "polite" });
	const count = document.querySelector("[data-talk-count]");

	function draw() {
		const posts = store.load().sort((a, b) => b.ts - a.ts); // newest first
		list.textContent = "";
		if (count) count.textContent = posts.length ? `(${posts.length})` : "";
		if (!posts.length) {
			list.append(
				el(
					"li",
					{ class: "empty" },
					"No comments yet. Did you beat the AI? Post your final score, or share the one tip that helped you most.",
				),
			);
			return;
		}
		for (const p of posts) list.append(renderPost(p, reply));
	}

	function add({ name, text }) {
		const posts = store.load();
		posts.push({ id: uid(), name, text, ts: Date.now(), owner: OWNER, replies: [] });
		store.save(posts);
		draw();
	}

	function reply(id, { name, text }) {
		const posts = store.load();
		const p = posts.find((x) => x.id === id);
		if (!p) return;
		(p.replies ||= []).push({ id: uid(), name, text, ts: Date.now(), owner: OWNER });
		store.save(posts);
		draw();
	}

	root.append(buildForm(add), list);
	draw();
}

const root = document.getElementById("talk-root");
if (root) mount(root);
