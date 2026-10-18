#!/usr/bin/env python3
"""
Met à jour data/ma_cache.json avec les infos de Metal Archives.

Principe
--------
1. Lit ta feuille « groupes » (CSV publié sur Google Sheets, adresse dans config.js).
2. Garde les lignes qui ont un ID Metal Archives (colonne « ID metal-archives »).
3. Pour chaque ID qui n'est pas encore dans le cache, interroge Metal Archives avec la
   bibliothèque enmet et enregistre : pays, ville, année de formation, genre, thèmes,
   statut, label, logo.
4. Le site utilise ensuite ces infos EN PRIORITÉ ; si un groupe n'a pas d'ID (ou n'est pas
   trouvé), il garde les valeurs de ta feuille.

Usage
-----
    pip install enmet==0.9.1
    python tools/update_ma_cache.py                 # nouveaux groupes seulement
    python tools/update_ma_cache.py --dry-run       # montre ce qui serait demandé, sans rien envoyer
    python tools/update_ma_cache.py --limit 0       # sans limite (premier remplissage)
    python tools/update_ma_cache.py --only 521,150  # forcer quelques IDs
    python tools/update_ma_cache.py --csv "data/Stream_Metal_Setlist - band.csv"   # fichier local

Le script est poli avec Metal Archives : une requête environ par seconde, et il s'arrête
tout seul si le site commence à refuser les demandes.
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
CACHE_FILE = ROOT / "data" / "ma_cache.json"
LOCAL_FALLBACK = ROOT / "data" / "Stream_Metal_Setlist - band.csv"
ID_COLUMN = "ID metal-archives"
MAX_CONSECUTIVE_FAILURES = 5
EXIT_BLOCKED = 3

TIME_TAG = re.compile(r"\((?:early|late|later|mid|present|current|formerly|originally)[^)]*\)", re.I)


# ---------------------------------------------------------------- utilitaires
def today():
    return dt.date.today().isoformat()


def squash(text):
    """Espaces normalisés ; 'N/A' devient vide."""
    t = re.sub(r"\s+", " ", (text or "").replace("\xa0", " ")).strip()
    return "" if t.upper() in {"N/A", "?"} else t


def latest_genre(raw):
    """
    « Progressive/Death/Doom Metal (early); Melodic Heavy Metal/Rock (later) »
        -> « Melodic Heavy Metal/Rock » (le style le plus récent, sans les mentions entre parenthèses).
    Sans mention d'époque (« Thrash Metal, Groove Metal »), le texte est gardé tel quel.
    """
    raw = squash(raw)
    if not raw or not TIME_TAG.search(raw):
        return raw.replace(";", ",") if raw else ""
    segments = [s.strip() for s in re.split(r"(?<=\))\s*[,;]\s*|;\s*", raw) if s.strip()]
    chosen = segments[-1] if segments else raw
    return squash(re.sub(r"\s*\([^)]*\)", "", chosen))


def read_text(source):
    if re.match(r"https?://", source):
        req = urllib.request.Request(source, headers={"User-Agent": "Mozilla/5.0 (metal-clips cache updater)"})
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read().decode("utf-8-sig")
    return Path(source).read_text(encoding="utf-8-sig")


def find_csv_source(arg):
    if arg:
        return arg
    if CONFIG_JS.exists():
        m = re.search(r'bands:\s*\{.*?file:\s*"([^"]+)"', CONFIG_JS.read_text(encoding="utf-8"), re.S)
        if m:
            return m.group(1)
    return str(LOCAL_FALLBACK)


def read_ids(source):
    """Renvoie [(id, nom), …] pour les lignes qui ont un ID numérique."""
    try:
        text = read_text(source)
    except Exception as e:  # noqa: BLE001
        print(f"Impossible de lire la feuille ({e}).", file=sys.stderr)
        if LOCAL_FALLBACK.exists() and str(LOCAL_FALLBACK) != source:
            print(f"-> utilisation du fichier local {LOCAL_FALLBACK.name}", file=sys.stderr)
            text = read_text(str(LOCAL_FALLBACK))
        else:
            raise
    rows = list(csv.DictReader(io.StringIO(text)))
    if not rows:
        raise SystemExit("La feuille est vide : rien à faire.")
    headers = {h.strip().lower(): h for h in rows[0].keys() if h}
    id_h = headers.get(ID_COLUMN.lower())
    name_h = headers.get("band")
    if not id_h:
        raise SystemExit(f"Colonne « {ID_COLUMN} » introuvable dans la feuille. Colonnes : {list(rows[0].keys())}")
    seen, out = set(), []
    for r in rows:
        i = re.sub(r"\s", "", (r.get(id_h) or ""))
        if i.isdigit() and i not in seen:
            seen.add(i)
            out.append((i, (r.get(name_h) or "").strip() if name_h else ""))
    return out


def load_cache():
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            print("ma_cache.json illisible : il est ignoré (sauvegarde .bak créée).", file=sys.stderr)
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


# ---------------------------------------------------------------- Metal Archives
def fetch_band(band_id):
    """Interroge Metal Archives (enmet) et renvoie un dict prêt à être mis en cache."""
    from enmet import Band  # import tardif : --dry-run fonctionne sans enmet

    page = Band(band_id)._band_page
    name = page.name  # première lecture : déclenche la requête (404, blocage… remontent ici)

    def raw(label):
        try:
            el = page._get_header_item(label)
            return squash(el.text) if el is not None else ""
        except Exception:  # noqa: BLE001  champ absent sur la fiche
            return ""

    try:
        logo = page.logo_image_link
    except Exception:  # noqa: BLE001
        logo = ""
    if not isinstance(logo, str) or not logo:
        logo = ""
    elif logo.startswith("//"):
        logo = "https:" + logo
    elif logo.startswith("/"):
        logo = "https://www.metal-archives.com" + logo

    genre_full = raw("Genre:")
    formed = re.search(r"\d{4}", raw("Formed in:"))
    record = {
        "name": squash(name),
        "country": raw("Country of origin:"),
        "location": raw("Location:"),
        "formed_in": formed.group(0) if formed else "",
        "genre": latest_genre(genre_full),
        "genre_full": genre_full,
        "themes": raw("Themes:"),
        "status": raw("Status:"),
        "years_active": raw("Years active:"),
        "label": raw("Current label:") or raw("Last label:"),
        "logo": logo,
        "checked": today(),
    }
    return {k: v for k, v in record.items() if v != ""} | {"checked": today()}


def classify(exc):
    """'not_found' : le groupe n'existe pas (404) ; 'failure' : refus/blocage/panne (on réessaiera)."""
    resp = getattr(exc, "response", None)
    if resp is not None and getattr(resp, "status_code", None) == 404:
        return "not_found"
    return "failure"


