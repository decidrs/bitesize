"""credential_scan — the packet scanner's six patterns, the one exemption,
and the refusal itself.

Used by scripts/build-packet.sh (refusal 2: credential-shaped strings) and
by scripts/test/test_credential_scan.py. Order 2f636c8bzuiaz9h; the refusal
function and the tightened path rule are order sv4pnr2lyi4g5fi.

THE EXEMPTION. The third pattern, "a credential assignment", matches
<word>[:=]<8+ non-space chars> and cannot tell a literal from a reference
to a named value. A match is exempt when its VALUE, after trailing code
closers are stripped (backtick, quote, bracket, semicolon, comma), is
exactly an identifier reference and contains no digit:

  - an ALL-CAPS constant: letters and underscores, at most 32 characters,
    and either containing an underscore or at most 12 letters long;
  - a braced ${NAME} reference to one — braces required;
  - a dotted member path of two to four segments, each 1 to 24 letters
    or underscores.

Four further forms, order 5z710y0hfkoqxsw (ruled 07/11/2026, Decisions Log
41151ef5-f54a-812e), under the same invariants: no digit in the reference,
an ALL-CAPS constant has an underscore or at most 12 letters and at most
32 characters, and a dollar sign only in the ${...} wrapper:

  (a) placeholder: <NAME>, where NAME is an ALL-CAPS constant;
  (b) member path with a constant segment: a dotted path of two to four
      segments in which a segment may be an ALL-CAPS constant of up to 32
      characters (every other segment stays at most 24 letters or
      underscores);
  (c) call: a dotted member path of two to four segments followed by an
      opening parenthesis that ends the match;
  (d) template interpolation: ${NAME}, or ${name(arg)} with name and arg
      each an identifier of at most 24 letters or underscores or a member
      path, followed by a closing backtick. What follows that backtick is
      code, not part of the reference, but the match is refused if it
      carries any run of 8 or more key characters (letters, digits,
      underscore, hyphen) that contains a digit.

Every exemption records the form that matched it.

THE 12-LETTER RULE IN EVERY FORM. Order ko1w807y8ykdjze (ruled 12/11/2026,
Decisions Log 41651ef5-f54a-812f-a916-dc8997ea2275): an ALL-CAPS segment
(letters and underscores only) with no underscore and more than 12 letters
is never exempt, in any form: the plain member path, the member path with
a constant segment, the path of a call, and the name and argument of a
template interpolation, as for the constant, the braced constant and the
placeholder. A segment of at most 12 letters, or with an underscore, keeps
the limits above (at most 24 letters, or 32 characters for a constant
segment).

A dollar sign anywhere other than that ${NAME} wrapper is never exempt:
not inside a path segment, not as a bare $-prefixed word. Nothing with a
digit is ever exempt, which is what keeps keys, hashes and JWTs (whose
header and payload always carry digits) refused. Every exemption is
RECORDED by the caller in the packet, so the grader sees what was waved
through. There is no flag, environment variable or allowlist: a manual
override would let a real secret through by hand, which is the thing the
scanner exists to make impossible.

THE REFUSAL. scan_or_refuse() is what build-packet.sh calls: on any hit it
prints the locations (never the matched text) and the identifier rule to
stderr and exits 4; on a clean haystack it returns the exemptions. The
fixture test calls it directly, so the exit-4 path is exercised, not
assumed.
"""
import re
import sys

PATTERNS = [
    (r"sk-[A-Za-z0-9_\-]{16,}", "an sk- API key"),
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "a private key block"),
    (r"(?i)\b(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*([^\s\"',]{8,})", "a credential assignment"),
    (r"postgres(?:ql)?://[^\s:/]+:[^\s@]+@", "a DSN with an inline password"),
    (r"(?i)authorization:\s*bearer\s+\S{12,}", "an Authorization: Bearer header"),
    (r"\bAKIA[0-9A-Z]{16}\b", "an AWS access key id"),
]
EXEMPTIBLE = "a credential assignment"
IDENTIFIER_RULE = ("identifier reference, no digit: an ALL-CAPS constant (underscore, or at most 12 letters; at most 32 chars), "
                   "a braced ${NAME} reference to one, or a dotted member path of 2 to 4 segments of at most 24 letters or underscores; "
                   "a <NAME> placeholder, a member path with an ALL-CAPS segment of up to 32 characters, a call on a member path, "
                   "or a template ${NAME} or ${name(arg)} closed by a backtick with no digit-bearing run of 8 or more after it; "
                   "a $ anywhere else is never exempt")
