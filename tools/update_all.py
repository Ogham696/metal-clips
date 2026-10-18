#!/usr/bin/env python3
"""Lance les deux mises à jour d'un coup : Metal Archives puis YouTube.
    python tools/update_all.py
Les options éventuelles (ex. --limit 50) sont transmises aux deux scripts."""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
worst = 0
for script in ("update_ma_cache.py", "update_yt_cache.py"):
    print(f"\n===== {script} =====", flush=True)
    code = subprocess.call([sys.executable, str(HERE / script), *sys.argv[1:]])
    worst = max(worst, code)
print("\nTerminé. Envoie data/ma_cache.json et data/yt_cache.json sur GitHub.")
sys.exit(worst)
