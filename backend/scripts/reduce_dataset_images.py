import argparse
import random
import shutil
from pathlib import Path


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Copy a random subset of images to a reduced dataset directory."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=Path("./dataset/images"),
        help="Directory containing source images.",
    )
    parser.add_argument(
        "--destination",
        type=Path,
        default=Path("./dataset/images_reduced"),
        help="Directory where sampled images are copied.",
    )
    parser.add_argument(
        "--fraction",
        type=float,
        default=0.1,
        help="Fraction of images to copy (default: 0.1).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed used for sampling.",
    )
    return parser.parse_args()


def get_image_files(images_dir: Path) -> list[Path]:
    if not images_dir.exists() or not images_dir.is_dir():
        raise FileNotFoundError(f"Images directory not found: {images_dir}")

    return sorted(
        file_path
        for file_path in images_dir.iterdir()
        if file_path.is_file() and file_path.suffix.lower() in IMAGE_EXTENSIONS
    )


def main() -> None:
    args = parse_args()
    if args.fraction <= 0 or args.fraction > 1:
        raise ValueError("fraction must be greater than 0 and less than or equal to 1.")

    image_files = get_image_files(args.source)
    if not image_files:
        raise ValueError(f"No image files found in source directory: {args.source}")

    target_count = max(1, int(len(image_files) * args.fraction))
    rng = random.Random(args.seed)
    sampled_images = rng.sample(image_files, k=target_count)

    args.destination.mkdir(parents=True, exist_ok=True)
    for image_path in sampled_images:
        shutil.copy2(image_path, args.destination / image_path.name)

    print(
        f"Copied {len(sampled_images)} image(s) from {args.source} to {args.destination}."
    )


if __name__ == "__main__":
    main()
