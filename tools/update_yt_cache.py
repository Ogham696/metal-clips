#!/usr/bin/env python3
"""
Met à jour data/yt_cache.json avec la date de publication et la durée des vidéos YouTube.

Principe
--------
1. Lit ta feuille « clips » (CSV publié sur Google Sheets, adresse dans config.js).
2. Pour chaque clip dont l'URL est une vidéo YouTube ET dont la colonne DATE ou DURATION est vide
   (ou #N/A), demande la date et la durée à YouTube avec yt-dlp.
3. Le site complète ensuite DATE et DURATION avec ces valeurs, uniquement quand la feuille n'en
   donne pas : tes valeurs à toi restent prioritaires.

Usage
-----
    pip install yt-dlp
    python tools/update_yt_cache.py                 # seulement les vidéos qui manquent
    python tools/update_yt_cache.py --dry-run       # montre la liste, sans rien demander
    python tools/update_yt_cache.py --all           # même si DATE et DURATION sont déjà remplies
    python tools/update_yt_cache.py --limit 100     # au plus 100 vidéos pour cette fois
    python tools/update_yt_cache.py --csv "data/Stream_Metal_Setlist - clips.csv"   # fichier local
"""
import argparse
import csv
import datetime as dt
import io
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG_JS = ROOT / "config.js"
CACHE_FILE = ROOT / "data" / "yt_cache.json"
LOCAL_CLIPS = ROOT / "data" / "Stream_Metal_Setlist - clips.csv"
URL_COLUMN = "CLIP'S URL"
DATE_COLUMN = "DATE"
DURATION_COLUMN = "DURATION"
BAND_COLUMN = "BAND"
SONG_COLUMN = "SONG"
MAX_CONSECUTIVE_FAILURES = 5
EXIT_BLOCKED = 3

NA = {"", "#N/A", "N/A", "#REF!", "#VALUE!", "NULL", "UNDEFINED"}
VIDEO_ID = re.compile(
    r"(?:youtu\.be/|youtube(?:-nocookie)?\.com/(?:watch\?(?:[^#]*&)?v=|shorts/|embed/|live/|v/))([A-Za-z0-9_-]{11})")
# erreurs qui veulent dire « cette vidéo-là n'est pas lisible » (et non « YouTube nous bloque »)
UNAVAILABLE = ("video unavailable", "private video", "has been removed", "this video is not available",
               "account associated with this video has been terminated", "copyright", "members-only",
               "who has blocked it", "no longer available", "does not exist", "age-restricted")


def today():
    return dt.date.today().isoformat()


def video_id(url):
    m = VIDEO_ID.search(url or "")
    return m.group(1) if m else ""


def is_empty(v):
    return (v or "").strip().upper() in NA


def read_text(source):
    if re.match(r"https?://", source):
        req = urllib.request.Request(source, headers={"User-Agent": "Mozilla/5.0 (metal-clips cache updater)"})
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read().decode("utf-8-sig")
    return Path(source).read_text(encoding="utf-8-sig")


def find_source(arg):
    if arg:
        return arg, None
    if CONFIG_JS.exists():
        m = re.search(r'clips:\s*\{.*?file:\s*"([^"]+)"', CONFIG_JS.read_text(encoding="utf-8"), re.S)
        if m:
            return m.group(1), str(LOCAL_CLIPS)
    return str(LOCAL_CLIPS), None


def read_videos(source, fallback, want_all):
    """Renvoie [(video_id, « GROUPE - TITRE »), …] pour les clips YouTube à compléter."""
    try:
        text = read_text(source)
    except Exception as e:  # noqa: BLE001
        print(f"Impossible de lire la feuille ({e}).", file=sys.stderr)
        if fallback and Path(fallback).exists():
            print(f"-> utilisation du fichier local {Path(fallback).name}", file=sys.stderr)
            text = read_text(fallback)
        else:
            raise
    rows = list(csv.DictReader(io.StringIO(text)))
    if not rows:
        raise SystemExit("La feuille est vide : rien à faire.")
    h = {re.sub(r"\s+", " ", (k or "").strip().lower()): k for k in rows[0].keys() if k}
    url_h = h.get(URL_COLUMN.lower())
    if not url_h:
        raise SystemExit(f"Colonne « {URL_COLUMN} » introuvable. Colonnes : {list(rows[0].keys())}")
    date_h, dur_h = h.get(DATE_COLUMN.lower()), h.get(DURATION_COLUMN.lower())
    band_h, song_h = h.get(BAND_COLUMN.lower()), h.get(SONG_COLUMN.lower())
    seen, out = set(), []
    for r in rows:
        vid = video_id(r.get(url_h))
        if not vid or vid in seen:
            continue
        missing = (not date_h or is_empty(r.get(date_h))) or (not dur_h or is_empty(r.get(dur_h)))
        if want_all or missing:
            seen.add(vid)
            label = " - ".join(x for x in ((r.get(band_h) or "").strip() if band_h else "",
                                           (r.get(song_h) or "").strip() if song_h else "") if x)
            out.append((vid, label))
    return out


def load_cache():
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            print("yt_cache.json illisible : il est ignoré (sauvegarde .bak créée).", file=sys.stderr)
            CACHE_FILE.replace(CACHE_FILE.with_suffix(".json.bak"))
    return {}


