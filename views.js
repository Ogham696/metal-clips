// ============================================================
//  Pages « Accueil », « Carte » et « Jeux »
//  (utilise les données déjà chargées par app.js via window.APP)
// ============================================================
(() => {
  const $ = (s) => document.querySelector(s);
  const A = () => window.APP;
  const isHttp = (u) => /^https?:\/\//i.test(u || "");
  const validCountry = (c) => !!c && c !== "?";
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  // liste des groupes avec les infos utiles aux trois pages
  function bands() {
    const { state, clean, col, bandName } = A();
    const bh = state.data.bands.headers;
    const cH = col(bh, CONFIG.bands.countryCol);
    const lH = CONFIG.bands.logoCol && col(bh, CONFIG.bands.logoCol);
    return state.data.bands.rows
      .map((r) => ({ k: r.__k, name: bandName(r), country: cH ? clean(r[cH]) : "", logo: lH ? clean(r[lH]) : "" }))
      .filter((b) => b.name);
  }

  // ================= ACCUEIL =================
  const HOME = {
    show() {
      const { state, clean, esc, col, sortNum, hasUrl, searchLink } = A();
      const ch = state.data.clips.headers, c = CONFIG.clips;
      const H = (n) => col(ch, n);
      const dH = H(c.dateCol), tH = H(c.titleCol), bH = H(c.bandCol);
      const all = bands();
      const byK = new Map(all.map((b) => [b.k, b]));
      const countries = new Set(all.map((b) => b.country).filter(validCountry));

      // les N clips les plus récents (ceux qui ont une vraie date)
      const items = (dH ? state.data.clips.rows : [])
        .map((r) => ({ r, t: sortNum(clean(r[dH])) }))
        .filter((x) => x.t !== null && x.t > 1e11)
        .sort((a, b) => b.t - a.t)
        .slice(0, CONFIG.homeCount || 20);

      const cards = items.map(({ r }, i) => {
        const band = clean(r[bH]), logo = (byK.get(r.__k) || {}).logo;
        const meta = [clean(r[H("VIDEO'S TYPE")] || ""), clean(r[H("COUNTRY")] || ""), clean(r[H("STYLE FROM SOURCES")] || ""), clean(r[H("FEAT")] || "")]
          .filter(Boolean).map(esc).join(" · ");
        return `<article class="card">
          ${isHttp(logo) ? `<div class="card-logo"><img src="${esc(logo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></div>` : ""}
          <div class="card-body">
            <div class="card-date">${esc(clean(r[dH]))}</div>
            <h3 class="card-song">${esc(clean(r[tH]))}</h3>
            ${r.__k ? `<button class="link-btn card-band" data-band="${esc(r.__k)}">${esc(band)}</button>` : `<span class="card-band">${esc(band)}</span>`}
            ${meta ? `<div class="card-meta">${meta}</div>` : ""}
          </div>
          <div class="card-actions">${hasUrl(r) ? `<button class="play" data-play="${i}" title="Lire le clip">▶</button>` : searchLink(r)}</div>
        </article>`;
      }).join("");

      const el = $("#view-home");
      el.innerHTML = `
        <div class="stats">
          <div class="stat"><b>${state.data.clips.rows.length}</b>clips</div>
          <div class="stat"><b>${state.data.bands.rows.length}</b>groupes</div>
          <div class="stat"><b>${countries.size}</b>pays</div>
        </div>
        <h2 class="section-title">${items.length ? `Les ${items.length} derniers clips` : "Derniers clips"}</h2>
        ${items.length ? `<div class="cards">${cards}</div>` : `<p class="muted">Aucun clip avec une date pour le moment.</p>`}
        <p class="home-links">
          <button class="ghost" data-go="clips">Tous les clips →</button>
          <button class="ghost" data-go="map">Carte du monde →</button>
          <button class="ghost" data-go="games">Jeux →</button>
        </p>`;
      el.onclick = (e) => {
        const p = e.target.closest("[data-play]"), b = e.target.closest("[data-band]"), g = e.target.closest("[data-go]");
        if (p) A().openClip(items[+p.dataset.play].r);
        else if (b) A().openBand(b.dataset.band);
        else if (g) A().switchTab(g.dataset.go);
      };
    },
  };

  // ================= CARTE =================
  const MAP = {
    map: null,
    show() {
      const note = $("#map-note");
      if (!window.L) { note.textContent = "La carte n'a pas pu être chargée (bibliothèque Leaflet injoignable)."; return; }
      if (!this.map) this.build();
      setTimeout(() => this.map.invalidateSize(), 50);
    },
    build() {
      const { esc } = A();
      this.map = L.map("map", { worldCopyJump: true, minZoom: 2, maxZoom: 8, zoomSnap: 0.5 }).setView([30, 10], 2);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(this.map);

      // regroupe les groupes par pays
      const groups = new Map(), missing = new Map();
      let placed = 0;
      for (const b of bands()) {
        if (!validCountry(b.country)) continue;
        const pos = countryCoord(b.country);
        if (!pos) { missing.set(b.country, (missing.get(b.country) || 0) + 1); continue; }
        const key = pos.join(",");
        if (!groups.has(key)) groups.set(key, { label: b.country, pos, list: [] });
        groups.get(key).list.push(b);
        placed++;
      }
      for (const g of groups.values()) {
        const n = g.list.length, d = Math.round(Math.min(64, 22 + Math.sqrt(n) * 5));
        const icon = L.divIcon({ className: "country-bubble-wrap", iconSize: [d, d],
          html: `<div class="country-bubble" style="width:${d}px;height:${d}px">${n}</div>` });
        // les petites bulles passent au-dessus des grosses (pays voisins qui se chevauchent)
        const m = L.marker(g.pos, { icon, title: g.label, zIndexOffset: Math.round(10000 / n) }).addTo(this.map);
        m.bindTooltip(`${esc(g.label)} — ${n} groupe${n > 1 ? "s" : ""}`);
        m.bindPopup(() => this.popup(g), { maxWidth: 320 });
      }
      let msg = `${placed} groupes placés sur ${groups.size} pays. Clique sur une bulle pour voir les groupes.`;
      if (missing.size) msg += ` Pays absents de la carte (à ajouter dans countries.js) : ${[...missing].map(([k, v]) => `${k} (${v})`).join(", ")}.`;
      $("#map-note").textContent = msg;
    },
    popup(g) {
      const { esc, openBand, gotoBands } = A();
      const n = g.list.length, sorted = g.list.slice().sort((a, b) => a.name.localeCompare(b.name)), shown = sorted.slice(0, 15);
      const el = document.createElement("div");
      el.className = "map-pop";
      el.innerHTML = `<h3>${esc(g.label)}</h3><p class="muted">${n} groupe${n > 1 ? "s" : ""}</p>` +
        `<div class="pop-list">${shown.map((b) => `<button class="link-btn" data-band="${esc(b.k)}">${esc(b.name)}</button>`).join("")}</div>` +
        (n > shown.length ? `<p class="muted">… et ${n - shown.length} autres</p>` : "") +
        `<button class="ghost" data-all>Voir les ${n} groupes →</button>`;
      el.onclick = (e) => {
        const b = e.target.closest("[data-band]");
        if (b) openBand(b.dataset.band);
        else if (e.target.closest("[data-all]")) gotoBands({ [CONFIG.bands.countryCol]: g.label });
      };
      return el;
    },
  };

  // ================= JEUX =================
  const GAMES = {
    mode: "logo", pool: [], deck: [], names: [], countries: [],
    score: 0, played: 0, streak: 0, best: 0,
    cur: null, correct: "", options: [], answered: false, inited: false,

    show() {
      if (this.inited) return;
      this.inited = true;
      $("#game-modes").onclick = (e) => { const b = e.target.closest("[data-game]"); if (b) this.start(b.dataset.game); };
      $("#game-box").onclick = (e) => {
        const ch = e.target.closest(".choice"), bb = e.target.closest("[data-band]");
        if (ch) this.answer(ch);
        else if (e.target.closest("#game-next")) this.next();
        else if (bb) A().openBand(bb.dataset.band);
      };
      // clavier : 1-4 pour répondre, Entrée / espace / → pour passer à la suite
      document.addEventListener("keydown", (e) => {
        if (A().state.tab !== "games" || !$("#modal").classList.contains("hidden")) return;
        if (e.target.closest("input,textarea,select,button")) return;
        if (/^[1-4]$/.test(e.key) && !this.answered) {
          const btn = document.querySelectorAll("#game-box .choice")[+e.key - 1];
          if (btn) this.answer(btn);
        } else if (this.answered && (e.key === "Enter" || e.key === " " || e.key === "ArrowRight")) { e.preventDefault(); this.next(); }
      });
      this.start(this.mode);
    },

    start(mode) {
      this.mode = mode;
      document.querySelectorAll("#game-modes [data-game]").forEach((b) => b.classList.toggle("active", b.dataset.game === mode));
      const all = bands();
      this.pool = mode === "logo" ? all.filter((b) => isHttp(b.logo)) : all.filter((b) => validCountry(b.country));
      this.names = [...new Set(all.map((b) => b.name))];
      this.countries = [...new Set(all.map((b) => b.country).filter(validCountry))];
      this.score = this.played = this.streak = 0;
      this.deck = [];
      this.next();
    },

    next() {
      const box = $("#game-box"), source = this.mode === "logo" ? this.names : this.countries;
      if (!this.pool.length || source.length < 4) {
        box.innerHTML = `<p class="muted">${this.mode === "logo"
          ? "Pas assez de logos pour jouer (colonne « URL Logo » vide, ou images inaccessibles)."
          : "Pas assez de groupes avec un pays pour jouer."}</p>`;
        return;
      }
      if (!this.deck.length) this.deck = shuffle(this.pool);   // on ne repose pas deux fois la même question avant d'avoir fait le tour
      const item = this.deck.pop();
      this.cur = item; this.answered = false;
      this.correct = this.mode === "logo" ? item.name : item.country;
      const lc = (s) => s.toLowerCase();
      this.options = shuffle([this.correct, ...shuffle(source.filter((x) => lc(x) !== lc(this.correct))).slice(0, 3)]);
      this.render();
    },

    scoreLine() {
      return `Score : <b>${this.score}</b> / ${this.played} &nbsp;·&nbsp; Série : <b>${this.streak}</b> &nbsp;·&nbsp; Record : ${this.best}`;
    },

    render() {
      const { esc } = A(), item = this.cur;
      const visual = this.mode === "logo"
        ? `<div class="game-visual game-logo"><img src="${esc(item.logo)}" alt="Logo d'un groupe" referrerpolicy="no-referrer"></div><p class="game-prompt">Quel est ce groupe ?</p>`
        : `<div class="game-visual"><div class="game-band">${esc(item.name)}</div></div><p class="game-prompt">De quel pays vient ce groupe ?</p>`;
      $("#game-box").innerHTML = `<div class="game-score" id="game-score">${this.scoreLine()}</div>${visual}` +
        `<div class="choices">${this.options.map((o, i) => `<button class="choice" data-v="${esc(o)}"><span class="k">${i + 1}</span>${esc(o)}</button>`).join("")}</div>` +
        `<div class="game-foot" id="game-foot"></div>`;
      const img = $("#game-box .game-logo img");
      // logo inaccessible : on l'écarte et on passe à la question suivante
      if (img) img.addEventListener("error", () => {
        this.pool = this.pool.filter((b) => b !== item); this.deck = this.deck.filter((b) => b !== item); this.next();
      });
    },

    answer(btn) {
      if (this.answered) return;
      this.answered = true; this.played++;
      const { esc } = A(), ok = btn.dataset.v === this.correct;
      if (ok) { this.score++; this.streak++; this.best = Math.max(this.best, this.streak); } else this.streak = 0;
      document.querySelectorAll("#game-box .choice").forEach((b) => {
        b.disabled = true;
        if (b.dataset.v === this.correct) b.classList.add("ok");
        else if (b === btn) b.classList.add("ko");
        else b.classList.add("dim");
      });
      $("#game-score").innerHTML = this.scoreLine();
      $("#game-foot").innerHTML =
        `<span class="verdict ${ok ? "ok" : "ko"}">${ok ? "✔ Bonne réponse !" : "✘ C'était : " + esc(this.correct)}</span>` +
        `<button class="link-btn" data-band="${esc(this.cur.k)}">Fiche de ${esc(this.cur.name)} ↗</button>` +
        `<button id="game-next" class="play">Suivant →</button>`;
    },
  };

  window.VIEWS = { home: HOME, map: MAP, games: GAMES };
})();
