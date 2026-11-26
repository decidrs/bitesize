"""PR check: the credential scan over the lines a pull request adds.

    python3 scan_diff.py <scanner dir> <pr.diff>

Uses scan() from credential_scan.py (decidrs/ops-pb scripts/lib/credential_scan.py; other repos carry a pinned copy) on the added
lines of the diff only (a removed secret is not a new leak). Prints counts and line numbers within the added text, never the matched
text. Exit 0 clean, 1 credential-shaped strings found, 2 could not run.
"""
import os
import sys

if len(sys.argv) != 3:
    print("usage: scan_diff.py <scanner dir> <pr.diff>")
    sys.exit(2)
sys.path.insert(0, sys.argv[1])
try:
    from credential_scan import scan
except Exception as e:  # noqa: BLE001
    print(f"credential scan could not load: {type(e).__name__}")
    sys.exit(2)
diff = open(sys.argv[2], encoding="utf-8", errors="replace").read()
added = "\n".join(l[1:] for l in diff.splitlines() if l.startswith("+") and not l.startswith("+++"))
hits, exemptions = scan(added)
print(f"credential scan: {len(added.splitlines())} added lines, {len(hits)} hit(s), {len(exemptions)} recorded exemption(s)")
for line, what in sorted(set(hits)):
    print(f"  hit near added line {line}: {what}")
sys.exit(1 if hits else 0)
