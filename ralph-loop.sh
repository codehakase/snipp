#!/usr/bin/env bash
set -euo pipefail

MAX_ITER=25
HARNESS="codex"
OPENCODE_MODEL="opencode/minimax-m2.1-free"
PROMISE_LINE="<promise>COMPLETE</promise>"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --max-iterations)
      MAX_ITER="$2"
      shift 2
      ;;
    --harness)
      HARNESS="$2"
      shift 2
      ;;
    --model)
      OPENCODE_MODEL="$2"
      shift 2
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT="${SCRIPT_DIR}"
PRD_FILE="${PROJECT_ROOT}/prd.json"
PROGRESS_FILE="${PROJECT_ROOT}/progress.txt"

if [[ ! -f "${PRD_FILE}" ]]; then
  echo "Missing ${PRD_FILE}" >&2
  exit 1
fi

if [[ ! -f "${PROGRESS_FILE}" ]]; then
  echo "Missing ${PROGRESS_FILE}" >&2
  exit 1
fi

has_promise() {
  if command -v rg >/dev/null 2>&1; then
    rg -q "${PROMISE_LINE}" "${PROGRESS_FILE}"
  else
    grep -q "${PROMISE_LINE}" "${PROGRESS_FILE}"
  fi
}

build_prompt() {
  cat <<'PROMPT'
@prd.json @progress.txt \
1. Find the highest-priority feature to work on and work only on that feature. \
This should be the one YOU decide has the highest priority - not necessarily the first in the list. \
2. Check that the types check via pnpm typecheck and that the tests pass via pnpm test. \
3. Update the PRD with the work that was done. \
4. Append your progress to the progress.txt file. \
Use this to leave a note for the next person working in the codebase. \
5. Make a git commit of that feature. \
ONLY WORK ON A SINGLE FEATURE. \
If, while implementing the feature, you notice the PRD is complete, append to the end of progress file(do not rewrite the file, append to the end): <promise>COMPLETE</promise>. \
PROMPT

  cat "${PRD_FILE}"

  cat <<'PROMPT'

--- progress.txt ---
PROMPT

  cat "${PROGRESS_FILE}"
}

run_harness() {
  local prompt
  prompt=$(cat)
  
  case "${HARNESS}" in
    codex)
      echo "${prompt}" | codex exec -C "${PROJECT_ROOT}" --skip-git-repo-check --sandbox danger-full-access
      ;;
    amp)
      echo "${prompt}" | (cd "${PROJECT_ROOT}" && amp --dangerously-allow-all -x)
      ;;
    opencode)
      (cd "${PROJECT_ROOT}" && opencode run --model "${OPENCODE_MODEL}" "${prompt}")
      ;;
    claude)
      (cd "${PROJECT_ROOT}" && claude -p "${prompt}" --dangerously-skip-permissions)
      ;;
    *)
      echo "Unknown harness: ${HARNESS}" >&2
      exit 1
      ;;
  esac
}

for ((i = 1; i <= MAX_ITER; i++)); do
  if has_promise; then
    echo "Promise found in progress.txt. Exiting." >&2
    exit 0
  fi

  echo "Iteration ${i}/${MAX_ITER}" >&2
  build_prompt | run_harness

done

echo "Max iterations reached without promise." >&2
exit 1
