#!/usr/bin/env python3
"""Lance les mises à jour d'un coup : Metal Archives, puis YouTube, puis (option) envoi sur GitHub.

    python tools/update_all.py            # met à jour les deux caches
    python tools/update_all.py --push     # ... puis les envoie sur GitHub (commit + push)

Les autres options (ex. --limit 50) sont transmises aux deux scripts.
--push demande que le dossier soit un dépôt Git (cloné avec GitHub Desktop, par exemple).
"""
import glob
import os
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
FILES = ["data/ma_cache.json", "data/yt_cache.json"]


def find_git():
    """git du PATH, sinon celui livré avec GitHub Desktop (Windows)."""
    g = shutil.which("git")
    if g:
        return g
    base = os.environ.get("LOCALAPPDATA", "")
    for pattern in (rf"{base}\GitHubDesktop\app-*\resources\app\git\cmd\git.exe",
                    r"C:\Program Files\Git\cmd\git.exe", r"C:\Program Files (x86)\Git\cmd\git.exe"):
        found = sorted(glob.glob(pattern))
        if found:
            return found[-1]
    return None


def git(g, *args, check=True):
    r = subprocess.run([g, "-C", str(ROOT), *args], capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} : {(r.stderr or r.stdout).strip()}")
    return r


def push():
    print("\n===== Envoi sur GitHub =====", flush=True)
    g = find_git()
    if not g:
        print("Git est introuvable. Installe Git (git-scm.com) ou envoie les deux fichiers avec GitHub Desktop.", file=sys.stderr)
        return 1
    try:
        if git(g, "rev-parse", "--is-inside-work-tree", check=False).stdout.strip() != "true":
            print("Ce dossier n'est pas un dépôt Git. Clone ton dépôt avec GitHub Desktop et lance le script depuis ce dossier.", file=sys.stderr)
            return 1
        existing = [f for f in FILES if (ROOT / f).exists()]
        git(g, "add", *existing)
        if git(g, "diff", "--cached", "--quiet", check=False).returncode == 0:
            print("Rien de nouveau à envoyer.")
            return 0
        git(g, "commit", "-m", "Mise à jour des caches Metal Archives / YouTube", "--", *existing)
        pull = git(g, "pull", "--rebase", "--autostash", check=False)
        if pull.returncode != 0:
            print("git pull a échoué (envoi tenté quand même) :", (pull.stderr or pull.stdout).strip(), file=sys.stderr)
        git(g, "push")
        print("Envoyé : le site se met à jour dans une ou deux minutes.")
        return 0
    except RuntimeError as e:
        print(f"Échec de l'envoi : {e}", file=sys.stderr)
        print("Tu peux envoyer les fichiers à la main avec GitHub Desktop (Commit puis Push origin).", file=sys.stderr)
        return 1


# options propres à un seul script : (nom, prend une valeur ?)
ONLY_MA = {"--only": True, "--refresh-days": True}
ONLY_YT = {"--all": False, "--browser": True}


def split_args(args, exclude):
    """Renvoie les options sans celles qui appartiennent à l'autre script."""
    out, i = [], 0
    while i < len(args):
        a = args[i]
        if a in exclude:
            i += 2 if exclude[a] else 1
            continue
        out.append(a)
        i += 1
    return out


def main():
    args = [a for a in sys.argv[1:] if a != "--push"]
    do_push = "--push" in sys.argv[1:]
    worst = 0
    for script, exclude in (("update_ma_cache.py", ONLY_YT), ("update_yt_cache.py", ONLY_MA)):
        print(f"\n===== {script} =====", flush=True)
        worst = max(worst, subprocess.call([sys.executable, str(HERE / script), *split_args(args, exclude)]))
    if do_push:
        worst = max(worst, push())
    else:
        print("\nTerminé. Envoie data/ma_cache.json et data/yt_cache.json sur GitHub (ou relance avec --push).")
    return worst


if __name__ == "__main__":
    sys.exit(main())
