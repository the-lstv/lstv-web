#!/bin/sh

OUTPUT="kernel.js"

FILES="
src/init.mjs
src/commons.mjs
src/enums.mjs
src/soundbox.mjs
src/desktop.mjs
src/fs.mjs
src/sha512.mjs
src/atrium.mjs
src/shared.mjs
src/kernel.mjs
"
# src/shell.mjs

merge() {
    tmp="${OUTPUT}.tmp.$$"

    : > "$tmp"

    touch "$tmp" || exit 1

    printf '%s\n' "/*
    lstv.space kernel
    Author: Lukas (thelstv)
    Copyright: (c) https://lstv.space
    No commercial or training use permitted.
    This code is not open-source.

    Last modified: 2026
    See: https://github.com/the-lstv/lstv-web
*/

try {" >> "$tmp"

    printf '%s\n' "$FILES" |
    while IFS= read -r file; do
        [ -z "$file" ] && continue
        sed '/^import /d; /^export /d' "$file" >> "$tmp" || exit 1
    done

    printf '\n} catch (e) { console.error("Fatal error during app initialization:", e); globalThis.__loadError() }\n' >> "$tmp"

    touch "$tmp" || exit 1
    mv "$tmp" "$OUTPUT"
}

is_tracked() {
    changed=$1

    while IFS= read -r file; do
        [ -z "$file" ] && continue

        [ "$changed" = "$file" ] && return 0
    done <<EOF
$FILES
EOF

    return 1
}

# Initial merge
merge || exit 1

# Find the directories that contain the files.
DIRS=$(
    printf '%s\n' "$FILES" |
    sed '/^[[:space:]]*$/d' |
    xargs -n1 dirname |
    sort -u
)

echo "Watching:"
printf '  %s\n' "$FILES"
echo "Output: $OUTPUT"

# One watcher, one merge process.
inotifywait -m \
    -e close_write,moved_to \
    --format '%w%f' \
    $DIRS |
while IFS= read -r changed; do
    if is_tracked "$changed"; then
        echo "Changed: $changed"
        merge || echo "Merge failed"
    fi
done