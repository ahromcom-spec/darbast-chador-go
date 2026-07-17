#!/usr/bin/env bash
# upload-storage.sh — push a local mirror produced by download-storage.sh
# into a self-hosted Supabase Storage instance.
#
# Usage:
#   export TARGET_URL=https://supabase.your-vps.com
#   export TARGET_SERVICE_KEY=<service_role_key>
#   ./upload-storage.sh ./storage-dump

set -euo pipefail

DIR="${1:-./storage-dump}"
: "${TARGET_URL:?TARGET_URL env var required}"
: "${TARGET_SERVICE_KEY:?TARGET_SERVICE_KEY env var required}"

if [[ ! -d "$DIR" ]]; then
  echo "directory not found: $DIR" >&2
  exit 1
fi

guess_mime() {
  case "$1" in
    *.jpg|*.jpeg) echo image/jpeg;;
    *.png) echo image/png;;
    *.webp) echo image/webp;;
    *.gif) echo image/gif;;
    *.mp4) echo video/mp4;;
    *.webm) echo video/webm;;
    *.mp3) echo audio/mpeg;;
    *.wav) echo audio/wav;;
    *.ogg|*.oga) echo audio/ogg;;
    *.pdf) echo application/pdf;;
    *) echo application/octet-stream;;
  esac
}

cd "$DIR"
for bucket in */ ; do
  bucket="${bucket%/}"
  echo "→ Bucket: $bucket"
  count=0
  find "$bucket" -type f -print0 | while IFS= read -r -d '' file; do
    rel="${file#${bucket}/}"
    mime=$(guess_mime "$file")
    if curl -fsS -X POST \
        -H "Authorization: Bearer $TARGET_SERVICE_KEY" \
        -H "apikey: $TARGET_SERVICE_KEY" \
        -H "Content-Type: $mime" \
        -H "x-upsert: true" \
        --data-binary "@$file" \
        "$TARGET_URL/storage/v1/object/$bucket/$rel" >/dev/null; then
      count=$((count + 1))
    else
      echo "  ✗ failed: $bucket/$rel" >&2
    fi
  done
  echo "  ✅ $count files"
done

echo "✅ Upload complete"
