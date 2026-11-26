# PR checks

- `credential_scan.py` is a byte-for-byte copy of decidrs/ops-pb `scripts/lib/credential_scan.py` at main df27a17 (sha256 1f2d67772722add55aad191b5ed3f4caf38abc71123fba548df5600a2bff4a97). Change it there first, then copy it here; never edit the copy.
- `scan_diff.py` runs its `scan()` over the lines a pull request adds and prints counts and line numbers, never the matched text.
- `rule11.sh` greps the PR diff for the founder's personal name, using the `RULE11_PATTERN` repository secret (the "founder pattern name (rule 11)"). It prints only the match count and grep's exit code; 1 means no match, which is a pass. Without the secret, the check is skipped with a notice.