# ---------------------------------------------------------------- programme principal
def main():
    ap = argparse.ArgumentParser(description="Met à jour data/ma_cache.json depuis Metal Archives (enmet).")
    ap.add_argument("--csv", help="adresse ou fichier de la feuille des groupes (par défaut : celle de config.js)")
    ap.add_argument("--limit", type=int, default=1500, help="nombre maximum de groupes interrogés (0 = sans limite)")
    ap.add_argument("--only", help="IDs à forcer, séparés par des virgules")
    ap.add_argument("--refresh-days", type=int, default=180, help="réinterroge les fiches plus vieilles que N jours (0 = jamais)")
    ap.add_argument("--retry-days", type=int, default=30, help="réessaie les groupes introuvables après N jours")
    ap.add_argument("--delay", type=float, default=0.7, help="pause supplémentaire (secondes) entre deux groupes")
    ap.add_argument("--dry-run", action="store_true", help="n'interroge rien, affiche seulement la liste")
    args = ap.parse_args()

    source = find_csv_source(args.csv)
    print(f"Feuille des groupes : {source[:90]}{'…' if len(source) > 90 else ''}")
    entries = read_ids(source)
    names = dict(entries)
    print(f"{len(entries)} groupes avec un ID Metal Archives.")

    cache = load_cache()
    if args.only:
        todo = [i.strip() for i in args.only.split(",") if i.strip()]
    else:
        todo = []
        for i, _ in entries:
            rec = cache.get(i)
            if rec is None:
                todo.append(i)
            elif rec.get("error"):
                if days_since(rec.get("checked")) >= args.retry_days:
                    todo.append(i)
            elif args.refresh_days and days_since(rec.get("checked")) >= args.refresh_days:
                todo.append(i)
        # d'abord les groupes jamais interrogés
        todo.sort(key=lambda i: i in cache)
    if args.limit and len(todo) > args.limit:
        print(f"{len(todo)} à interroger ; limité à {args.limit} pour cette fois (le reste suivra au prochain passage).")
        todo = todo[: args.limit]
    else:
        print(f"{len(todo)} à interroger.")

    if args.dry_run:
        for i in todo[:50]:
            print(f"  {i}  {names.get(i, '')}")
        if len(todo) > 50:
            print(f"  … et {len(todo) - 50} autres")
        return 0
    if not todo:
        print("Rien à faire : le cache est à jour.")
        return 0

    try:
        import enmet  # noqa: F401
    except ImportError:
        print("La bibliothèque enmet manque :  pip install enmet==0.9.1", file=sys.stderr)
        return 1

    ok = missing = failed = streak = 0
    try:
        for n, band_id in enumerate(todo, 1):
            label = f"[{n}/{len(todo)}] {band_id} {names.get(band_id, '')}".strip()
            try:
                cache[band_id] = fetch_band(band_id)
                ok += 1
                streak = 0
                print(f"{label} -> {cache[band_id].get('country', '?')}")
            except Exception as e:  # noqa: BLE001
                if classify(e) == "not_found":
                    cache[band_id] = {"error": "not_found", "checked": today()}
                    missing += 1
                    streak = 0
                    print(f"{label} -> introuvable sur Metal Archives (404)")
                else:
                    failed += 1
                    streak += 1
                    print(f"{label} -> ÉCHEC : {type(e).__name__}: {str(e)[:120]}", file=sys.stderr)
                    if streak >= MAX_CONSECUTIVE_FAILURES:
                        print(f"\n{streak} échecs d'affilée : Metal Archives refuse peut-être les demandes "
                              "(protection anti-robots ou limite atteinte). Arrêt pour ne pas insister.", file=sys.stderr)
                        return EXIT_BLOCKED
            if n % 25 == 0:
                save_cache(cache)
            time.sleep(max(0.0, args.delay))
    finally:
        save_cache(cache)
        print(f"\nTerminé : {ok} mis à jour, {missing} introuvables, {failed} en échec. Cache : {len(cache)} groupes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
