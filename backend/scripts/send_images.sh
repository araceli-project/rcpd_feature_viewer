#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 3 ]]; then
  echo "Usage: $0 <images_folder> [model_name] [url]"
  echo "Example: $0 ./sample_images my-model http://localhost:8000/features"
  echo "Example (blank model): $0 ./sample_images http://localhost:8000/features"
  exit 1
fi

images_dir="$1"
model_name=""
url="http://localhost:8000/features"

if [[ $# -eq 2 ]]; then
  if [[ "$2" =~ ^https?:// ]]; then
    url="$2"
  else
    model_name="$2"
  fi
elif [[ $# -eq 3 ]]; then
  model_name="$2"
  url="$3"
fi

if [[ ! -d "$images_dir" ]]; then
  echo "Error: '$images_dir' is not a directory."
  exit 1
fi

args=()
while IFS= read -r -d '' image_path; do
  args+=(-F "images=@${image_path}")
done < <(
  find "$images_dir" -maxdepth 1 -type f \
    \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.bmp' -o -iname '*.webp' \) \
    -print0 | sort -z
)

if [[ ${#args[@]} -eq 0 ]]; then
  echo "Error: no image files found in '$images_dir'."
  exit 1
fi

curl --fail-with-body -sS -X POST "$url" \
  --form-string "model_name=${model_name}" \
  "${args[@]}"
echo
