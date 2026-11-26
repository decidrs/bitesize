#!/usr/bin/env bash
# PR check, house rule 11: grep the pull request's diff for the founder's personal name.
#   bash rule11.sh <pr.diff>
# The pattern comes only from the RULE11_PATTERN repository secret (the "founder pattern name (rule 11)"), through the environment. It is
# never printed: only the match count and grep's exit code are. Exit codes follow the grep-evidence standard: 1 = no match = pass. A
# missing secret skips the check with a notice, since a fork or a repo without the secret cannot run it.
set -u
diff_file="${1:?usage: rule11.sh <pr.diff>}"
if [ -z "${RULE11_PATTERN:-}" ]; then
  echo "::notice::RULE11_PATTERN secret is not set: rule 11 grep skipped"
  exit 0
fi
count="$(grep -c -i -E -e "$RULE11_PATTERN" "$diff_file")"
rc=$?
echo "rule 11: matches ${count:-0}, grep exit $rc (1 = no match = pass)"
if [ "$rc" -eq 1 ]; then
  exit 0
fi
echo "::error::rule 11 grep did not pass (exit $rc)"
exit 1
