#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-5174}"
PID_FILE="$APP_DIR/.x2rank.pid"
LOG_DIR="$APP_DIR/logs"
LOG_FILE="$LOG_DIR/x2rank.log"

usage() {
  cat <<EOF
Usage: ./start.sh [start|stop|restart|status|logs]

Environment:
  PORT=$PORT

Examples:
  ./start.sh
  PORT=80 ./start.sh
  ./start.sh restart
  ./start.sh logs
EOF
}

is_running() {
  [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" >/dev/null 2>&1
}

ensure_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js is not installed. Please install Node.js first."
    exit 1
  fi
}

ensure_dependencies() {
  if [[ -d "$APP_DIR/node_modules/better-sqlite3" ]]; then
    return
  fi
  if ! command -v npm >/dev/null 2>&1; then
    echo "npm is not installed. Please install npm first."
    exit 1
  fi
  echo "Installing dependencies..."
  cd "$APP_DIR"
  npm install --omit=dev
}

start_app() {
  ensure_node
  ensure_dependencies
  mkdir -p "$APP_DIR/data" "$LOG_DIR"

  if is_running; then
    echo "X2Rank is already running: PID $(cat "$PID_FILE")"
    echo "URL: http://0.0.0.0:$PORT/"
    exit 0
  fi

  cd "$APP_DIR"
  setsid env PORT="$PORT" node server.js >>"$LOG_FILE" 2>&1 < /dev/null &
  echo $! >"$PID_FILE"
  sleep 0.5

  if is_running; then
    echo "X2Rank started."
    echo "PID: $(cat "$PID_FILE")"
    echo "URL: http://0.0.0.0:$PORT/"
    echo "Log: $LOG_FILE"
  else
    echo "X2Rank failed to start. Check log: $LOG_FILE"
    exit 1
  fi
}

stop_app() {
  if ! is_running; then
    echo "X2Rank is not running."
    rm -f "$PID_FILE"
    return
  fi

  local pid
  pid="$(cat "$PID_FILE")"
  kill "$pid"
  for _ in {1..20}; do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      rm -f "$PID_FILE"
      echo "X2Rank stopped."
      return
    fi
    sleep 0.2
  done

  kill -9 "$pid" >/dev/null 2>&1 || true
  rm -f "$PID_FILE"
  echo "X2Rank stopped."
}

status_app() {
  if is_running; then
    echo "X2Rank is running."
    echo "PID: $(cat "$PID_FILE")"
    echo "URL: http://0.0.0.0:$PORT/"
  else
    echo "X2Rank is not running."
  fi
}

case "${1:-start}" in
  start)
    start_app
    ;;
  stop)
    stop_app
    ;;
  restart)
    stop_app
    start_app
    ;;
  status)
    status_app
    ;;
  logs)
    mkdir -p "$LOG_DIR"
    touch "$LOG_FILE"
    tail -f "$LOG_FILE"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac
