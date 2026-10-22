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


  // ---------- ressemblance entre noms de groupes (jeu des logos) ----------
  // Les mauvaises réponses sont choisies parmi les noms les plus proches de la bonne : même première lettre,
  // mêmes premières lettres de chaque mot, même nombre de mots, même fin du dernier mot, longueur voisine.
  const nameKey = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ")
    .replace(/[^a-z0-9\u0400-\u04ff\u0370-\u03ff\u3040-\u30ff\u4e00-\u9fff\s]+/g, " ").replace(/\s+/g, " ").trim();
  const words = (s) => { const k = nameKey(s); return k ? k.split(" ") : []; };
  const commonPrefix = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
  const commonSuffix = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++; return i; };
  function similarity(a, b) {
    const wa = words(a), wb = words(b);
    if (!wa.length || !wb.length) return 0;
    let sc = 0;
    // même nombre de mots
    sc += wa.length === wb.length ? 6 : -2 * Math.min(3, Math.abs(wa.length - wb.length));
    // premier mot : même première lettre, puis les premières lettres communes (jusqu'à 4)
    if (wa[0][0] === wb[0][0]) sc += 5;
    sc += 1.5 * Math.min(4, commonPrefix(wa[0], wb[0]));
    if (wa[0] === wb[0] && wa.length > 1) sc += 4;   // même premier mot (« Black … »)
    // chaque mot, à la même place : début identique
    const n = Math.min(wa.length, wb.length);
    for (let i = 1; i < n; i++) {
      if (wa[i][0] === wb[i][0]) sc += 2;
      sc += 0.8 * Math.min(3, commonPrefix(wa[i], wb[i]));
    }
    // dernier mot : même fin (jusqu'à 4 lettres)
    const la = wa[wa.length - 1], lb = wb[wb.length - 1];
    sc += 1.5 * Math.min(4, commonSuffix(la, lb));
    if (la === lb && wa.length > 1) sc += 2;
    // longueur voisine (premier mot, dernier mot, ensemble)
    sc -= 0.4 * Math.abs(wa[0].length - wb[0].length) + 0.4 * Math.abs(la.length - lb.length)
        + 0.15 * Math.abs(nameKey(a).length - nameKey(b).length);
    return sc;
  }
  // 3 noms proches de `correct`, tirés au sort parmi les plus ressemblants (un peu de hasard pour varier les parties)
  function closeNames(correct, names, count = 3) {
    const ck = nameKey(correct), seen = new Set([ck]);
    const scored = [];
    for (const n of names) {
      const k = nameKey(n);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      scored.push({ n, s: similarity(correct, n) + Math.random() * 1.5 });
    }
    scored.sort((x, y) => y.s - x.s);
    return scored.slice(0, count).map((x) => x.n);
  }
  window.__closeNames = closeNames;

  // liste des groupes avec les infos utiles aux trois pages
  function bands() {
    const { state, clean, col, bandName } = A();
    const bh = state.data.bands.headers;
    const cH = col(bh, CONFIG.bands.countryCol);
    const lH = CONFIG.bands.logoCol && col(bh, CONFIG.bands.logoCol);
    const locH = CONFIG.bands.locationCol && col(bh, CONFIG.bands.locationCol), gH = CONFIG.bands.genreCol && col(bh, CONFIG.bands.genreCol);
    return state.data.bands.rows
      .map((r) => ({ k: r.__k, name: bandName(r), country: cH ? clean(r[cH]) : "", logo: lH ? clean(r[lH]) : "",
        location: locH ? clean(r[locH]) : "", genre: gH ? clean(r[gH]) : "" }))
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
  // Chaque groupe est placé dans sa ville (colonne Location) ; si la ville est inconnue,
  // il est placé au centre de son pays (marqueur creux). Les groupes proches se regroupent
  // en bulles qui se séparent quand on zoome.
  const MAP = {
    map: null,
    show() {
      const note = $("#map-note");
      if (!window.L) { note.textContent = "La carte n'a pas pu être chargée (bibliothèque Leaflet injoignable)."; return; }
      if (!this.map) this.build();
      setTimeout(() => this.map.invalidateSize(), 50);
    },
    build() {
      this.map = L.map("map", { worldCopyJump: true, minZoom: 2, maxZoom: 14, zoomSnap: 0.5 }).setView([30, 10], 2);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(this.map);
      $("#map-note").textContent = "Chargement des villes…";
      // le fichier des villes est chargé une seule fois, puis mis en cache par le navigateur
      fetch(CONFIG.citiesFile).then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((j) => { window.CITY_INDEX = j; }).catch((e) => console.warn("cities.json indisponible : positions au niveau des pays", e))
        .finally(() => this.draw());
    },
    draw() {
      const dot = (cls) => L.divIcon({ className: "band-dot-wrap", html: `<div class="band-dot ${cls}"></div>`, iconSize: [14, 14] });
      const iconExact = dot(""), iconApprox = dot("approx");
      const layer = L.markerClusterGroup
        ? L.markerClusterGroup({
            showCoverageOnHover: false, maxClusterRadius: 45, spiderfyOnMaxZoom: true, chunkedLoading: true,
            iconCreateFunction: (c) => {
              const n = c.getChildCount(), d = Math.round(Math.min(62, 26 + Math.sqrt(n) * 3));
              return L.divIcon({ className: "country-bubble-wrap", iconSize: [d, d], html: `<div class="country-bubble" style="width:${d}px;height:${d}px">${n}</div>` });
            },
          })
        : L.layerGroup();
      let exact = 0, approx = 0; const missing = new Map();
      for (const b of bands()) {
        if (!validCountry(b.country)) continue;
        let pos = cityCoord(b.location, b.country), isExact = !!pos;
        if (!pos) pos = countryCoord(b.country);
        if (!pos) { missing.set(b.country, (missing.get(b.country) || 0) + 1); continue; }
        isExact ? exact++ : approx++;
        const m = L.marker(pos, { icon: isExact ? iconExact : iconApprox, title: b.name });
        m.bindTooltip(A().esc(b.name));
        m.bindPopup(() => this.popup(b, isExact), { maxWidth: 300 });
        layer.addLayer(m);
      }
      layer.addTo(this.map);
      let msg = `${exact + approx} groupes sur la carte : ${exact} placés dans leur ville`;
      if (approx) msg += `, ${approx} au centre de leur pays (cercle creux : ville inconnue ou absente de la colonne Location)`;
      msg += ". Zoome pour séparer les bulles.";
      if (missing.size) msg += ` Pays absents de la carte (à ajouter dans countries.js) : ${[...missing].map(([k, v]) => `${k} (${v})`).join(", ")}.`;
      $("#map-note").textContent = msg;
    },
    popup(b, isExact) {
      const { esc, openBand } = A();
      const el = document.createElement("div");
      el.className = "map-pop";
      const place = [b.location, b.country].filter(Boolean).join(" — ");
      el.innerHTML = `<h3>${esc(b.name)}</h3>` +
        (place ? `<p class="muted">${esc(place)}</p>` : "") +
        (b.genre ? `<p>${esc(b.genre)}</p>` : "") +
        (isExact ? "" : `<p class="muted">Position approximative (centre du pays).</p>`) +
        `<button class="ghost" data-band="${esc(b.k)}">Voir la fiche →</button>`;
      el.onclick = (e) => { const x = e.target.closest("[data-band]"); if (x) openBand(x.dataset.band); };
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
      // noms uniques (sans tenir compte de la casse ni des accents) : deux groupes homonymes comptent pour un seul nom
      const byKey = new Map();
      for (const b of all) if (!byKey.has(nameKey(b.name))) byKey.set(nameKey(b.name), b.name);
      this.names = [...byKey.values()];
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
      const wrong = this.mode === "logo"
        ? closeNames(this.correct, this.names)   // noms proches de la bonne réponse
        : shuffle(source.filter((x) => lc(x) !== lc(this.correct))).slice(0, 3);
      this.options = shuffle([this.correct, ...wrong]);
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
      const { esc } = A(), ok = nameKey(btn.dataset.v) === nameKey(this.correct);
      if (ok) { this.score++; this.streak++; this.best = Math.max(this.best, this.streak); } else this.streak = 0;
      document.querySelectorAll("#game-box .choice").forEach((b) => {
        b.disabled = true;
        if (nameKey(b.dataset.v) === nameKey(this.correct)) b.classList.add("ok");
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
