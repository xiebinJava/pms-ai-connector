#!/usr/bin/env sh
set -eu
source_dir="${1:-$(CDPATH= cd -- "$(dirname -- "$0")/../skills/pms-project-management" && pwd)/SKILL.md}"
destination="${2:-$HOME/.codex/skills/pms-project-management/SKILL.md}"
mkdir -p "$(dirname -- "$destination")"
cp "$source_dir" "$destination"
printf 'Installed PMS skill to %s\n' "$destination"
