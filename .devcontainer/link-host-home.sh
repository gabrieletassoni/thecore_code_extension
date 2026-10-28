#!/usr/bin/env bash
# Claude Code's plugin registry (~/.claude/plugins/known_marketplaces.json,
# installed_plugins.json) bakes in *absolute* host paths at install time
# (e.g. /home/<host-user>/.claude/plugins/...) instead of paths relative to
# $HOME. Inside this devcontainer $HOME belongs to the container user, so
# those recorded paths don't exist here even though the bind-mounted content
# does, and Claude Code reports every marketplace plugin as
# "failed to load: cache-miss".
#
# Fix: alias the host developer's home directory name to this container's
# $HOME, so paths baked in under the host's username resolve to the real
# bind-mounted files. ${localEnv:USER} is substituted by VS Code from the HOST
# environment at container-create time.
#
# This script only warns on failure — it never fails the build.
set -uo pipefail

HOST_USER="${1:-}"

if [ -z "$HOST_USER" ] || [ "/home/$HOST_USER" = "$HOME" ]; then
  exit 0
fi

if [ -e "/home/$HOST_USER" ]; then
  # Already a symlink from a previous run, or a real directory: never clobber it.
  exit 0
fi

if ! sudo ln -s "$HOME" "/home/$HOST_USER" 2>/dev/null; then
  echo "⚠️  Could not create /home/$HOST_USER -> $HOME symlink; Claude Code plugin paths baked in under your host username may fail to resolve."
fi
