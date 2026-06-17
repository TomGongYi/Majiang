#!/usr/bin/env sh

set -eu

PORT="${PORT:-8081}"
HOST="${HOST:-0.0.0.0}"
MODE="${MODE:-auto}"
BUILD="${BUILD:-1}"
CONTAINER_NAME="${CONTAINER_NAME:-majiang-web}"
IMAGE_NAME="${IMAGE_NAME:-majiang-web}"
NODE_IMAGE="${NODE_IMAGE:-node:20-alpine}"
NGINX_IMAGE="${NGINX_IMAGE:-nginx:1.27-alpine}"

log() {
    printf '%s\n' "$*"
}

die() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

usage() {
    cat <<'EOF'
Usage:
  sh start.sh

Environment variables:
  PORT=8081                  Host port to expose.
  HOST=0.0.0.0               Host for non-Docker static server fallback.
  MODE=auto                  auto | docker | serve | python
  BUILD=1                    1 builds dist first, 0 skips build.
  CONTAINER_NAME=majiang-web Docker container name.
  IMAGE_NAME=majiang-web     Docker image name.
  NODE_IMAGE=node:20-alpine
  NGINX_IMAGE=nginx:1.27-alpine

Examples:
  sh start.sh
  PORT=8090 sh start.sh
  MODE=serve PORT=8081 sh start.sh
  BUILD=0 MODE=docker sh start.sh
EOF
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
    usage
    exit 0
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if [ -n "${APP_DIR:-}" ]; then
    PROJECT_DIR="$APP_DIR"
elif [ -f "$SCRIPT_DIR/package.json" ]; then
    PROJECT_DIR="$SCRIPT_DIR"
elif [ -f "$SCRIPT_DIR/Majiang-master/package.json" ]; then
    PROJECT_DIR="$SCRIPT_DIR/Majiang-master"
elif [ -f "./package.json" ]; then
    PROJECT_DIR="$(pwd)"
elif [ -f "./Majiang-master/package.json" ]; then
    PROJECT_DIR="$(pwd)/Majiang-master"
else
    die "Cannot find package.json. Run this script from repo root or set APP_DIR."
fi

PROJECT_DIR=$(CDPATH= cd -- "$PROJECT_DIR" && pwd)
DIST_DIR="$PROJECT_DIR/dist"
PID_FILE="$PROJECT_DIR/.majiang-server.pid"
LOG_FILE="$PROJECT_DIR/app.log"

case "$PORT" in
    ''|*[!0-9]*) die "PORT must be a number." ;;
esac

case "$MODE" in
    auto|docker|serve|python) ;;
    *) die "MODE must be one of: auto, docker, serve, python." ;;
esac

build_project() {
    if [ "$BUILD" = "0" ]; then
        log "Skip build because BUILD=0."
        return
    fi

    if ! command -v npm >/dev/null 2>&1; then
        if [ -f "$DIST_DIR/index.html" ]; then
            log "npm is not installed; existing dist/index.html found, skip build."
            return
        fi
        die "npm is not installed and dist/index.html does not exist."
    fi

    log "Installing dependencies and building release..."
    cd "$PROJECT_DIR"
    if [ -f package-lock.json ]; then
        npm ci --no-audit --no-fund
    else
        npm install --no-audit --no-fund
    fi
    npm run release
}

check_dist() {
    [ -f "$DIST_DIR/index.html" ] || die "dist/index.html not found."
}

start_with_docker() {
    command -v docker >/dev/null 2>&1 || return 1
    docker version >/dev/null 2>&1 || return 1

    tmp_dockerfile="$PROJECT_DIR/.Dockerfile.start"
    trap 'rm -f "$tmp_dockerfile"' EXIT INT TERM

    if [ "$BUILD" = "0" ]; then
        check_dist
        docker_context="$DIST_DIR"
        cat > "$tmp_dockerfile" <<EOF
FROM ${NGINX_IMAGE}
COPY . /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/index.html || exit 1
EOF
    else
        docker_context="$PROJECT_DIR"
        cat > "$tmp_dockerfile" <<EOF
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run release && test -f dist/index.html

FROM ${NGINX_IMAGE}
COPY --from=build /app/dist/ /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/index.html || exit 1
EOF
    fi

    log "Building Docker image ${IMAGE_NAME}:local ..."
    docker build \
        --tag "${IMAGE_NAME}:local" \
        --file "$tmp_dockerfile" \
        "$docker_context"

    log "Starting Docker container ${CONTAINER_NAME} on port ${PORT} ..."
    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
    docker run -d \
        --name "$CONTAINER_NAME" \
        --restart unless-stopped \
        -p "${PORT}:80" \
        "${IMAGE_NAME}:local" >/dev/null

    log "Started: http://localhost:${PORT}/"
}

stop_pid_server() {
    if [ -f "$PID_FILE" ]; then
        old_pid=$(cat "$PID_FILE" 2>/dev/null || true)
        if [ -n "$old_pid" ] && kill -0 "$old_pid" >/dev/null 2>&1; then
            log "Stopping previous server process ${old_pid} ..."
            kill "$old_pid" >/dev/null 2>&1 || true
        fi
        rm -f "$PID_FILE"
    fi
}

start_with_serve() {
    command -v npx >/dev/null 2>&1 || return 1
    stop_pid_server
    log "Starting npx serve on ${HOST}:${PORT} ..."
    cd "$PROJECT_DIR"
    nohup npx --yes serve -s dist -l "tcp://${HOST}:${PORT}" > "$LOG_FILE" 2>&1 &
    echo "$!" > "$PID_FILE"
    sleep 1
    if ! kill -0 "$(cat "$PID_FILE")" >/dev/null 2>&1; then
        cat "$LOG_FILE" >&2 || true
        die "npx serve failed to start."
    fi
    log "Started: http://localhost:${PORT}/"
    log "Log file: $LOG_FILE"
}

start_with_python() {
    command -v python3 >/dev/null 2>&1 || return 1
    stop_pid_server
    log "Starting python3 http.server on ${HOST}:${PORT} ..."
    cd "$DIST_DIR"
    nohup python3 -m http.server "$PORT" --bind "$HOST" > "$LOG_FILE" 2>&1 &
    echo "$!" > "$PID_FILE"
    sleep 1
    if ! kill -0 "$(cat "$PID_FILE")" >/dev/null 2>&1; then
        cat "$LOG_FILE" >&2 || true
        die "python3 http.server failed to start."
    fi
    log "Started: http://localhost:${PORT}/"
    log "Log file: $LOG_FILE"
}

case "$MODE" in
    docker)
        start_with_docker || die "Docker is unavailable. Check docker command and daemon access."
        ;;
    serve)
        build_project
        check_dist
        start_with_serve || die "npx is unavailable. Install node/npm or use MODE=docker."
        ;;
    python)
        build_project
        check_dist
        start_with_python || die "python3 is unavailable."
        ;;
    auto)
        if start_with_docker; then
            exit 0
        fi
        log "Docker is unavailable; trying npx serve fallback..."
        build_project
        check_dist
        if start_with_serve; then
            exit 0
        fi
        log "npx serve is unavailable; trying python3 fallback..."
        if start_with_python; then
            exit 0
        fi
        die "No supported runtime found. Install Docker, Node/npm, or Python 3."
        ;;
esac
