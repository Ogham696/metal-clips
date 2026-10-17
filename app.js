(() => {
  const $ = (s) => document.querySelector(s);
  const NA = new Set(CONFIG.naValues.map((v) => v.toLowerCase()));
  const norm = (s) => (s ?? "").toString().trim().toLowerCase();
  const clean = (v) => { v = (v ?? "").toString().trim(); return NA.has(v.toLowerCase()) ? "" : v; };
  const key = (s) => clean(s).toUpperCase();

  const state = {
    tab: "clips",
    data: { clips: { headers: [], rows: [] }, bands: { headers: [], rows: [] } },
    bandIndex: new Map(),   // NOM -> ligne groupe
    clipsByBand: new Map(), // NOM -> [lignes clip]
    search: "", filters: {}, onlyFav: false,
    sort: { col: null, desc: false }, page: 1,
  };

  // ---------- Utilitaires ----------
  const col = (headers, name) => headers.find((h) => norm(h) === norm(name));
  // Le lien groupe <-> clip se fait UNIQUEMENT par l'ID Metal Archives (les homonymes existent).
  // ID vide = groupe absent de la table des groupes = pas de lien.
  const normId = (v) => clean(v).replace(/\s/g, "");
  const bandId = (row) => { const h = col(state.data.bands.headers, CONFIG.bands.maIdCol); return h ? normId(row[h]) : ""; };
  const clipId = (row) => { const h = col(state.data.clips.headers, CONFIG.clips.maIdCol); return h ? normId(row[h]) : ""; };
  const bandName = (row) => {
    for (const c of CONFIG.bands.nameCols) { const h = col(state.data.bands.headers, c); if (h && clean(row[h])) return clean(row[h]); }
    return "";
  };
  const isFav = (row) => {
    const h = col(state.data.clips.headers, CONFIG.clips.favCol);
    if (!h) return false;
    const v = norm(clean(row[h]));
    return v !== "" && v !== "false" && v !== "0" && v !== "no" && v !== "non";
  };
  const ytId = (url) => {
    const m = url.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([\w-]{11})/);
    return m ? m[1] : null;
  };
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Clip sans lien en base : lien vers une recherche YouTube (groupe + titre)
  const hasUrl = (row) => /^https?:/i.test(clean(row[col(state.data.clips.headers, CONFIG.clips.urlCol)]));
  const searchLink = (row) => {
    const h = state.data.clips.headers, c = CONFIG.clips;
    const q = [clean(row[col(h, c.bandCol)]), clean(row[col(h, c.titleCol)])].filter(Boolean).join(" ");
    const url = "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
    return `<a class="nosearch" href="${esc(url)}" target="_blank" rel="noopener" title="Ce clip n'est pas encore en base. Ce lien ouvre une recherche YouTube qui devrait donner le bon résultat.">🔍 Pas encore en base</a>`;
  };

  function parseUrl(url) {
    return new Promise((resolve, reject) => {
      Papa.parse(encodeURI(url), {
        download: true, header: true, skipEmptyLines: "greedy",
        complete: (r) => (r.meta.fields && r.meta.fields.length > 1 && r.data.length)
          ? resolve({ headers: r.meta.fields, rows: r.data }) : reject(new Error("fichier vide ou invalide : " + url)),
        error: reject,
      });
    });
  }
  // essaie la source principale, puis le fichier de secours
  async function load(cfg) {
    try { return await parseUrl(cfg.file); }
    catch (e) { if (!cfg.fallback) throw e; console.warn("Source principale indisponible, utilisation du secours", e); return parseUrl(cfg.fallback); }
  }

  // ---------- Initialisation ----------
  async function init() {
    $("#status").textContent = "Chargement…";
    try {
      const [clips, bands] = await Promise.all([load(CONFIG.clips), load(CONFIG.bands)]);
      state.data.clips = clips; state.data.bands = bands;
    } catch (e) {
      // on montre la vue tableau pour que le message d'erreur soit visible
      document.querySelectorAll(".view").forEach((v) => v.classList.toggle("hidden", v.id !== "view-table"));
      $("#status").textContent = "Impossible de charger les CSV : " + e;
      return;
    }
    // ignore les lignes sans nom de groupe (ex. ligne vide remplie de #N/A)
    const bandH = col(state.data.clips.headers, CONFIG.clips.bandCol);
    state.data.clips.rows = state.data.clips.rows.filter((r) => clean(r[bandH]));
    const nameH = CONFIG.bands.nameCols.map((c) => col(state.data.bands.headers, c)).filter(Boolean);
    state.data.bands.rows = state.data.bands.rows.filter((r) => nameH.some((h) => clean(r[h])));
    // index des groupes
    // (un groupe sans ID reçoit une clé unique : il s'affiche, mais aucun clip ne peut s'y rattacher)
    state.data.bands.rows.forEach((r, i) => { r.__k = bandId(r) || "row-" + i; state.bandIndex.set(r.__k, r); });
    // clips par groupe + compléments depuis les groupes
    for (const r of state.data.clips.rows) {
      const k = clipId(r);
      r.__k = state.bandIndex.has(k) ? k : "";
      if (!r.__k) continue;
      if (!state.clipsByBand.has(k)) state.clipsByBand.set(k, []);
      state.clipsByBand.get(k).push(r);
      const b = state.bandIndex.get(k);
      if (b) for (const [cc, bc] of Object.entries(CONFIG.clips.fillFromBands)) {
        const ch = col(state.data.clips.headers, cc), bh = col(state.data.bands.headers, bc);
        if (ch && bh && !clean(r[ch]) && clean(b[bh])) r[ch] = b[bh];
      }
    }
    $("#count-clips").textContent = state.data.clips.rows.length;
    $("#count-bands").textContent = state.data.bands.rows.length;
    bindEvents();
    const fromHash = (location.hash || "").slice(1);
    switchTab(TABS.includes(fromHash) ? fromHash : "home");
  }

  // ---------- Événements ----------
  function bindEvents() {
    document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));
    let t; $("#search").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { state.search = e.target.value; state.page = 1; render(); }, 150); });
    $("#only-fav").addEventListener("change", (e) => { state.onlyFav = e.target.checked; state.page = 1; render(); });
    $("#reset").addEventListener("click", () => { state.search = ""; state.filters = {}; state.onlyFav = false; state.sort = defaultSort(state.tab); $("#search").value = ""; $("#only-fav").checked = false; buildFilters(); state.page = 1; render(); });
    $("#modal-close").addEventListener("click", closeModal);
    $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  }

  function defaultSort(tab) {
    const ds = CONFIG[tab].defaultSort, dh = ds && col(state.data[tab].headers, ds.col);
    return dh ? { col: dh, desc: !!ds.desc } : { col: null, desc: false };
  }

  const TABS = ["home", "clips", "bands", "map", "games"];
  const isTable = (tab) => tab === "clips" || tab === "bands";

  // ouvre l'onglet Groupes avec des filtres préremplis, ex. { "Country of origin": "France" }
  function gotoBands(filters) {
    closeModal();
    switchTab("bands");
    for (const [name, val] of Object.entries(filters || {})) {
      const h = col(state.data.bands.headers, name);
      if (h) state.filters[h] = val;
    }
    buildFilters(); render();
  }

  function switchTab(tab) {
    // quelle vue afficher ?
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    const viewId = "view-" + (isTable(tab) ? "table" : tab);
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("hidden", v.id !== viewId));
    try { history.replaceState(null, "", "#" + tab); } catch (e) { /* sans importance */ }
    if (!isTable(tab)) {
      state.tab = tab;
      window.scrollTo(0, 0);
      if (window.VIEWS && window.VIEWS[tab]) window.VIEWS[tab].show();
      return;
    }
    state.tab = tab; state.search = ""; state.filters = {}; state.onlyFav = false; state.page = 1;
    state.sort = defaultSort(tab);
    $("#search").value = ""; $("#only-fav").checked = false;
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    $("#only-fav").parentElement.style.display = tab === "clips" && col(state.data.clips.headers, CONFIG.clips.favCol) ? "" : "none";
    buildFilters();
    render();
  }

  function buildFilters() {
    const cfg = CONFIG[state.tab], { headers, rows } = state.data[state.tab];
    const box = $("#filters"); box.innerHTML = "";
    for (const f of cfg.filters) {
      const h = col(headers, f.col); if (!h) continue;
      const set = new Set();
      for (const r of rows) {
        const v = clean(r[h]); if (!v) continue;
        (f.split ? v.split(f.split) : [v]).forEach((x) => { x = x.trim(); if (x) set.add(x); });
      }
      const sel = document.createElement("select");
      sel.innerHTML = `<option value="">${esc(h)} : tous</option>` +
        [...set].sort((a, b) => a.localeCompare(b)).map((v) => `<option>${esc(v)}</option>`).join("");
      sel.value = state.filters[h] || "";
      sel.addEventListener("change", () => { state.filters[h] = sel.value; state.page = 1; render(); });
      box.appendChild(sel);
    }
  }

  // ---------- Filtrage / tri ----------
  // valeur numérique pour le tri : nombre, durée mm:ss / h:mm:ss, date "1 juil. 2026" ; sinon null
  const MONTHS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
  function sortNum(v) {
    if (/^-?\d+([.,]\d+)?$/.test(v)) return parseFloat(v.replace(",", "."));
    if (/^\d{1,2}(:\d{2}){1,2}$/.test(v)) return v.split(":").reduce((a, n) => a * 60 + +n, 0);
    const m = v.match(/^(\d{1,2})\s+([^\s\d.]+)\.?\s+(\d{4})$/);
    if (m) {
      const mi = MONTHS.findIndex((x) => m[2].toLowerCase().startsWith(x));
      if (mi >= 0) return Date.UTC(+m[3], mi, +m[1]);
    }
    return null;
  }

  function filtered() {
    const cfg = CONFIG[state.tab], { headers, rows } = state.data[state.tab];
    const q = norm(state.search);
    const favH = col(state.data.clips.headers, CONFIG.clips.favCol);
    let out = rows.filter((r) => {
      if (state.tab === "clips" && state.onlyFav && favH && !isFav(r)) return false;
      for (const [h, v] of Object.entries(state.filters)) {
        if (!v) continue;
        const f = cfg.filters.find((x) => norm(x.col) === norm(h));
        const cell = clean(r[h]);
        const parts = f && f.split ? cell.split(f.split).map((x) => x.trim()) : [cell];
        if (!parts.includes(v)) return false;
      }
      if (q) return headers.some((h) => norm(clean(r[h])).includes(q));
      return true;
    });
    const { col: sc, desc } = state.sort;
    if (sc) {
      out = out.slice().sort((a, b) => {
        const x = clean(a[sc]), y = clean(b[sc]);
        if (!x && y) return 1; if (x && !y) return -1;
        const nx = sortNum(x), ny = sortNum(y);
        const c = nx !== null && ny !== null ? nx - ny : x.localeCompare(y, undefined, { numeric: true });
        return desc ? -c : c;
      });
    }
    return out;
  }

  // ---------- Rendu ----------
  function visibleHeaders() {
    const cfg = CONFIG[state.tab];
    const hidden = new Set(cfg.hide.map(norm));
    return state.data[state.tab].headers.filter((h) => !hidden.has(norm(h)) && !/^column \d+$/i.test(h) || (state.tab === "bands" && CONFIG.bands.nameCols.some((c) => norm(c) === norm(h))));
  }

  function cellHTML(h, row) {
    const v = clean(row[h]);
    const cfg = CONFIG[state.tab];
    if (state.tab === "clips" && norm(h) === norm(cfg.urlCol) && !/^https?:/i.test(v)) return searchLink(row);
    if (!v) return "";
    if (state.tab === "clips") {
      if (norm(h) === norm(cfg.urlCol) && /^https?:/i.test(v)) return `<button class="play" data-clip="${esc(v)}">▶</button>`;
      if (norm(h) === norm(cfg.bandCol)) return row.__k ? `<button class="link-btn" data-band="${esc(row.__k)}">${esc(v)}</button>` : esc(v);
      if (norm(h) === norm(cfg.favCol)) return isFav(row) ? '<span class="star">★</span>' : "";
    }
    if (state.tab === "bands" && CONFIG.bands.nameCols.some((c) => norm(c) === norm(h))) return `<button class="link-btn" data-band="${esc(row.__k)}">${esc(v)}</button>`;
    if (/^https?:/i.test(v)) return `<a href="${esc(v)}" target="_blank" rel="noopener">lien</a>`;
    return v.split("\n").map((x) => `<span class="multi">${esc(x)}</span>`).join("");
  }

  function render() {
    const rows = filtered(), headers = visibleHeaders();
    const size = CONFIG.pageSize, pages = Math.max(1, Math.ceil(rows.length / size));
    state.page = Math.min(state.page, pages);
    const slice = rows.slice((state.page - 1) * size, state.page * size);

    $("#status").textContent = `${rows.length} résultat${rows.length > 1 ? "s" : ""}`;
    $("#table thead").innerHTML = "<tr>" + headers.map((h) =>
      `<th data-col="${esc(h)}" class="${state.sort.col === h ? "sorted" + (state.sort.desc ? " desc" : "") : ""}">${esc(h)}</th>`).join("") + "</tr>";
    $("#table tbody").innerHTML = slice.map((r, i) =>
      `<tr data-i="${rows.indexOf(r)}">` + headers.map((h) => `<td>${cellHTML(h, r)}</td>`).join("") + "</tr>").join("");

    $("#pager").innerHTML = `<button ${state.page <= 1 ? "disabled" : ""} data-p="-1">←</button><span>Page ${state.page} / ${pages}</span><button ${state.page >= pages ? "disabled" : ""} data-p="1">→</button>`;

    $("#table thead").onclick = (e) => {
      const th = e.target.closest("th"); if (!th) return;
      const c = th.dataset.col;
      state.sort = { col: c, desc: state.sort.col === c && !state.sort.desc };
      render();
    };
    $("#table tbody").onclick = (e) => {
      const play = e.target.closest("[data-clip]"), band = e.target.closest("[data-band]");
      if (play) { const tr = play.closest("tr"); openClip(rows[+tr.dataset.i]); }
      else if (band) openBand(band.dataset.band);
    };
    $("#pager").onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      state.page += +b.dataset.p; render(); $(".table-wrap").scrollTop = 0;
    };
  }

  // ---------- Fiches détail ----------
  function dl(headers, row, skip = []) {
    const s = new Set(skip.map(norm));
    const items = headers.filter((h) => !s.has(norm(h)) && clean(row[h]) && !/^column \d+$/i.test(h))
      .map((h) => {
        const v = clean(row[h]);
        const val = /^https?:/i.test(v) ? `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(v)}</a>` : esc(v).replace(/\n/g, "<br>");
        return `<dt>${esc(h)}</dt><dd>${val}</dd>`;
      });
    return `<dl>${items.join("")}</dl>`;
  }

  function openModal(html) { $("#modal-content").innerHTML = html; $("#modal").classList.remove("hidden"); }
  function closeModal() { $("#modal").classList.add("hidden"); $("#modal-content").innerHTML = ""; }

  function openClip(row) {
    const c = CONFIG.clips, h = state.data.clips.headers;
    const url = clean(row[col(h, c.urlCol)]);
    const id = ytId(url);
    const player = id
      ? `<iframe class="video" src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`
      : `<p><a href="${esc(url)}" target="_blank" rel="noopener">Ouvrir le clip ↗</a></p>`;
    const band = clean(row[col(h, c.bandCol)]);
    openModal(`<h2>${esc(band)} — ${esc(clean(row[col(h, c.titleCol)]))}</h2>${player}` +
      dl(h, row, [c.urlCol, "Colonne 1", "ACTION", "Column 1"]) +
      (row.__k ? `<button class="ghost" id="to-band">Voir la fiche du groupe</button>` : ""));
    const tb = $("#to-band"); if (tb) tb.onclick = () => openBand(row.__k);
  }

  function openBand(k) {
    const b = state.bandIndex.get(k), clips = state.clipsByBand.get(k) || [];
    const ch = state.data.clips.headers, c = CONFIG.clips;
    const name = b ? bandName(b) : k;
    // deux colonnes : infos à gauche, logo à droite (sans cadre)
    const lh = b && CONFIG.bands.logoCol && col(state.data.bands.headers, CONFIG.bands.logoCol), logo = lh ? clean(b[lh]) : "";
    const logoHtml = /^https?:\/\//i.test(logo)
      ? `<div class="band-logo"><img src="${esc(logo)}" alt="Logo ${esc(name)}" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></div>` : "";
    let info = "";
    if (b) {
      const bh = state.data.bands.headers;
      info += dl(bh, b, [...CONFIG.bands.nameCols, "BAND"].concat(CONFIG.bands.maIdCol ? [CONFIG.bands.maIdCol] : [], CONFIG.bands.logoCol ? [CONFIG.bands.logoCol] : []));
      const idH = col(bh, CONFIG.bands.maIdCol), id = idH && clean(b[idH]);
      if (id && /^\d+$/.test(id)) info += `<p><a href="https://www.metal-archives.com/bands/_/${id}" target="_blank" rel="noopener">Metal Archives ↗</a></p>`;
    } else info += "<p>Groupe absent de la table des groupes.</p>";
    let html = `<h2>${esc(name)}</h2><div class="band-top"><div class="band-info">${info}</div>${logoHtml}</div>`;
    html += `<h3>Clips (${clips.length})</h3><ul class="clip-list">` +
      clips.map((r, i) => `<li><span>${esc(clean(r[col(ch, c.titleCol)]))}</span><span style="color:var(--muted)">${esc(clean(r[col(ch, "VIDEO'S TYPE")] || ""))}</span>${hasUrl(r) ? `<button class="play" data-i="${i}">▶</button>` : searchLink(r)}</li>`).join("") + "</ul>";
    openModal(html);
    document.querySelectorAll(".clip-list .play").forEach((btn) => btn.onclick = () => openClip(clips[+btn.dataset.i]));
  }

  // petit "API" partagé avec views.js (accueil, carte, jeux)
  window.APP = { state, clean, esc, col, norm, sortNum, hasUrl, searchLink, bandName, openClip, openBand, gotoBands, switchTab };

  init();
})();
