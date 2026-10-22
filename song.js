// ============================================================
//  Jeu « Quel morceau ? » : on écoute un extrait de clip (YouTube) puis on tape le nom du groupe
//  (et, en bonus, le titre). Réponses libres avec tolérance aux fautes de frappe, indices payants.
//  Étend GAMES (views.js) ; réglages dans config.js (clé `song`).
// ============================================================
(() => {
  const G = window.VIEWS && window.VIEWS.games;
  if (!G) return;
  const $ = (s) => document.querySelector(s);
  const A = () => window.APP;
  const S = Object.assign({ extractSeconds: 20, bandPoints: 100, hintCost: 20, wrongCost: 10, minBand: 20, titleBonus: 30, tries: 3 },
    (typeof CONFIG !== "undefined" && CONFIG.song) || {});

  // ---------- comparaison tolérante des réponses tapées ----------
  // Ignore : majuscules, accents, apostrophes, ponctuation, « the » au début, mentions (feat…), mots collés/séparés,
  // lettres doublées oubliées ou ajoutées, fautes de frappe (nombre de fautes admis selon la longueur du nom).
  function textKey(s, isTitle) {
    let t = String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (isTitle) {
      const cut = t.replace(/[(\[][^)\]]*[)\]]/g, " ").replace(/\b(?:feat|ft|featuring)\b.*$/, " ");
      if (cut.replace(/[^a-z0-9\p{L}]/gu, "")) t = cut;
    }
    t = t.replace(/&/g, " and ").replace(/['’`´‘]/g, "").replace(/[^\p{L}\p{N}\s]+/gu, " ").replace(/\s+/g, " ").trim();
    return t.replace(/^the\s+/, "");
  }
  // distance d'édition avec permutation de deux lettres voisines (« teh » -> « the » = 1 faute)
  function distance(a, b) {
    const n = a.length, m = b.length;
    if (!n) return m; if (!m) return n;
    let prev2 = null, prev = Array.from({ length: m + 1 }, (_, j) => j);
    for (let i = 1; i <= n; i++) {
      const cur = [i];
      for (let j = 1; j <= m; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v;
      }
      prev2 = prev; prev = cur;
    }
    return prev[m];
  }
  const allowed = (len) => (len <= 4 ? 0 : len <= 8 ? 1 : len <= 14 ? 2 : 3);
  const variants = (answer, isTitle) => {
    const v = [answer];
    if (isTitle) v.push(String(answer).replace(/[()\[\]]/g, " "));   // « Nymphetamine (Fix) » accepté aussi avec « fix »
    for (const part of String(answer).split(isTitle ? /\s+[-–—]\s+|\s*\/\s*/ : /\s*[\/|]\s*/)) if (part.trim().length > 2) v.push(part);
    return v;
  };
  function fuzzyMatch(guess, answer, isTitle) {
    const g = textKey(guess, isTitle);
    if (!g) return false;
    for (const alt of variants(answer, isTitle)) {
      const a = textKey(alt, isTitle);
      if (!a) continue;
      if (g === a) return true;
      const gc = g.replace(/\s/g, ""), ac = a.replace(/\s/g, "");
      if (gc === ac) return true;
      if (gc.replace(/(.)\1+/g, "$1") === ac.replace(/(.)\1+/g, "$1")) return true;   // lettre doublée oubliée / ajoutée
      if (distance(gc, ac) <= allowed(ac.length)) return true;
    }
    return false;
  }
  window.__fuzzyMatch = fuzzyMatch;

  // ---------- YouTube (API iframe) ----------
  const YT_ID = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/|v\/))([A-Za-z0-9_-]{11})/;
  let apiPromise = null;
  function loadYT() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (!apiPromise) apiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.onerror = () => { apiPromise = null; reject(new Error("YouTube est inaccessible")); };
      document.head.appendChild(s);
      setTimeout(() => { apiPromise = null; reject(new Error("YouTube ne répond pas")); }, 15000);
    });
    return apiPromise;
  }
  const toSeconds = (v) => {
    const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(String(v || "").trim());
    return m ? (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) : 0;
  };

  Object.assign(G, {
    song: null,       // état de la manche en cours
    songPool: [], songDeck: [], player: null, songTimer: null,

    // ----- entrée / sortie du mode -----
    startSong() {
      this.stopTimers(); this.leaveSong(true);
      this._timedBackup = this.timed; this.timed = false;
      this.mode = "song"; this.finished = false;
      document.querySelectorAll("#game-modes [data-game]").forEach((b) => b.classList.toggle("active", b.dataset.game === "song"));
      const tt = $("#game-modes [data-timer]"); if (tt) tt.style.display = "none";
      const { state, clean, col } = A();
      const ch = state.data.clips.headers, uH = col(ch, CONFIG.clips.urlCol), bH = col(ch, CONFIG.clips.bandCol), sH = col(ch, CONFIG.clips.titleCol);
      const dH = col(ch, CONFIG.ytDurationCol || "DURATION");
      const seen = new Set();
      this.songPool = [];
      for (const r of state.data.clips.rows) {
        const m = YT_ID.exec(clean(r[uH])); if (!m || seen.has(m[1]) || !clean(r[bH])) continue;
        seen.add(m[1]);
        this.songPool.push({ row: r, vid: m[1], band: clean(r[bH]), title: sH ? clean(r[sH]) : "", dur: dH ? toSeconds(clean(r[dH])) : 0 });
      }
      this.songDeck = []; this.total = 0; this.rounds = 0; this.found = 0;
      $("#game-box").innerHTML = `<div class="game-score" id="game-score"></div><div class="yt-holder" id="yt-holder"><div id="yt-player"></div>` +
        `<div class="yt-cover" id="yt-cover"><span>🎧</span><small>Écoute l'extrait…</small></div></div><div id="song-body"></div>`;
      this.player = null;
      if (this.songPool.length < 1) { $("#song-body").innerHTML = `<p class="muted">Aucun clip YouTube dans la feuille pour jouer.</p>`; return; }
      this.nextSong();
    },

    // quitte le mode : coupe le son et détruit le lecteur
    leaveSong(silent) {
      clearTimeout(this.songTimer); this.songTimer = null;
      if (this.player && this.player.destroy) { try { this.player.destroy(); } catch (e) { /* lecteur déjà détruit */ } }
      this.player = null;
      if (silent) return;
      const tt = $("#game-modes [data-timer]"); if (tt) tt.style.display = "";
      if (this._timedBackup !== undefined) { this.timed = this._timedBackup; this._timedBackup = undefined; }
    },

    hide() {   // appelé par app.js quand on change de page : on coupe le son
      clearTimeout(this.songTimer);
      if (this.mode === "song" && this.player && this.player.pauseVideo) { try { this.player.pauseVideo(); } catch (e) { /* sans importance */ } }
    },

    songScoreLine() {
      return `Points : <b>${this.total}</b> &nbsp;·&nbsp; Groupes trouvés : <b>${this.found}</b> / ${this.rounds}`;
    },

    // ----- une manche -----
    nextSong() {
      if (!this.songPool.length) { $("#song-body").innerHTML = `<p class="muted">Plus aucun clip lisible.</p>`; return; }
      if (!this.songDeck.length) this.songDeck = this.songPool.slice().sort(() => Math.random() - 0.5);
      const clip = this.songDeck.pop();
      const dur = clip.dur || 0;
      let start;
      if (dur > S.extractSeconds + 15) start = Math.floor(dur * 0.15 + Math.random() * Math.max(1, dur * 0.7 - S.extractSeconds));
      else start = dur > 30 ? 10 : 0;
      if (dur) start = Math.min(start, Math.max(0, dur - S.extractSeconds - 5));
      this.song = { clip, start, hints: [], wrong: 0, bandOK: false, titleOK: false, done: false, listened: false };
      this.answered = false; this.cur = clip;
      $("#yt-cover").classList.remove("off");
      if (this.player && this.player.pauseVideo) { try { this.player.pauseVideo(); } catch (e) { /* sans importance */ } }
      this.renderSong();
    },

    info() {   // indices disponibles pour ce groupe (fiche du groupe, sinon colonnes du clip)
      const { state, clean, col } = A(), clip = this.song.clip, band = clip.row.__k && state.bandIndex.get(clip.row.__k);
      const bh = state.data.bands.headers, ch = state.data.clips.headers;
      const fromBand = (name) => (band && name && col(bh, name) ? clean(band[col(bh, name)]) : "");
      const fromClip = (name) => (name && col(ch, name) ? clean(clip.row[col(ch, name)]) : "");
      return {
        style: fromBand(CONFIG.bands.genreCol) || fromClip("STYLE FROM SOURCES"),
        formed: fromBand("Formed in"),
        country: fromBand(CONFIG.bands.countryCol) || fromClip("COUNTRY"),
        themes: fromBand("Themes"),
      };
    },

    renderSong() {
      const { esc } = A(), s = this.song, info = this.info();
      const defs = [["style", "🎼 Style musical"], ["formed", "📅 Année de formation"], ["country", "🌍 Pays d'origine"], ["themes", "🧩 Thèmes"]];
      this.hintInfo = info;
      $("#game-score").innerHTML = this.songScoreLine();
      $("#song-body").innerHTML =
        `<div class="song-actions"><button class="play" id="song-listen">▶ Écouter l'extrait</button>` +
        `<span class="muted small" id="song-status">Extrait d'environ ${S.extractSeconds} secondes, tu peux le réécouter.</span></div>` +
        `<div class="song-hints"><span class="muted small">Indices (−${S.hintCost} pts sur le groupe chacun) :</span>` +
        defs.map(([k, label]) => `<button type="button" class="ghost hint-btn" data-hint="${k}"${info[k] ? "" : " disabled"}>${label}${info[k] ? "" : " (inconnu)"}</button>`).join("") +
        `</div><div class="hint-out" id="hint-out"></div>` +
        `<form id="song-form" autocomplete="off">` +
        `<label class="song-field">Nom du groupe<input id="song-band" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Qui joue ?"></label>` +
        `<label class="song-field">Titre de la chanson <span class="muted small">(bonus +${S.titleBonus})</span><input id="song-title" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Facultatif"></label>` +
        `<div class="song-row"><button class="play" type="submit">Valider</button><button type="button" class="ghost" id="song-skip">Je passe</button>` +
        `<span class="muted small" id="song-potential"></span></div><div class="song-msg" id="song-msg"></div></form><div id="song-end"></div>`;
      this.updatePotential();
      $("#song-listen").onclick = () => this.listen();
      $("#song-form").onsubmit = (e) => { e.preventDefault(); this.submitSong(); };
      $("#song-skip").onclick = () => this.finishSong();
      $("#song-body").querySelectorAll("[data-hint]").forEach((b) => (b.onclick = () => this.takeHint(b)));
      $("#song-band").focus();
      void esc;
    },

    potential() { const s = this.song; return Math.max(S.minBand, S.bandPoints - S.hintCost * s.hints.length - S.wrongCost * s.wrong); },
    updatePotential() {
      const s = this.song; if (!s || s.done) return;
      $("#song-potential").textContent = `Groupe : ${this.potential()} pts possibles · ${S.tries - s.wrong} essai${S.tries - s.wrong > 1 ? "s" : ""}`;
    },

    takeHint(btn) {
      const s = this.song, k = btn.dataset.hint; if (!s || s.done || s.hints.includes(k)) return;
      s.hints.push(k); btn.disabled = true; btn.classList.add("used");
      const labels = { style: "Style", formed: "Formé en", country: "Pays", themes: "Thèmes" };
      const chip = document.createElement("span");
      chip.className = "chip"; chip.innerHTML = `<b>${labels[k]} :</b> `; chip.appendChild(document.createTextNode(this.hintInfo[k]));
      $("#hint-out").appendChild(chip);
      this.updatePotential();
      $("#song-band").focus();
    },

    // ----- lecture de l'extrait -----
    async listen() {
      const s = this.song, btn = $("#song-listen"), status = $("#song-status");
      if (!s) return;
      btn.disabled = true; status.textContent = "Chargement de YouTube…";
      try {
        await loadYT();
        if (!this.player) {
          await new Promise((resolve, reject) => {
            this.player = new YT.Player("yt-player", {
              width: "100%", height: "100%", videoId: s.clip.vid,
              playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, fs: 0, origin: location.origin },
              events: { onReady: () => resolve(), onError: (e) => this.playerError(e), onStateChange: () => {} },
            });
            setTimeout(() => reject(new Error("le lecteur ne démarre pas")), 15000);
          });
        }
      } catch (e) { btn.disabled = false; status.textContent = "Lecture impossible : " + e.message + ". Réessaie."; return; }
      if (this.song !== s) return;
      this.player.loadVideoById({ videoId: s.clip.vid, startSeconds: s.start });
      s.listened = true; btn.disabled = false; btn.textContent = "🔁 Réécouter l'extrait";
      status.textContent = "🔊 Extrait en cours…";
      clearTimeout(this.songTimer);
      this.songTimer = setTimeout(() => {
        try { this.player.pauseVideo(); } catch (e) { /* sans importance */ }
        if (this.song === s && !s.done) status.textContent = "Extrait terminé : tu peux le réécouter.";
      }, S.extractSeconds * 1000);
    },

    playerError() {   // vidéo supprimée, privée ou non intégrable : on l'écarte et on en prend une autre
      const s = this.song; if (!s || s.done) return;
      this.songPool = this.songPool.filter((c) => c !== s.clip); this.songDeck = this.songDeck.filter((c) => c !== s.clip);
      $("#song-status").textContent = "Cette vidéo ne peut pas être lue ici, on en prend une autre…";
      setTimeout(() => { if (this.song === s && !s.done) this.nextSong(); }, 1200);
    },

    // ----- réponses -----
    submitSong() {
      const s = this.song; if (!s || s.done) return;
      const bandIn = $("#song-band").value.trim(), titleIn = $("#song-title").value.trim(), msg = $("#song-msg");
      if (!bandIn && !titleIn) { msg.className = "song-msg"; msg.textContent = "Écris au moins le nom du groupe."; return; }
      if (titleIn && !s.titleOK && s.clip.title && fuzzyMatch(titleIn, s.clip.title, true)) {
        s.titleOK = true; $("#song-title").disabled = true; $("#song-title").classList.add("ok");
      }
      if (!bandIn) { msg.className = "song-msg"; msg.textContent = s.titleOK ? "Le titre est bon ! Et le groupe ?" : "Pas le bon titre. Et le groupe ?"; return; }
      if (fuzzyMatch(bandIn, s.clip.band, false)) { s.bandOK = true; this.finishSong(); return; }
      s.wrong++;
      $("#song-band").classList.add("ko"); setTimeout(() => $("#song-band") && $("#song-band").classList.remove("ko"), 700);
      if (s.wrong >= S.tries) { this.finishSong(); return; }
      msg.className = "song-msg ko";
      msg.textContent = `Ce n'est pas ça (−${S.wrongCost} pts). ${s.titleOK ? "Le titre est bon, en revanche. " : ""}Il te reste ${S.tries - s.wrong} essai${S.tries - s.wrong > 1 ? "s" : ""}.`;
      this.updatePotential();
      $("#song-band").select();
    },

    finishSong() {
      const s = this.song; if (!s || s.done) return;
      s.done = true; this.answered = true; clearTimeout(this.songTimer);
      try { if (this.player) this.player.pauseVideo(); } catch (e) { /* sans importance */ }
      const { esc } = A();
      const bandPts = s.bandOK ? this.potential() : 0, titlePts = s.titleOK ? S.titleBonus : 0, gain = bandPts + titlePts;
      this.total += gain; this.rounds++; if (s.bandOK) this.found++;
      $("#game-score").innerHTML = this.songScoreLine();
      $("#yt-cover").classList.add("off");   // on montre enfin la vidéo
      document.querySelectorAll("#song-form input, #song-form button").forEach((e) => (e.disabled = true));
      document.querySelectorAll(".hint-btn").forEach((e) => (e.disabled = true));
      const parts = [];
      if (s.bandOK) parts.push(`+${bandPts} groupe${s.hints.length ? ` (${s.hints.length} indice${s.hints.length > 1 ? "s" : ""})` : ""}${s.wrong ? `, ${s.wrong} erreur${s.wrong > 1 ? "s" : ""}` : ""}`);
      if (s.titleOK) parts.push(`+${titlePts} titre`);
      const k = s.clip.row.__k;
      $("#song-end").innerHTML =
        `<div class="song-reveal"><div class="verdict ${s.bandOK ? "ok" : "ko"}">${s.bandOK ? "✔ Bien joué !" : "✘ Raté"} <span class="pts">${gain ? "+" + gain + " pts" : "0 pt"}</span></div>` +
        `<div class="song-answer"><b>${esc(s.clip.band)}</b> — ${esc(s.clip.title || "titre inconnu")}</div>` +
        (parts.length ? `<div class="muted small">${esc(parts.join(" · "))}</div>` : "") +
        `<div class="game-foot">` + (k ? `<button class="link-btn" data-band="${esc(k)}">Fiche de ${esc(s.clip.band)} ↗</button>` : "") +
        `<button id="song-next" class="play">Suivant →</button></div></div>`;
      $("#song-next").onclick = () => this.nextSong();
      $("#song-next").focus();
    },
  });

  // branchement sur le sélecteur de jeux de views.js
  const origStart = G.start, origNext = G.next;
  G.start = function (mode) {
    if (mode === "song") return this.startSong();
    this.leaveSong(false);
    return origStart.call(this, mode);
  };
  G.next = function () {
    if (this.mode === "song") { if (this.answered) this.nextSong(); return; }
    return origNext.call(this);
  };
})();
