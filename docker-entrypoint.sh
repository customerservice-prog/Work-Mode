#!/bin/sh
set -eu

# Work-Mode cloud's signed-in browser profile is stored on the attached
# persistent volume. Railway mounts volumes as root; grant the non-root
# browser user access before dropping privileges.
if [ "${WORKMODE_CLOUD_MODE:-0}" = "1" ]; then
  if [ "${WORKMODE_DATA_DIR:-}" != "/data" ]; then
    echo "Cloud container requires WORKMODE_DATA_DIR=/data" >&2
    exit 1
  fi
  if [ "$(id -u)" -eq 0 ]; then
    mkdir -p /data
    chown -R pwuser:pwuser /data
    chmod 0700 /data
    exec gosu pwuser "$@"
  fi
fi

exec "$@"
