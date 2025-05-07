const imageInput = document.getElementById('imageInput');
const jsonInput = document.getElementById('jsonInput');
const imageGrid = document.getElementById('imageGrid');
const jsonOutput = document.getElementById('jsonOutput');
const toggleViewBtn = document.getElementById('toggleView');
const exportJsonBtn = document.getElementById('exportJson');

const hueSlider = document.getElementById('hueSlider');
const satSlider = document.getElementById('satSlider');
const valSlider = document.getElementById('valSlider');
const cropLRSlider = document.getElementById('cropLRSlider');
const cropTBSlider = document.getElementById('cropTBSlider');

let isListView = false;
let metadataMap = {};
let imageCache = new Map();

noUiSlider.create(hueSlider, {
  start: [267, 345],
  step: 1,
  // connect: [false, true, false],
  range: { min: 0, max: 360 },
  tooltips: true,
  behaviour: 'drag',
});

noUiSlider.create(satSlider, {
  start: [3, 100],
  step: 1,
  connect: true,
  range: { min: 0, max: 100 },
  tooltips: true,
});

noUiSlider.create(valSlider, {
  start: [12, 100],
  step: 1,
  connect: true,
  range: { min: 0, max: 100 },
  tooltips: true
});

noUiSlider.create(cropLRSlider, {
  start: [72, 100],
  step: 1,
  connect: true,
  range: { min: 0, max: 100 },
  tooltips: true
});

noUiSlider.create(cropTBSlider, {
  start: [80, 100],
  step: 1,
  connect: true,
  range: { min: 0, max: 100 },
  tooltips: true
});

function updateJSONOutput() {
  const [hMin, hMax] = hueSlider.noUiSlider.get().map(Number);
  const [sMin, sMax] = satSlider.noUiSlider.get().map(Number);
  const [vMin, vMax] = valSlider.noUiSlider.get().map(Number);
  const [cropLeft, cropRight] = cropLRSlider.noUiSlider.get().map(Number);
  const [cropTop, cropBottom] = cropTBSlider.noUiSlider.get().map(Number);

  const output = {
    hue_range: { min: hMin, max: hMax },
    saturation_range: { min: sMin, max: sMax },
    value_range: { min: vMin, max: vMax },
    crop: { left: cropLeft, right: cropRight, top: cropTop, bottom: cropBottom }
  };
  jsonOutput.value = JSON.stringify(output, null, 2);
}

function onSlidersUpdate() {
  updateJSONOutput();
  Array.from(imageGrid.querySelectorAll('canvas')).forEach(canvas => {
    const ctx = canvas.getContext('2d');
    const img = imageCache.get(canvas.dataset.source);
    if (img) applyFilter(canvas, ctx, img);

    // // const img = new Image();
    // img.onload = () => applyFilter(canvas, ctx, img);
    // img.src = canvas.dataset.source;
  });
}

[hueSlider, satSlider, valSlider, cropLRSlider, cropTBSlider].forEach(sl => {
  sl.noUiSlider.on('update', () => {
    clearTimeout(window.sliderTimer);
    window.sliderTimer = setTimeout(onSlidersUpdate, 200);
  });
});

hueSlider.noUiSlider.on('update', (values) => {
  const [start, end] = values.map(Number);
  const startPct = (start / 360) * 100;
  const endPct = (end / 360) * 100;

  const connect = hueSlider.querySelector('.noUi-connects');

  connect.style.maskImage = `linear-gradient(to right, 
    transparent ${startPct}%, 
    black ${startPct}%, 
    black ${endPct}%, 
    transparent ${endPct}%)`;
});


function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, v = max, d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max === min) {
    h = 0;
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, v * 100];
}

function applyFilter(canvas, ctx, img) {
  const [hMin, hMax] = hueSlider.noUiSlider.get().map(Number);
  const [sMin, sMax] = satSlider.noUiSlider.get().map(Number);
  const [vMin, vMax] = valSlider.noUiSlider.get().map(Number);
  const [cropLeft, cropRight] = cropLRSlider.noUiSlider.get().map(Number);
  const [cropTop, cropBottom] = cropTBSlider.noUiSlider.get().map(Number);

  const xStart = Math.floor(img.width * cropLeft / 100);
  const xEnd = Math.floor(img.width * cropRight / 100);
  const yStart = Math.floor(img.height * cropTop / 100);
  const yEnd = Math.floor(img.height * cropBottom / 100);
  const cropWidth = xEnd - xStart;
  const cropHeight = yEnd - yStart;
  const scale = 300 / Math.max(cropWidth, cropHeight);
  canvas.width = cropWidth * scale;
  canvas.height = cropHeight * scale;

  ctx.drawImage(img, xStart, yStart, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const [h, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
    if (h < hMin || h > hMax || s < sMin || s > sMax || v < vMin || v > vMax) {
      data[i + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

imageInput.addEventListener('change', e => {
  if (e.target.files.length > 0) {
    imageGrid.innerHTML = '';
    Array.from(e.target.files).forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const container = document.createElement('div');
          const canvas = document.createElement('canvas');
          canvas.dataset.source = img.src;
          container.appendChild(canvas);
          imageGrid.appendChild(container);

          const ctx = canvas.getContext('2d');
          applyFilter(canvas, ctx, img);
        };
        img.src = e.target.result;
        imageCache.set(img.src, img); // Cache once
      };
      reader.readAsDataURL(file);
    });
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