def save_cache(cache):
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = CACHE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(cache, ensure_ascii=False, sort_keys=True, separators=(",", ":")), encoding="utf-8")
    tmp.replace(CACHE_FILE)


def days_since(iso):
    try:
        return (dt.date.today() - dt.date.fromisoformat(iso)).days
    except (TypeError, ValueError):
        return 10 ** 6


class Unavailable(Exception):
    """La vidéo existe dans la feuille mais n'est pas lisible (privée, supprimée…)."""


def fetch_video(ydl, vid):
    """Interroge YouTube (yt-dlp) et renvoie {date: 'AAAA-MM-JJ', duration: secondes, checked}."""
    try:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={vid}", download=False)
    except Exception as e:  # noqa: BLE001
        msg = str(e).lower()
        if any(k in msg for k in UNAVAILABLE) and "not a bot" not in msg:
            raise Unavailable(str(e)) from e
        raise
    d = str(info.get("upload_date") or info.get("release_date") or "")
    rec = {"checked": today()}
    if re.fullmatch(r"\d{8}", d):
        rec["date"] = f"{d[:4]}-{d[4:6]}-{d[6:]}"
    if isinstance(info.get("duration"), (int, float)) and info["duration"] > 0:
        rec["duration"] = int(info["duration"])
    if "date" not in rec and "duration" not in rec:
        raise RuntimeError("réponse vide de YouTube")
    return rec


def main():
    ap = argparse.ArgumentParser(description="Met à jour data/yt_cache.json (date et durée des vidéos YouTube).")
    ap.add_argument("--csv", help="adresse ou fichier de la feuille des clips (par défaut : celle de config.js)")
    ap.add_argument("--limit", type=int, default=1500, help="nombre maximum de vidéos interrogées (0 = sans limite)")
    ap.add_argument("--all", action="store_true", help="aussi les clips dont DATE et DURATION sont déjà remplies")
    ap.add_argument("--retry-days", type=int, default=30, help="réessaie les vidéos indisponibles après N jours")
    ap.add_argument("--delay", type=float, default=1.0, help="pause (secondes) entre deux vidéos")
    ap.add_argument("--dry-run", action="store_true", help="n'interroge rien, affiche seulement la liste")
    args = ap.parse_args()

    source, fallback = find_source(args.csv)
    print(f"Lecture : {source[:90]}{'…' if len(source) > 90 else ''}")
    videos = read_videos(source, fallback, args.all)
    names = dict(videos)
    print(f"{len(videos)} vidéos YouTube à compléter (DATE ou DURATION vide).")

    cache = load_cache()
    todo = []
    for vid, _ in videos:
        rec = cache.get(vid)
        if rec is None or (rec.get("error") and days_since(rec.get("checked")) >= args.retry_days):
            todo.append(vid)
    print(f"{len(videos) - len(todo)} déjà dans le cache, {len(todo)} à interroger.")
    if args.limit and len(todo) > args.limit:
        print(f"Limité à {args.limit} pour cette fois (le reste suivra au prochain passage).")
        todo = todo[: args.limit]

    if args.dry_run:
        for v in todo[:50]:
            print(f"  {v}  {names.get(v, '')}")
        if len(todo) > 50:
            print(f"  … et {len(todo) - 50} autres")
        return 0
    if not todo:
        print("Rien à faire : le cache est à jour.")
        return 0

    try:
        import yt_dlp
    except ImportError:
        print("La bibliothèque yt-dlp manque :  pip install yt-dlp", file=sys.stderr)
        return 1

    opts = {"quiet": True, "no_warnings": True, "skip_download": True, "noplaylist": True,
            "socket_timeout": 30, "extract_flat": False, "ignoreerrors": False}
    ok = unavailable = failed = streak = 0
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            for n, vid in enumerate(todo, 1):
                label = f"[{n}/{len(todo)}] {vid} {names.get(vid, '')}".strip()
                try:
                    cache[vid] = fetch_video(ydl, vid)
                    ok += 1
                    streak = 0
                    r = cache[vid]
                    print(f"{label} -> {r.get('date', '?')}  {r.get('duration', '?')} s")
                except Unavailable:
                    cache[vid] = {"error": "unavailable", "checked": today()}
                    unavailable += 1
                    streak = 0
                    print(f"{label} -> vidéo indisponible (privée, supprimée…)")
                except Exception as e:  # noqa: BLE001
                    failed += 1
                    streak += 1
                    print(f"{label} -> ÉCHEC : {type(e).__name__}: {str(e)[:140]}", file=sys.stderr)
                    if streak >= MAX_CONSECUTIVE_FAILURES:
                        print(f"\n{streak} échecs d'affilée : YouTube refuse peut-être les demandes "
                              "(vérification anti-robot ou limite atteinte). Arrêt pour ne pas insister.", file=sys.stderr)
                        return EXIT_BLOCKED
                if n % 25 == 0:
                    save_cache(cache)
                time.sleep(max(0.0, args.delay))
    finally:
        save_cache(cache)
        print(f"\nTerminé : {ok} complétées, {unavailable} indisponibles, {failed} en échec. Cache : {len(cache)} vidéos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
