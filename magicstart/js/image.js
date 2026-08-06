/**
 * Image Upload & Cropping Logic
 *
 * Requirement:
 *  - Skip transparent top rows to find actual content start
 *  - Crop a square from top-of-content with side = image width
 *  - Resize to 300x300
 */
const ImageProcessor = (() => {
  'use strict';

  const OUTPUT_SIZE = 300;

  /**
   * Find the topmost row containing at least one non-transparent pixel.
   * @param {ImageData} imageData
   * @returns {number} y-coordinate of first non-transparent row (0-based)
   */
  function findTopContent(imageData) {
    const { width, height, data } = imageData;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 10) return y;          // threshold to skip near-transparent
      }
    }
    return 0;                               // fully transparent → fallback to 0
  }

  /**
   * Process an uploaded image file.
   *  1. Load as HTMLImageElement
   *  2. Draw full-size on offscreen canvas
   *  3. Find top of non-transparent content
   *  4. Crop square (side = width) from that top row
   *  5. Resize to OUTPUT_SIZE x OUTPUT_SIZE
   *
   * @param {File} file
   * @returns {Promise<string>} base64 data-url of the processed image
   */
  function processFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          try {
            resolve(cropAndResize(img));
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Core crop & resize logic.
   */
  function cropAndResize(img) {
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    /* Step 1: draw full image to read pixel data */
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = w;
    fullCanvas.height = h;
    const fullCtx = fullCanvas.getContext('2d');
    fullCtx.drawImage(img, 0, 0);

    /* Step 2: find top of content */
    const imageData = fullCtx.getImageData(0, 0, w, h);
    const topY = findTopContent(imageData);

    /* Step 3: crop a square from topY, side = w */
    const cropSize = w;
    // Ensure we don't exceed image bounds
    const availableHeight = h - topY;
    const actualCropH = Math.min(cropSize, availableHeight);

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropSize;
    cropCanvas.height = cropSize;
    const cropCtx = cropCanvas.getContext('2d');

    // Fill with transparent in case image is shorter than square
    cropCtx.clearRect(0, 0, cropSize, cropSize);
    cropCtx.drawImage(
      fullCanvas,
      0, topY,              // source x, y
      cropSize, actualCropH, // source w, h
      0, 0,                  // dest x, y
      cropSize, actualCropH  // dest w, h
    );

    /* Step 4: resize to OUTPUT_SIZE */
    const outCanvas = document.createElement('canvas');
    outCanvas.width = OUTPUT_SIZE;
    outCanvas.height = OUTPUT_SIZE;
    const outCtx = outCanvas.getContext('2d');
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = 'high';
    outCtx.drawImage(cropCanvas, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    return outCanvas.toDataURL('image/png');
  }

  /**
   * Load a base64 data-url and return it as-is (for restoring from save).
   */
  function dataUrlToImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Invalid image data'));
      img.src = dataUrl;
    });
  }

  return {
    processFile,
    dataUrlToImage,
    OUTPUT_SIZE,
  };
})();
