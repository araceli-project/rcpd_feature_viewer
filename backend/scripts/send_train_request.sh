#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "Usage: $0 <images_folder> <labels_json> [url]"
  echo "Example: $0 ./dataset/images ./dataset/train_labels.json http://localhost:8000/train"
  exit 1
fi

images_dir="$1"
labels_file="$2"
url="${3:-http://localhost:8000/train}"

if [[ ! -d "$images_dir" ]]; then
  echo "Error: '$images_dir' is not a directory."
  exit 1
fi

if [[ ! -f "$labels_file" ]]; then
  echo "Error: '$labels_file' does not exist."
  exit 1
fi

payload_json="$(python - "$labels_file" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)
if not isinstance(data, list) or not all(isinstance(x, bool) for x in data):
    raise SystemExit("Error: labels file must contain a JSON array of booleans.")
print(json.dumps(data))
PY
)"

mapfile -d '' images < <(
  find "$images_dir" -maxdepth 1 -type f \
    \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.bmp' -o -iname '*.webp' -o -iname '*.tif' -o -iname '*.tiff' \) \
    -print0 | sort -z
)

if [[ ${#images[@]} -eq 0 ]]; then
  echo "Error: no image files found in '$images_dir'."
  exit 1
fi

labels_count="$(python - "$payload_json" <<'PY'
import json
import sys
print(len(json.loads(sys.argv[1])))
PY
)"

if [[ "${#images[@]}" -ne "$labels_count" ]]; then
  echo "Error: number of images (${#images[@]}) does not match labels ($labels_count)."
  exit 1
fi

args=(-F "payload=${payload_json}")
for image_path in "${images[@]}"; do
  args+=(-F "files=@${image_path}")
done

curl --fail-with-body -sS -X POST "$url" "${args[@]}"
echo