EXIT_CODE = 4

_CLOSERS = re.compile(r"[`'\")\];,]+$")
_IDENT = re.compile(r"^(\$\{(?P<c1>[A-Z_]{2,32})\}|(?P<c2>[A-Z_]{2,32})|(?P<path>[A-Za-z_]{1,24}(\.[A-Za-z_]{1,24}){1,3}))$")


_SEG = r"[A-Za-z_]{1,24}"
_CONST = r"[A-Z_]{2,32}"
_PATH = rf"(?:{_SEG}|{_CONST})(?:\.(?:{_SEG}|{_CONST})){{1,3}}"
_NAME = rf"(?:{_PATH}|{_SEG})"
_PLACEHOLDER = re.compile(rf"^<(?P<c>{_CONST})>$")
_CALL_OPEN = re.compile(rf"^(?P<p>{_PATH})\($")
_TEMPLATE = re.compile(rf"^(?P<ref>\$\{{(?:(?P<c>{_CONST})|{_NAME}\({_NAME}\))\}})`(?P<rest>.*)$")
_KEYRUN = re.compile(r"[A-Za-z0-9_\-]{8,}")


def _const_ok(c):
    return c is None or "_" in c or len(c) <= 12


def _segments_ok(path):
    """True when every ALL-CAPS segment of `path` passes _const_ok."""
    return all(_const_ok(s) for s in re.split(r"[.()]", path) if re.fullmatch(r"[A-Z_]+", s))


def identifier_form(value: str):
    """(identifier, form) when `value` is an exempt reference, else None."""
    v = _CLOSERS.sub("", value)
    m = _IDENT.match(v)
    if m:
        c = m.group("c1") or m.group("c2")
        if c is not None and "_" not in c and len(c) > 12:
            return None
        if m.group("c1"):
            return v, "braced constant"
        if m.group("c2"):
            return v, "constant"
        if not _segments_ok(v):
            return None
        return v, "member path"
    if re.search(r"\d", v.split("`")[0]):
        return None
    m = _PLACEHOLDER.match(v)
    if m and _const_ok(m.group("c")):
        return v, "placeholder"
    if re.fullmatch(_PATH, v):
        if _segments_ok(v):
            return v, "member path, constant segment"
    m = _CALL_OPEN.match(v)
    if m and _segments_ok(m.group("p")):
        return m.group("p"), "call on a member path"
    m = _TEMPLATE.match(value)
    if m and _const_ok(m.group("c")) and _segments_ok(m.group("ref")[2:-1]):
        if any(re.search(r"\d", r) for r in _KEYRUN.findall(m.group("rest"))):
            return None
        return m.group("ref"), "template interpolation"
    return None


def identifier_reference(value: str):
    """The stripped identifier when `value` is an exempt reference, else None."""
    f = identifier_form(value)
    return None if f is None else f[0]


def scan(haystack: str):
    """Returns (hits, exemptions). hits: [(line, what)]; exemptions: [{line, pattern, identifier, form}]."""
    hits, exemptions = [], []
    for pat, what in PATTERNS:
        for m in re.finditer(pat, haystack):
            line = haystack.count("\n", 0, m.start()) + 1
            if what == EXEMPTIBLE:
                f = identifier_form(m.group(2))
                if f is not None:
                    exemptions.append({"line": line, "pattern": what, "identifier": f[0], "form": f[1]})
                    continue
            hits.append((line, what))
    return hits, exemptions


def scan_or_refuse(haystack: str, err=None):
    """The refusal. Scans `haystack`; on any hit prints the locations and the
    identifier rule to `err` (stderr by default) and exits EXIT_CODE; on a
    clean haystack returns the exemptions list for the caller to record."""
    err = sys.stderr if err is None else err
    hits, exemptions = scan(haystack)
    if hits:
        print("PACKET-ERROR: credential-shaped strings found; refusing to build.", file=err)
        print("The matched text is NOT printed. Locations only:", file=err)
        for line, what in sorted(set(hits)):
            print(f"  line ~{line}: {what}", file=err)
        print("\nThe rubric's Lineage criterion makes a secret in the artefact or", file=err)
        print("action log a Critical finding regardless of any other result.", file=err)
        print(f"Not exempt: only an {IDENTIFIER_RULE} is waved through, and recorded.", file=err)
        sys.exit(EXIT_CODE)
    return exemptions
