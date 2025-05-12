import { WorkerPool } from './workerPool.js';
const pool = new WorkerPool('filterWorker.js', 12); // adjust pool size if needed

window.addEventListener('beforeunload', () => {
  pool.terminate();
});


// === Element References ===
const imageInput = document.getElementById('imageInput');
const jsonInput = document.getElementById('jsonInput');
const imageGrid = document.getElementById('imageGrid');
const jsonOutput = document.getElementById('jsonOutput');
const toggleViewBtn = document.getElementById('toggleView');
const exportJsonBtn = document.getElementById('exportJson');

const hueSlider = document.getElementById('hueSlider');
const satSlider = document.getElementById('satSlider');
const valSlider = document.getElementById('valSlider');

const hueInvert = document.getElementById('hueInvert');
const satInvert = document.getElementById('satInvert');
const valInvert = document.getElementById('valInvert');
const cropLRSlider = document.getElementById('cropLRSlider');
const cropTBSlider = document.getElementById('cropTBSlider');

let isListView = false;
let metadataMap = {};
let imageCache = new Map();

// === Slider Setup ===
noUiSlider.create(hueSlider, {
  start: [267, 345], step: 1,
  range: { min: 0, max: 360 },
  tooltips: true, behaviour: 'drag',
});
noUiSlider.create(satSlider, {
  start: [3, 100], step: 1,
  range: { min: 0, max: 100 },
  connect: true, tooltips: true
});
noUiSlider.create(valSlider, {
  start: [12, 100], step: 1,
  range: { min: 0, max: 100 },
  connect: true, tooltips: true
});
noUiSlider.create(cropLRSlider, {
  start: [72, 100], step: 1,
  range: { min: 0, max: 100 },
  connect: true, tooltips: true
});
noUiSlider.create(cropTBSlider, {
  start: [80, 100], step: 1,
  range: { min: 0, max: 100 },
  connect: true, tooltips: true,
  // orientation: 'vertical',
  // height: '400px'
});

function formatDisplay(val) {
  return val.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
}
function unformatDisplay(val) {
  return val.replace(/-/g, '');
}

function updateJSONOutput() {
  const [hMin, hMax] = hueSlider.noUiSlider.get().map(Number);
  const [sMin, sMax] = satSlider.noUiSlider.get().map(Number);
  const [vMin, vMax] = valSlider.noUiSlider.get().map(Number);
  const [cropLeft, cropRight] = cropLRSlider.noUiSlider.get().map(Number);
  const [cropTop, cropBottom] = cropTBSlider.noUiSlider.get().map(Number);
  jsonOutput.value = JSON.stringify({
    hue_range: { min: hMin, max: hMax },
    saturation_range: { min: sMin, max: sMax },
    value_range: { min: vMin, max: vMax },
    crop: { left: cropLeft, right: cropRight, top: cropTop, bottom: cropBottom }
  }, null, 2);
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, (max === 0 ? 0 : d / max) * 100, max * 100];
}

