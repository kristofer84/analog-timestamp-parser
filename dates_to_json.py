import cv2
import pytesseract
import re
import numpy as np
from pathlib import Path
from datetime import datetime
import sys
import argparse
import json

def load_config(config_path):
    with open(config_path, "r") as f:
        return json.load(f)

def extract_candidate_numbers(text):
    tokens = re.findall(r'\d{1,2}', text)
    for i in range(len(tokens) - 2):
        try:
            y, m, d = int(tokens[i]), int(tokens[i+1]), int(tokens[i+2])
            if 70 <= y <= 99 and 1 <= m <= 12 and 1 <= d <= 31:
                return f"19{y}-{m:02d}-{d:02d}"
        except ValueError:
            continue
    return None

def run_ocr_on_image(img):
    return pytesseract.image_to_string(
        img,
        config="--psm 6 -l 7seg -c tessedit_char_whitelist='0123456789 '"
    )

def binarize(img):
    return cv2.adaptiveThreshold(
        img, 255,
        cv2.ADAPTIVE_THRESH_MEAN_C,
        cv2.THRESH_BINARY,
        15,
        2
    )

def isolate_color_and_crop(img_bgr, config):
    h_range = (
        int(config["hue_range"]["min"] / 360 * 179),
        int(config["hue_range"]["max"] / 360 * 179),
    )
    s_range = (
        int(config["saturation_range"]["min"] / 100 * 255),
        int(config["saturation_range"]["max"] / 100 * 255),
    )
    v_range = (
        int(config["value_range"]["min"] / 100 * 255),
        int(config["value_range"]["max"] / 100 * 255),
    )

    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    lower = np.array([h_range[0], s_range[0], v_range[0]], dtype=np.uint8)
    upper = np.array([h_range[1], s_range[1], v_range[1]], dtype=np.uint8)
    mask = cv2.inRange(hsv, lower, upper)

    filtered = cv2.bitwise_and(img_bgr, img_bgr, mask=mask)
    gray = cv2.cvtColor(filtered, cv2.COLOR_BGR2GRAY)

    h, w = gray.shape
    left = int(config["crop"]["left"] / 100 * w)
    right = int(config["crop"]["right"] / 100 * w)
    top = int(config["crop"]["top"] / 100 * h)
    bottom = int(config["crop"]["bottom"] / 100 * h)
    cropped = gray[top:bottom, left:right]

    return cropped, mask, gray

def extract_date(image_path, config, debug=False, debug_dir=None):
    img_color = cv2.imread(str(image_path))
    if img_color.shape[0] > img_color.shape[1]:
        img_color = cv2.rotate(img_color, cv2.ROTATE_90_CLOCKWISE)
    img_name = Path(image_path).name

    roi, mask, filtered_gray = isolate_color_and_crop(img_color, config)

    if debug and debug_dir:
        cv2.imwrite(debug_dir / f"{img_name}_mask.jpg", mask)
        cv2.imwrite(debug_dir / f"{img_name}_filtered.jpg", filtered_gray)
        cv2.imwrite(debug_dir / f"{img_name}_roi.jpg", roi)

    text = run_ocr_on_image(roi)
    date = extract_candidate_numbers(text)
    if date:
        print(f"✓ {img_name}: Date from original → {date}")
        return date

    roi_bin = binarize(roi)
    if debug and debug_dir:
        cv2.imwrite(debug_dir / f"{img_name}_binarized.jpg", roi_bin)

    text_bin = run_ocr_on_image(roi_bin)
    date = extract_candidate_numbers(text_bin)
    if date:
        print(f"✓ {img_name}: Date from binarized → {date}")
        return date

    print(f"✗ {img_name}: No valid date found.")
    return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("folder", help="Folder containing images")
    parser.add_argument("--config", default="config.json", help="Path to config file")
    parser.add_argument("--debug", action="store_true", help="Save debug output images")
    args = parser.parse_args()

    folder = Path(args.folder)
    if not folder.exists() or not folder.is_dir():
        print(f"Invalid folder: {folder}")
        sys.exit(1)

    config = load_config(args.config)

    debug_dir = Path("debug_output") if args.debug else None
    if debug_dir:
        debug_dir.mkdir(exist_ok=True)

    image_files = list(folder.glob("*.jpg")) + list(folder.glob("*.jpeg")) + list(folder.glob("*.png"))
    if not image_files:
        print("No images found.")
        sys.exit(0)

    print(f"📂 Processing {len(image_files)} image(s)...")

    results = []
    for img_path in image_files:
        date = extract_date(img_path, config, debug=args.debug, debug_dir=debug_dir)
        results.append({
            "filename": img_path.name,
            "date": date
        })

    with open("output.json", "w") as f:
        json.dump(results, f, indent=2)
    print("🧾 Results saved to output.json")

if __name__ == "__main__":
    main()
