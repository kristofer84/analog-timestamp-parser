
const imageInput = document.getElementById('imageInput');
const jsonInput = document.getElementById('jsonInput');
const imageGrid = document.getElementById('imageGrid');
const jsonOutput = document.getElementById('jsonOutput');
const toggleViewBtn = document.getElementById('toggleView');
const exportJsonBtn = document.getElementById('exportJson');

let isListView = false;
let metadataMap = {};
const sliderIds = ['hMin', 'hMax', 'sMin', 'sMax', 'vMin', 'vMax', 'cropLeft', 'cropRight', 'cropTop', 'cropBottom'];
const sliders = sliderIds.map(id => document.getElementById(id));

function formatDisplay(val) {
  return val.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
}
function unformatDisplay(val) {
  return val.replace(/-/g, '');
}

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

function updateJSONOutput() {
  const values = sliders.map(sl => parseInt(sl.value));
  const output = {
    hue_range: { min: values[0], max: values[1] },
    saturation_range: { min: values[2], max: values[3] },
    value_range: { min: values[4], max: values[5] },
    crop: { left: values[6], right: values[7], top: values[8], bottom: values[9] }
  };
  jsonOutput.value = JSON.stringify(output, null, 2);
}

function applyFilter(canvas, ctx, img) {
  const [hMin, hMax, sMin, sMax, vMin, vMax, cropLeft, cropRight, cropTop, cropBottom] = sliders.map(sl => parseInt(sl.value));
  const xStart = Math.floor(img.width * cropLeft / 100), xEnd = Math.floor(img.width * cropRight / 100);
  const yStart = Math.floor(img.height * cropTop / 100), yEnd = Math.floor(img.height * cropBottom / 100);
  const cropWidth = xEnd - xStart, cropHeight = yEnd - yStart;
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

function renderImage(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const container = document.createElement('div');
      const canvas = document.createElement('canvas');

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      container.appendChild(canvas);

      if (isListView) {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'yyyy-MM-dd';
        input.pattern = '\\d{4}-\\d{2}-\\d{2}';
        const date = metadataMap[file.name]?.date;
        input.value = date ? formatDisplay(date.replace(/-/g, '')) : '';

        input.addEventListener('focus', e => {
          e.target.value = unformatDisplay(e.target.value);
          e.target.select();

          const inputs = [...imageGrid.querySelectorAll('input[type="text"]')];
          const idx = inputs.indexOf(e.target);
          if (e.target.value === '' && idx > 0) e.target.value = inputs[idx - 1].value;
        });

        input.addEventListener('keydown', e => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            let val = e.target.value;
            if (!/^\d{6}$/.test(val)) return;
            const y = parseInt(val.slice(0, 2)), m = parseInt(val.slice(2, 4)), d = parseInt(val.slice(4, 6));
            const date = new Date(2000 + y, m - 1, d);
            date.setDate(date.getDate() + (e.key === 'ArrowUp' ? 1 : -1));
            const pad = n => n.toString().padStart(2, '0');
            e.target.value = `${pad(date.getFullYear() % 100)}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
            e.preventDefault();
          }
        });

        input.addEventListener('blur', () => {
          let val = input.value.replace(/-/g, '');
          if (val.length === 6) {
            const year = new Date().toLocaleDateString('en', { year: '2-digit' });
            val = (parseInt(val.substring(0, 2)) > parseInt(year) ? '19' : '20') + val;
          }
          if (/^\d{8}$/.test(val)) {
            input.value = formatDisplay(val);
            metadataMap[file.name] = { ...metadataMap[file.name], date: input.value, dirty: true };
          }
        });

        container.appendChild(input);
      }

      const title = document.createElement('span');
      title.innerText = file.name;
      container.appendChild(title);

      imageGrid.appendChild(container);
      canvas.dataset.source = img.src;


      // Extend canvas with mouseover and orientation handling
      canvas.addEventListener('mouseenter', () => {
        const tempCtx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          const [cropLeft, cropRight, cropTop, cropBottom] = [
            'cropLeft', 'cropRight', 'cropTop', 'cropBottom'
          ].map(id => parseInt(document.getElementById(id).value));
          const xStart = Math.floor(img.width * cropLeft / 100);
          const xEnd = Math.floor(img.width * cropRight / 100);
          const yStart = Math.floor(img.height * cropTop / 100);
          const yEnd = Math.floor(img.height * cropBottom / 100);
          const cropWidth = xEnd - xStart;
          const cropHeight = yEnd - yStart;
          const scale = 300 / Math.max(cropWidth, cropHeight);
          canvas.width = cropWidth * scale;
          canvas.height = cropHeight * scale;

          const rotate = img.height > img.width;
          if (rotate) {
            canvas.width = cropHeight * scale;
            canvas.height = cropWidth * scale;
            tempCtx.save();
            tempCtx.translate(canvas.width / 2, canvas.height / 2);
            tempCtx.rotate(Math.PI / 2);
            tempCtx.translate(-canvas.height / 2, -canvas.width / 2);
            tempCtx.drawImage(img, xStart, yStart, cropWidth, cropHeight, 0, 0, canvas.height, canvas.width);
            tempCtx.restore();
          } else {
            tempCtx.drawImage(img, xStart, yStart, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
          }
        };
        img.src = canvas.dataset.source;
      });

      canvas.addEventListener('mouseleave', () => {
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => applyFilter(canvas, ctx, img);
        img.src = canvas.dataset.source;
      });

      applyFilter(canvas, ctx, img);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

let debounceTimer;
sliders.forEach(sl => sl.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    updateJSONOutput();
    Array.from(imageGrid.querySelectorAll('canvas')).forEach(canvas => {
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => applyFilter(canvas, ctx, img);
      img.src = canvas.dataset.source;
    });
  }, 200);
}));

toggleViewBtn.addEventListener('click', () => {
  isListView = !isListView;
  imageGrid.className = isListView ? 'image-list' : 'image-grid';
  if (imageInput.files.length > 0) {
    imageGrid.innerHTML = '';
    Array.from(imageInput.files).forEach((file, i) => {
      setTimeout(() => renderImage(file), i * 20);
    });
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
    Array.from(e.target.files).forEach((file, i) => setTimeout(() => renderImage(file), i * 20));
    updateJSONOutput();
  }
});

fetch('config.json')
  .then(res => res.json())
  .then(cfg => {
    document.getElementById('hMin').value = cfg.hue_range.min;
    document.getElementById('hMax').value = cfg.hue_range.max;
    document.getElementById('sMin').value = cfg.saturation_range.min;
    document.getElementById('sMax').value = cfg.saturation_range.max;
    document.getElementById('vMin').value = cfg.value_range.min;
    document.getElementById('vMax').value = cfg.value_range.max;
    document.getElementById('cropLeft').value = cfg.crop.left;
    document.getElementById('cropRight').value = cfg.crop.right;
    document.getElementById('cropTop').value = cfg.crop.top;
    document.getElementById('cropBottom').value = cfg.crop.bottom;
    updateJSONOutput();
  });