async function applyFilter(canvas, ctx, img) {
  const [hMin, hMax] = hueSlider.noUiSlider.get().map(Number);
  const [sMin, sMax] = satSlider.noUiSlider.get().map(Number);
  const [vMin, vMax] = valSlider.noUiSlider.get().map(Number);
  const [cropLeft, cropRight] = cropLRSlider.noUiSlider.get().map(Number);
  const [cropTop, cropBottom] = cropTBSlider.noUiSlider.get().map(Number);

  const offCanvas = document.createElement('canvas');
  const offCtx = offCanvas.getContext('2d');

  if (img.height > img.width) {
    offCanvas.width = img.height;
    offCanvas.height = img.width;
    offCtx.save();
    offCtx.translate(offCanvas.width / 2, offCanvas.height / 2);
    offCtx.rotate(Math.PI / 2);
    offCtx.drawImage(img, -img.width / 2, -img.height / 2);
    offCtx.restore();
  } else {
    offCanvas.width = img.width;
    offCanvas.height = img.height;
    offCtx.drawImage(img, 0, 0);
  }

  const rotatedImg = offCanvas;

  // const rotatedImg = new Image();
  // rotatedImg.src = offCanvas.toDataURL();
  // await new Promise(resolve => rotatedImg.onload = resolve);

  const xStart = Math.floor(rotatedImg.width * cropLeft / 100);
  const xEnd = Math.floor(rotatedImg.width * cropRight / 100);
  const yStart = Math.floor(rotatedImg.height * cropTop / 100);
  const yEnd = Math.floor(rotatedImg.height * cropBottom / 100);
  const cropWidth = xEnd - xStart;
  const cropHeight = yEnd - yStart;
  const scale = 300 / Math.max(cropWidth, cropHeight);

  canvas.width = cropWidth * scale;
  canvas.height = cropHeight * scale;

  ctx.drawImage(rotatedImg, xStart, yStart, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const bufferCopy = new Uint8ClampedArray(imageData.data).buffer;

  const result = await pool.runTask({
    data: bufferCopy,
    width: canvas.width,
    height: canvas.height,
    hMin, hMax, sMin, sMax, vMin, vMax,
    hueInvert: hueInvert.checked,
    satInvert: satInvert.checked,
    valInvert: valInvert.checked
  });

  imageData.data.set(new Uint8ClampedArray(result.data));
  ctx.putImageData(imageData, 0, 0);
}

let prevValue = "";

function renderImage(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = async () => {
      const container = document.createElement('div');
      const canvas = document.createElement('canvas');
      canvas.dataset.source = img.src;
      container.appendChild(canvas);

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      await applyFilter(canvas, ctx, img);

      if (isListView) {

        const title = document.createElement('span');
        title.innerText = file.name;
        container.appendChild(title);

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'yyyy-MM-dd';
        const date = metadataMap[file.name]?.date;
        input.value = date ? formatDisplay(date.replace(/-/g, '')) : '';

        input.addEventListener('focus', e => {
          if (e.target.value == "") e.target.value = prevValue;
          e.target.value = unformatDisplay(e.target.value);
          e.target.select();
        });

        input.addEventListener('blur', () => {
          let val = input.value.replace(/-/g, '');
          if (val.length === 6) {
            const year = new Date().getFullYear() % 100;
            val = (parseInt(val.slice(0, 2)) > year ? '19' : '20') + val;
          }
          if (/^\d{8}$/.test(val)) {
            input.value = formatDisplay(val);
            metadataMap[file.name] = { ...metadataMap[file.name], date: input.value, dirty: true };
          }

          prevValue = val;
        });
        container.appendChild(input);
      }

      imageGrid.appendChild(container);

      canvas.addEventListener('mouseenter', () => {
        const tempCtx = canvas.getContext('2d');
        const hoverImg = imageCache.get(canvas.dataset.source);
        if (!hoverImg) return;

        const [cropLeft, cropRight] = cropLRSlider.noUiSlider.get().map(Number);
        const [cropTop, cropBottom] = cropTBSlider.noUiSlider.get().map(Number);

        const offCanvas = document.createElement('canvas');
        const offCtx = offCanvas.getContext('2d');

        let rotatedWidth, rotatedHeight;

        if (hoverImg.height > hoverImg.width) {
          rotatedWidth = hoverImg.height;
          rotatedHeight = hoverImg.width;
          offCanvas.width = rotatedWidth;
          offCanvas.height = rotatedHeight;
          offCtx.save();
          offCtx.translate(rotatedWidth / 2, rotatedHeight / 2);
          offCtx.rotate(Math.PI / 2);
          offCtx.drawImage(hoverImg, -hoverImg.width / 2, -hoverImg.height / 2);
          offCtx.restore();
        } else {
          rotatedWidth = hoverImg.width;
          rotatedHeight = hoverImg.height;
          offCanvas.width = rotatedWidth;
          offCanvas.height = rotatedHeight;
          offCtx.drawImage(hoverImg, 0, 0);
        }

        const xStart = Math.floor(rotatedWidth * cropLeft / 100);
        const xEnd = Math.floor(rotatedWidth * cropRight / 100);
        const yStart = Math.floor(rotatedHeight * cropTop / 100);
        const yEnd = Math.floor(rotatedHeight * cropBottom / 100);
        const cropWidth = xEnd - xStart;
        const cropHeight = yEnd - yStart;
        const scale = 300 / Math.max(cropWidth, cropHeight);

        canvas.width = cropWidth * scale;
        canvas.height = cropHeight * scale;

        tempCtx.drawImage(
          offCanvas,
          xStart, yStart, cropWidth, cropHeight,
          0, 0, canvas.width, canvas.height
        );
      });

      canvas.addEventListener('mouseleave', async () => {
        const ctx = canvas.getContext('2d');
        const img = imageCache.get(canvas.dataset.source);
        if (img) await applyFilter(canvas, ctx, img);
      });

      imageCache.set(img.src, img);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function onSlidersUpdate() {
  updateJSONOutput();
  const canvases = Array.from(imageGrid.querySelectorAll('canvas'));

  await Promise.all(
    canvases.map(async canvas => {
      const ctx = canvas.getContext('2d');
      const img = imageCache.get(canvas.dataset.source);
      if (img) await applyFilter(canvas, ctx, img);
    })
  );

}

[hueSlider, satSlider, valSlider, cropLRSlider, cropTBSlider].forEach(sl => {
  sl.noUiSlider.on('update', () => {
    clearTimeout(window.sliderTimer);
    window.sliderTimer = setTimeout(onSlidersUpdate, 200);
  });
});
function updateHueMask() {
  const [start, end] = hueSlider.noUiSlider.get().map(Number);
  const startPct = (start / 360) * 100;
  const endPct = (end / 360) * 100;

  const connect = hueSlider.querySelector('.noUi-connects');

  if (hueInvert.checked) {
    connect.style.maskImage = `linear-gradient(to right, 
      black ${startPct}%, 
      transparent ${startPct}%, 
      transparent ${endPct}%, 
      black ${endPct}%)`;
  } else {
    connect.style.maskImage = `linear-gradient(to right, 
      transparent ${startPct}%, 
      black ${startPct}%, 
      black ${endPct}%, 
      transparent ${endPct}%)`;
  }
}

// Attach event listeners
[hueInvert, satInvert, valInvert].forEach(cb => {
  cb.addEventListener('change', () => {
    clearTimeout(window.sliderTimer);
    window.sliderTimer = setTimeout(onSlidersUpdate, 200);

    if (cb === hueInvert) updateHueMask(); // Update mask immediately
  });
});

hueSlider.noUiSlider.on('update', updateHueMask);


// === Extra Event Bindings ===
toggleViewBtn.addEventListener('click', () => {
  isListView = !isListView;
  imageGrid.className = isListView ? 'image-list' : 'image-grid';
  if (imageInput.files.length > 0) {
    imageGrid.innerHTML = '';
    if (isListView)
      imageGrid.classList.add('image-container');

    Array.from(imageInput.files).forEach((file, i) => setTimeout(() => renderImage(file), i * 20));
  }
});

exportJsonBtn.addEventListener('click', () => {
  const data = Object.entries(metadataMap).map(([filename, { date }]) => ({ filename, date }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'updated_metadata.json';
  a.click();
  URL.revokeObjectURL(url);
});

jsonInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const entries = JSON.parse(evt.target.result);
      entries.forEach(entry => metadataMap[entry.filename] = { date: entry.date, dirty: false });
    } catch (e) {
      alert('Invalid JSON file');
    }
  };
  reader.readAsText(file);
});

imageInput.addEventListener('change', e => {
  if (e.target.files.length > 0) {
    imageGrid.innerHTML = '';
    if (isListView)
      imageGrid.classList.add('image-container');

    Array.from(e.target.files).forEach((file, i) => setTimeout(() => renderImage(file), i * 20));
    updateJSONOutput();
  }
});

fetch('config.json')
  .then(res => res.json())
  .then(cfg => {
    hueSlider.noUiSlider.set([cfg.hue_range.min, cfg.hue_range.max]);
    satSlider.noUiSlider.set([cfg.saturation_range.min, cfg.saturation_range.max]);
    valSlider.noUiSlider.set([cfg.value_range.min, cfg.value_range.max]);
    cropLRSlider.noUiSlider.set([cfg.crop.left, cfg.crop.right]);
    cropTBSlider.noUiSlider.set([cfg.crop.top, cfg.crop.bottom]);
    updateJSONOutput();
  });