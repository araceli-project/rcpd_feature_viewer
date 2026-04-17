import argparse
import json
from pathlib import Path


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a JSON list of boolean labels from image filenames."
    )
    parser.add_argument(
        "--images-dir",
        type=Path,
        default=Path("./dataset/images"),
        help="Directory containing images.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("./dataset/train_labels.json"),
        help="Output JSON file path.",
    )
    return parser.parse_args()


def label_from_name(filename: str) -> bool:
    lower_name = filename.lower()
    if lower_name.startswith("oi"):
        return False
    if lower_name.startswith("sod"):
        return True
    raise ValueError(
        f"Unsupported filename prefix for '{filename}'. Expected prefixes: 'oi' or 'sod'."
    )


def main() -> None:
    args = parse_args()
    images_dir = args.images_dir

    if not images_dir.exists() or not images_dir.is_dir():
        raise FileNotFoundError(f"Images directory not found: {images_dir}")

    image_files = sorted(
        file_path
        for file_path in images_dir.iterdir()
        if file_path.is_file() and file_path.suffix.lower() in IMAGE_EXTENSIONS
    )

    labels = [label_from_name(image_file.name) for image_file in image_files]

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(labels, indent=2), encoding="utf-8")

    print(f"Created {args.output} with {len(labels)} labels.")


if __name__ == "__main__":
    main()
