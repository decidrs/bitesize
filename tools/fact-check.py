#!/usr/bin/env python3
"""
fact-check.py: one-off accuracy check of every card in src/data/cards.json,
by a grader model from a different family than the one that wrote the cards
(launch policy v2, item 4).

Run in Terminal B (plain zsh) from the repo root, on the tailnet:

    python3 -I tools/fact-check.py            # all cards
    python3 -I tools/fact-check.py --dry-run  # no key, no network: prints the plan
    python3 -I tools/fact-check.py --limit 24 # quick trial on the first 24 cards

The grader model comes from ops-pb scripts/reviewer-model (executor family
anthropic), as spot-grade does. Set OPS_PB if ops-pb isn't at ../ops-pb.
GRADER_LLM_KEY is read hidden if it isn't already set. It lives only in this
process and is never written or printed.

Output (git-ignored): .factcheck/results.json with one verdict per card, and
.factcheck/flagged.md listing every card that isn't "ok", for the founder
to rule on. Nothing in the deck is changed.
"""
import argparse, getpass, json, os, subprocess, sys, time, urllib.request, urllib.error
from pathlib import Path

GATEWAY = "https://llm-gw.tail643644.ts.net/v1/chat/completions"
BATCH = 12
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / ".factcheck"

PROMPT = """You are a strict fact-checker for a general-knowledge app. For each card below, judge whether the headline and body are factually accurate as written, for a general audience in 2026.

Verdicts:
- "ok": accurate, or simplified without becoming wrong.
- "doubtful": contested, out of date, depends on a definition, or overstated.
- "wrong": contains a factual error.

For anything not "ok", give the specific issue in one sentence and a reliable source (publisher and title, or URL) that supports your correction. Do not flag style, tone or the "hook" line unless it states a falsehood.

Reply with JSON only, in this shape: {"results": [{"id": "...", "verdict": "ok|doubtful|wrong", "issue": "", "source": ""}]}

Cards:
"""


def grader_model() -> str:
    ops = Path(os.environ.get("OPS_PB", ROOT.parent / "ops-pb"))
    tool = ops / "scripts" / "reviewer-model"
    if not os.access(tool, os.X_OK):
        sys.exit(f"!! ops-pb reviewer-model not found at {tool} (set OPS_PB)")
    return subprocess.run([str(tool), "grader", "--executor-family", "anthropic"],
                          check=True, capture_output=True, text=True).stdout.strip()


def ask(model: str, key: str, cards: list) -> list:
    body = PROMPT + json.dumps([{k: c[k] for k in ("id", "title", "body", "hook")} for c in cards], ensure_ascii=False)
    req = urllib.request.Request(GATEWAY, method="POST", headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                                 data=json.dumps({"model": model, "temperature": 0, "response_format": {"type": "json_object"},
                                                  "messages": [{"role": "user", "content": body}]}).encode())
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = json.load(r)
            out = json.loads(data["choices"][0]["message"]["content"])["results"]
            return out, data.get("usage", {})
        except urllib.error.HTTPError as e:
            print(f"   HTTP {e.code} on attempt {attempt + 1}")
            if e.code in (401, 403):
                sys.exit("!! the gateway refused the key; nothing more is sent")
        except (urllib.error.URLError, TimeoutError, KeyError, ValueError) as e:
            print(f"   {type(e).__name__} on attempt {attempt + 1}")
        time.sleep(5 * (attempt + 1))
    sys.exit("!! three failures in a row; stopping. Results so far are saved.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    cards = json.loads((ROOT / "src" / "data" / "cards.json").read_text(encoding="utf-8"))
    if a.limit:
        cards = cards[: a.limit]
    batches = [cards[i:i + BATCH] for i in range(0, len(cards), BATCH)]
    print(f"{len(cards)} cards in {len(batches)} batches of up to {BATCH}")
    if a.dry_run:
        print("dry run: no key read, no network")
        return
    model = grader_model()
    print("grader model resolved from ops-pb reviewer-model")
    key = os.environ.get("GRADER_LLM_KEY") or getpass.getpass('GRADER_LLM_KEY (LastPass "litellm seat 8x46umvnap7yntl"), hidden: ')
    if not key:
        sys.exit("!! no key entered")
    OUT.mkdir(exist_ok=True)
    results, tokens = {}, 0
    for n, b in enumerate(batches, 1):
        got, usage = ask(model, key, b)
        tokens += usage.get("total_tokens", 0)
        want = {c["id"] for c in b}
        for r in got:
            if r.get("id") in want:
                results[r["id"]] = r
        missing = want - results.keys()
        for m in missing:
            results[m] = {"id": m, "verdict": "unchecked", "issue": "grader returned no verdict", "source": ""}
        print(f"  batch {n}/{len(batches)}: {sum(1 for c in b if results[c['id']]['verdict'] != 'ok')} flagged")
        (OUT / "results.json").write_text(json.dumps({"model_family": "non-anthropic (ops-pb reviewer-model)", "tokens": tokens,
                                                       "results": results}, indent=1, ensure_ascii=False), encoding="utf-8")
    del key
    by_id = {c["id"]: c for c in cards}
    flagged = [r for r in results.values() if r["verdict"] != "ok"]
    lines = [f"# Fact-check: {len(flagged)} of {len(cards)} cards flagged\n", f"Tokens used: {tokens}\n"]
    for r in sorted(flagged, key=lambda r: (r["verdict"], r["id"])):
        c = by_id[r["id"]]
        lines.append(f"\n## {r['id']} [{r['verdict']}] {c['title']}\n\n{c['body']}\n\n- Issue: {r.get('issue','')}\n- Source: {r.get('source','')}\n")
    (OUT / "flagged.md").write_text("".join(lines), encoding="utf-8")
    counts = {v: sum(1 for r in results.values() if r["verdict"] == v) for v in ("ok", "doubtful", "wrong", "unchecked")}
    print(f"done: {counts}; tokens {tokens}. See .factcheck/flagged.md")


if __name__ == "__main__":
    main()
