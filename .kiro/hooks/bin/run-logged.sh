#!/bin/sh
# Runs a hook command and writes exactly ONE line to the hooks evidence log, including when the
# command is killed at the hook timeout. POSIX sh only; no bashisms.
#
#   sh .kiro/hooks/bin/run-logged.sh <hook name> <deadline seconds> <command> [args...]
#
# Three cases, one line each (format: scripts/checks/hooksLog.ts, written by scripts/log_hook.ts):
#   1. the command finishes      -> "exit <status>", and the wrapper exits with that same status,
#                                   so the hook result the runner sees is unchanged;
#   2. the deadline passes       -> the command is sent TERM and the line reads
#                                   "timed out (deadline <deadline>s)", exit status 124;
#   3. the wrapper itself is     -> the TERM/INT trap writes "timed out (terminated by the hook
#      killed from outside          runner)" before exiting 124.
# Keep <deadline> below the hook's own "timeout" (seconds, see kiro.dev/docs/hooks) so case 2
# normally wins and the line is written by us rather than depending on how the runner kills us.
# Only SIGKILL can leave no line; it cannot be trapped.
#
# STDIN (the runner's JSON session context, which related-tests.mjs reads to find the saved file)
# is copied to a temporary file and given to the command, because a POSIX shell attaches /dev/null
# to the standard input of a background command.
set -u

if [ "$#" -lt 3 ]; then
  echo "usage: sh .kiro/hooks/bin/run-logged.sh <hook name> <deadline seconds> <command> [args...]" >&2
  exit 2
fi

hook=$1
deadline=$2
shift 2

root=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd) || root=$PWD

logged=0
log_line() {
  if [ "$logged" -eq 0 ]; then
    logged=1
    node "$root/scripts/log_hook.ts" "$hook" "$1" ||
      echo "run-logged.sh: could not write the hook log line for $hook" >&2
  fi
}

work=$(mktemp -d "${TMPDIR:-/tmp}/naqsha-hook.XXXXXX" 2>/dev/null) || work=""

cleanup() {
  [ -n "${watchdog:-}" ] && kill "$watchdog" 2>/dev/null
  [ -n "$work" ] && rm -rf "$work"
  return 0
}

# Safety net: if the wrapper ever leaves by a path that wrote no line, record that it ended.
on_exit() {
  status=$?
  log_line "exit $status (wrapper ended without its own result line)"
  cleanup
}
trap on_exit EXIT

on_term() {
  log_line "timed out (terminated by the hook runner)"
  [ -n "${child:-}" ] && kill -TERM "$child" 2>/dev/null
  cleanup
  exit 124
}
trap on_term TERM INT

if [ -z "$work" ]; then
  # No temporary directory: run in the foreground, so STDIN and the exit status still pass through.
  # The self-imposed deadline is not available in this mode; the TERM trap still writes a line.
  echo "run-logged.sh: no temporary directory, running without the self-imposed deadline" >&2
  "$@"
  status=$?
  log_line "exit $status"
  exit "$status"
fi

cat > "$work/stdin"
"$@" < "$work/stdin" &
child=$!

watchdog=""
if [ "$deadline" -gt 0 ] 2>/dev/null; then
  (
    waited=0
    while [ "$waited" -lt "$deadline" ]; do
      sleep 1
      kill -0 "$child" 2>/dev/null || exit 0
      waited=$((waited + 1))
    done
    echo timeout > "$work/timed-out"
    kill -TERM "$child" 2>/dev/null
  ) &
  watchdog=$!
fi

wait "$child"
status=$?

if [ -s "$work/timed-out" ]; then
  log_line "timed out (deadline ${deadline}s)"
  exit 124
fi

log_line "exit $status"
exit "$status"
