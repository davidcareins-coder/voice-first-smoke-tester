#!/usr/bin/env bash
# Voice-First Smoke Tester — Kane CLI verification.
# Needs: a TestMu AI account (free — sign up at https://www.testmuai.com and
# claim the 10,000 free credits with the same email used for the hackathon),
# then authenticate once:  kane-cli login
# (OAuth in the browser; credentials land in ~/.testmuai/kaneai/profiles/).
# After that, this script runs the three plain-English objectives from
# kane/objectives.md and saves every result to kane/verification-log.txt.
set -u
cd "$(dirname "$0")/.."
LOG="kane/verification-log.txt"
: > "$LOG"

echo "=== Kane CLI verification — $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" | tee -a "$LOG"
KANE="${KANE:-./node_modules/.bin/kane-cli}"
command -v "$KANE" >/dev/null 2>&1 || KANE="kane-cli"
"$KANE" --version 2>&1 | tee -a "$LOG"

run_objective() {
  local name="$1"; shift
  local objective="$1"; shift
  echo "" | tee -a "$LOG"
  echo "--- $name ---" | tee -a "$LOG"
  # shellcheck disable=SC2086
  "$KANE" run "$objective" --headless --agent "$@" 2>>"$LOG" | tee -a "$LOG"
  echo "exit code: $?" | tee -a "$LOG"
}

run_objective "Objective 1 — tester report page works end to end" \
  "Open https://davidcareins-coder.github.io/voice-first-smoke-tester/report.html and confirm the page loads, shows a pass/fail table with at least 10 checks, and shows an Eyes-closed coverage percentage. Fail if the page does not load or the table is missing."

run_objective "Objective 2 — target app answers a question" \
  "Open https://davidcareins-coder.github.io/daily-meds-helper/ and click the button Did I take my morning pills? Confirm the Answer area changes from its placeholder text to a real answer. Fail if the answer area stays on the placeholder or the page errors."

run_objective "Objective 3 — Kane catches the real failure" \
  "Open https://davidcareins-coder.github.io/daily-meds-helper/ and confirm the Answer area has no aria-live attribute and no role of status or alert. Pass if the missing announcement is confirmed."

echo "" | tee -a "$LOG"
echo "Done. Full log: $LOG" | tee -a "$LOG"
