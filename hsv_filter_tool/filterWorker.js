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
  
  onmessage = function (e) {
    const { data, width, height, hMin, hMax, sMin, sMax, vMin, vMax, hueInvert, satInvert, valInvert } = e.data;
    const pixels = new Uint8ClampedArray(data);
  
    for (let i = 0; i < pixels.length; i += 4) {
      const [h, s, v] = rgbToHsv(pixels[i], pixels[i + 1], pixels[i + 2]);
  
      const hPass = hueInvert ? (h < hMin || h > hMax) : (h >= hMin && h <= hMax);
      const sPass = satInvert ? (s < sMin || s > sMax) : (s >= sMin && s <= sMax);
      const vPass = valInvert ? (v < vMin || v > vMax) : (v >= vMin && v <= vMax);
  
      if (!(hPass && sPass && vPass)) {
        pixels[i + 3] = 0; // make transparent
      }
    }
  
    postMessage({ data: pixels.buffer }, [pixels.buffer]);
  };
  