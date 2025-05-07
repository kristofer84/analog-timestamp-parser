import json
import piexif
from PIL import Image
from datetime import datetime
import argparse
import os

def set_exif_dates(json_path, dry_run=False):
    # Resolve base directory
    base_dir = os.path.dirname(os.path.abspath(json_path))

    # Load JSON file
    with open(json_path, 'r') as f:
        data = json.load(f)

    for item in data:
        filename = os.path.join(base_dir, item["filename"])
        date_str = item["date"]
        exif_date = datetime.strptime(date_str, "%Y-%m-%d").strftime("%Y:%m:%d %H:%M:%S")

        if not os.path.isfile(filename):
            print(f"File not found: {filename}")
            continue

        if dry_run:
            print(f"[Dry Run] Would set {filename} DateTimeOriginal to {exif_date}")
            continue

        try:
            img = Image.open(filename)
            existing_exif = img.info.get("exif", None)
            exif_dict = piexif.load(existing_exif) if existing_exif else {"0th": {}, "Exif": {}, "GPS": {}, "1st": {}, "thumbnail": None}
            exif_dict.setdefault("Exif", {})
            exif_dict["Exif"][piexif.ExifIFD.DateTimeOriginal] = exif_date.encode('utf-8')
            exif_bytes = piexif.dump(exif_dict)
            img.save(filename, exif=exif_bytes)
            print(f"Updated {filename} with date {exif_date}")
        except Exception as e:
            print(f"Failed to update {filename}: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Set EXIF DateTimeOriginal from JSON metadata.")
    parser.add_argument("json_file", help="Path to JSON file with filename/date pairs.")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without modifying files.")
    args = parser.parse_args()

    set_exif_dates(args.json_file, dry_run=args.dry_run)
