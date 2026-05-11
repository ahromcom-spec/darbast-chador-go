#!/usr/bin/env bash
# ============================================================
# download-media.sh — Download all media from Lovable Cloud
# Run on a machine with UNRESTRICTED internet access.
# Outputs: ./media-files/<bucket>/<path>
# ============================================================
set -euo pipefail

# CONFIG — fill these in:
SUPABASE_URL="https://gclbltatkbwbqxqqrcea.supabase.co"
# Get this from Lovable Cloud → Settings → API → service_role key
SERVICE_KEY="${SERVICE_KEY:-PUT_SERVICE_ROLE_KEY_HERE}"

MANIFEST="${MANIFEST:-manifest.csv}"
OUT_DIR="${OUT_DIR:-./media-files}"

if [ "$SERVICE_KEY" = "PUT_SERVICE_ROLE_KEY_HERE" ]; then
  echo "❌ Set SERVICE_KEY environment variable first."
  echo "   Example: SERVICE_KEY=eyJ... ./download-media.sh"
  exit 1
fi

if [ ! -f "$MANIFEST" ]; then
  echo "❌ Manifest not found at: $MANIFEST"
  exit 1
fi

mkdir -p "$OUT_DIR"
total=$(($(wc -l < "$MANIFEST") - 1))
echo "📦 Downloading $total files to $OUT_DIR ..."

i=0
fail=0
# Skip header
tail -n +2 "$MANIFEST" | while IFS=',' read -r bucket path size mime public url; do
  i=$((i+1))
  # strip quotes
  bucket="${bucket//\"/}"
  path="${path//\"/}"
  url="${url//\"/}"
  
  dest="$OUT_DIR/$bucket/$path"
  mkdir -p "$(dirname "$dest")"
  
  if [ -f "$dest" ] && [ -s "$dest" ]; then
    printf "[%d/%d] ⏭  %s/%s (exists)\n" "$i" "$total" "$bucket" "$path"
    continue
  fi
  
  if curl -sf -o "$dest" \
       -H "Authorization: Bearer $SERVICE_KEY" \
       -H "apikey: $SERVICE_KEY" \
       "$url"; then
    printf "[%d/%d] ✓ %s/%s\n" "$i" "$total" "$bucket" "$path"
  else
    printf "[%d/%d] ❌ %s/%s\n" "$i" "$total" "$bucket" "$path"
    fail=$((fail+1))
  fi
done

echo ""
echo "🎉 Done. Files in: $OUT_DIR"
echo "   Now compress and transfer to VPS:"
echo "   tar czf media-files.tar.gz media-files/"
echo "   scp media-files.tar.gz root@VPS_IP:/opt/ahrom/migration-data/"
