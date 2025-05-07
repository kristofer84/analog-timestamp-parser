# 7-Segment Photo Date Parser & EXIF Updater

This tool extracts 7-segment-style timestamps from images (e.g., old digital cameras, CCTV), allows manual correction via a visual tool, and updates EXIF `DateTimeOriginal` metadata accordingly.

---

## 🧩 Project Overview

The pipeline consists of **three steps**:

1. **Extract Date Strings (OCR)**  
   Run `dates_to_json.py` to detect and OCR date stamps into `output.json`.

2. **Manual Correction & HSV Tuning**  
   Launch the visual tool in `hsv_filter_tool/` to inspect and correct extracted dates.

3. **Update EXIF Metadata**  
   Use `update_files.py` to write these dates into the image files' EXIF data.

---

## 📦 Installation & Setup

### 1. Python Environment

```bash
python3 -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
```

Create `requirements.txt` with:

```
opencv-python
pytesseract
Pillow
piexif
```

---

### 2. Tesseract OCR

Install Tesseract:

- **Ubuntu**: `sudo apt install tesseract-ocr`
- **macOS (Homebrew)**: `brew install tesseract`
- **Windows**: [UB Mannheim Tesseract](https://github.com/UB-Mannheim/tesseract/wiki)

#### 7-Segment OCR Model

```bash
wget https://github.com/Shreeshrii/tessdata_ssd/raw/refs/heads/master/ssd.traineddata -O 7seg.traineddata
sudo mv 7seg.traineddata /usr/share/tesseract-ocr/5/tessdata/
```

Then verify:

```bash
tesseract --list-langs  # should list '7seg'
```

---

### 3. Web Tool for Manual Review (HSV Filter Tool)

Install and serve with:

```bash
npm install -g http-server
cd hsv_filter_tool
http-server
```

Open your browser to `http://localhost:8080`

---

## 🚀 Usage

### Step 1: Run OCR

```bash
python dates_to_json.py /path/to/image_folder --debug
```

Creates `output.json`.

### Step 2: Manual Review

- Visit `http://localhost:8080`
- Upload:
  - Images
  - `output.json`
- Tune HSV/crop or correct dates manually.
- Click **Export JSON** to download updated metadata.

### Step 3: Update EXIF Dates

```bash
python update_files.py /path/to/updated_metadata.json
```

Optional: `--dry-run` to preview changes.

---

## 📁 Folder Structure

```
.
├── dates_to_json.py
├── update_files.py
├── hsv_filter_tool/
│   ├── index.html
│   ├── script.js
│   ├── style.css
│   └── config.json
└── output.json
```

---

## 📖 License

MIT or similar — you decide.