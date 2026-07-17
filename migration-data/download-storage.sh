#!/usr/bin/env bash
# download-storage.sh — mirror every Supabase storage bucket to local disk.
#
# Usage:
#   export SOURCE_URL=https://gclbltatkbwbqxqqrcea.supabase.co
#   export SOURCE_SERVICE_KEY=<service_role_key>
#   ./download-storage.sh ./storage-dump
#
# Output layout:
#   storage-dump/
#     avatars/<path>
#     profile-images/<path>
#     project-media/<path>
#     executive-progress/<path>
#     order-media/<path>
#     voice-messages/<path>
#     ticket-attachments/<path>
#
# Requirements: bash, curl, jq

set -euo pipefail

OUT="${1:-./storage-dump}"

: "${SOURCE_URL:?SOURCE_URL env var required}"
: "${SOURCE_SERVICE_KEY:?SOURCE_SERVICE_KEY env var required}"

BUCKETS=(
  avatars
  profile-images
  project-media
  executive-progress
  order-media
  voice-messages
  ticket-attachments
)

mkdir -p "$OUT"

# Recursive list — Supabase storage list is per-folder so we walk the tree.
list_folder() {
  local bucket="$1" prefix="$2" offset=0
  while :; do
    local body
    body=$(jq -nc \
      --arg p "$prefix" \
      --argjson lim 1000 --argjson off "$offset" \
      '{prefix:$p, limit:$lim, offset:$off, sortBy:{column:"name", order:"asc"}}')
    local resp
    resp=$(curl -fsS -X POST \
      -H "Authorization: Bearer $SOURCE_SERVICE_KEY" \
      -H "apikey: $SOURCE_SERVICE_KEY" \
      -H "Content-Type: application/json" \
      -d "$body" \
      "$SOURCE_URL/storage/v1/object/list/$bucket")
    local count
    count=$(echo "$resp" | jq 'length')
    [[ "$count" == "0" ]] && break
    echo "$resp" | jq -c '.[]' | while read -r item; do
      local name kind path
      name=$(echo "$item" | jq -r '.name')
      kind=$(echo "$item" | jq -r 'if .id == null then "folder" else "file" end')
      path="${prefix:+$prefix/}$name"
      if [[ "$kind" == "folder" ]]; then
        list_folder "$bucket" "$path"
      else
        echo "$path"
      fi
    done
    [[ "$count" -lt 1000 ]] && break
    offset=$((offset + 1000))
  done
}

for bucket in "${BUCKETS[@]}"; do
  echo "→ Bucket: $bucket"
  mkdir -p "$OUT/$bucket"
  count=0
  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    target="$OUT/$bucket/$path"
    mkdir -p "$(dirname "$target")"
    if [[ -f "$target" ]]; then continue; fi
    if curl -fsS -o "$target" \
        -H "Authorization: Bearer $SOURCE_SERVICE_KEY" \
        -H "apikey: $SOURCE_SERVICE_KEY" \
        "$SOURCE_URL/storage/v1/object/$bucket/$path"; then
      count=$((count + 1))
    else
      echo "  ✗ failed: $path" >&2
    fi
  done < <(list_folder "$bucket" "")
  echo "  ✅ $count files"
done

echo "✅ Storage mirror saved to $OUT"
