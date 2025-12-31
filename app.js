const fileInput = document.getElementById("fileInput");
const thumbs = document.getElementById("thumbs");
const layoutSelect = document.getElementById("layoutSelect");
const sizeSelect = document.getElementById("sizeSelect");
const formatSelect = document.getElementById("formatSelect");
const smartOrientToggle = document.getElementById("smartOrientToggle");
const smartStatus = document.getElementById("smartStatus");
const gapInput = document.getElementById("gapInput");
const bgInput = document.getElementById("bgInput");
const renderBtn = document.getElementById("renderBtn");
const downloadBtn = document.getElementById("downloadBtn");
const canvas = document.getElementById("collageCanvas");
const ctx = canvas.getContext("2d");

let images = [];
let originalImages = [];
let isOrienting = false;
let faceDetectorPromise = null;
const landscapeCache = new WeakMap();
const smartCache = new WeakMap();

async function loadImages(files) {
  const fileArray = Array.from(files || []);
  if (!fileArray.length) return;

  images = [];
  originalImages = [];
  thumbs.innerHTML = "";

  const readers = fileArray.map((file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    })
  );

  try {
    const loaded = await Promise.all(readers);
    originalImages = loaded;
    loaded.forEach((img) => {
      const thumb = document.createElement("img");
      thumb.src = img.src;
      thumbs.appendChild(thumb);
    });
    await applySmartOrientation();
  } catch (error) {
    console.error("Error cargando imágenes", error);
  }
}

function getCanvasSize() {
  if (sizeSelect.value === "letter") {
    return { width: 2550, height: 3300 };
  }

  const size = Number(sizeSelect.value);
  return { width: size, height: size };
}

function getLeftMarginPx() {
  if (sizeSelect.value !== "letter") {
    return 0;
  }

  const pixelsPerInch = 300;
  const centimetersPerInch = 2.54;
  const marginCm = 0.5;
  return Math.round((marginCm / centimetersPerInch) * pixelsPerInch);
}

function getLayoutConfig() {
  const layout = layoutSelect.value;
  if (layout === "auto") return { auto: true };
  if (layout === "2x2") return { rows: 2, cols: 2 };
  if (layout === "3x3") return { rows: 3, cols: 3 };
  if (layout === "1x3") return { rows: 3, cols: 1 };
  if (layout === "3x1") return { rows: 1, cols: 3 };
  return { rows: 2, cols: 2, mosaic: true };
}

function getAutoGrid(count, width, height) {
  if (count <= 1) return { rows: 1, cols: 1 };
  if (count === 5) return { rows: 2, cols: 3 };

  const targetRatio = width / height;
  let best = { rows: 1, cols: count, score: Number.NEGATIVE_INFINITY };

  for (let rows = 1; rows <= count; rows += 1) {
    const cols = Math.ceil(count / rows);
    const gridRatio = cols / rows;
    const empty = rows * cols - count;
    const cellW = width / cols;
    const cellH = height / rows;
    const areaScore = cellW * cellH;
    const ratioScore = -Math.abs(Math.log(gridRatio / targetRatio)) * 5000;
    const emptyPenalty = empty * 20000;
    const score = areaScore + ratioScore - emptyPenalty;

    if (score > best.score) {
      best = { rows, cols, score };
    }
  }

  return { rows: best.rows, cols: best.cols };
}

function drawImageCover(img, x, y, w, h) {
  const ratio = Math.max(w / img.width, h / img.height);
  const nw = img.width * ratio;
  const nh = img.height * ratio;
  const nx = x + (w - nw) / 2;
  const ny = y + (h - nh) / 2;
  ctx.drawImage(img, nx, ny, nw, nh);
}

function getLandscapeSource(img) {
  if (img.width >= img.height) {
    return img;
  }

  const cached = landscapeCache.get(img);
  if (cached) {
    return cached;
  }

  const rotated = document.createElement("canvas");
  rotated.width = img.height;
  rotated.height = img.width;
  const rctx = rotated.getContext("2d");
  rctx.translate(rotated.width / 2, rotated.height / 2);
  rctx.rotate(Math.PI / 2);
  rctx.drawImage(img, -img.width / 2, -img.height / 2);
  landscapeCache.set(img, rotated);
  return rotated;
}

function createRotatedCanvas(source, rotationDeg) {
  const rotation = ((rotationDeg % 360) + 360) % 360;
  const needsSwap = rotation === 90 || rotation === 270;
  const canvas = document.createElement("canvas");
  canvas.width = needsSwap ? source.height : source.width;
  canvas.height = needsSwap ? source.width : source.height;
  const rctx = canvas.getContext("2d");
  rctx.translate(canvas.width / 2, canvas.height / 2);
  rctx.rotate((rotation * Math.PI) / 180);
  rctx.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

async function ensureFaceDetector() {
  if (faceDetectorPromise) {
    return faceDetectorPromise;
  }

  if (!window.faceDetection || !window.tf) {
    smartStatus.textContent =
      "Orientación inteligente: no disponible (faltan librerías).";
    return null;
  }

  smartStatus.textContent = "Orientación inteligente: cargando detector...";
  faceDetectorPromise = window.faceDetection
    .createDetector(window.faceDetection.SupportedModels.MediaPipeFaceDetector, {
      runtime: "tfjs",
      maxFaces: 1,
    })
    .then((detector) => {
      smartStatus.textContent =
        "Orientación inteligente: detector listo. Analizando fotos.";
      return detector;
    })
    .catch((error) => {
      console.error("Error cargando detector", error);
      smartStatus.textContent =
        "Orientación inteligente: no disponible (error de carga).";
      return null;
    });

  return faceDetectorPromise;
}

async function detectFaceScore(detector, source) {
  try {
    const detections = await detector.estimateFaces(source, {
      flipHorizontal: false,
    });
    if (!detections || !detections.length) {
      return 0;
    }
    const score = detections.reduce(
      (sum, detection) => sum + (detection.score || 0),
      0
    );
    return score;
  } catch (error) {
    console.error("Error detectando rostros", error);
    return 0;
  }
}

async function getSmartOrientedSource(img) {
  if (smartCache.has(img)) {
    return smartCache.get(img);
  }

  const detector = await ensureFaceDetector();
  if (!detector) {
    const fallback = getLandscapeSource(img);
    smartCache.set(img, fallback);
    return fallback;
  }

  const rotations = [0, 90, 180, 270];
  let best = { score: -1, canvas: img };

  for (const rotation of rotations) {
    const rotated = createRotatedCanvas(img, rotation);
    const score = await detectFaceScore(detector, rotated);
    if (score > best.score) {
      best = { score, canvas: rotated };
    }
  }

  let oriented = best.canvas;
  if (oriented.width < oriented.height) {
    oriented = createRotatedCanvas(oriented, 90);
  }

  smartCache.set(img, oriented);
  return oriented;
}

async function applySmartOrientation() {
  if (!originalImages.length) {
    return;
  }

  if (!smartOrientToggle.checked) {
    images = originalImages.map((img) => getLandscapeSource(img));
    smartStatus.textContent =
      "Orientación inteligente: desactivada. Usando horizontal estándar.";
    return;
  }

  isOrienting = true;
  smartStatus.textContent = "Orientación inteligente: analizando fotos...";
  const oriented = [];

  for (const img of originalImages) {
    // eslint-disable-next-line no-await-in-loop
    const orientedImg = await getSmartOrientedSource(img);
    oriented.push(orientedImg);
  }

  images = oriented;
  isOrienting = false;
  smartStatus.textContent = "Orientación inteligente: lista.";
}

function renderCollage() {
  if (!images.length) return;
  if (isOrienting) {
    alert("Espera a que termine la orientación inteligente.");
    return;
  }

  const { width, height } = getCanvasSize();
  canvas.width = width;
  canvas.height = height;

  const gap = Math.max(6, Number(gapInput.value));
  const leftMargin = getLeftMarginPx();
  const availableWidth = width - leftMargin;
  const bg = bgInput.value;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const config = getLayoutConfig();

  if (config.mosaic) {
    const slots = [
      { x: 0, y: 0, w: 0.6, h: 0.6 },
      { x: 0.62, y: 0, w: 0.38, h: 0.35 },
      { x: 0.62, y: 0.37, w: 0.38, h: 0.23 },
      { x: 0, y: 0.62, w: 0.31, h: 0.38 },
      { x: 0.33, y: 0.62, w: 0.67, h: 0.38 },
    ];

    slots.slice(0, images.length).forEach((slot, index) => {
      const img = getLandscapeSource(images[index]);
      const x = leftMargin + slot.x * availableWidth + gap / 2;
      const y = slot.y * height + gap / 2;
      const w = slot.w * availableWidth - gap;
      const h = slot.h * height - gap;
      drawImageCover(img, x, y, w, h);
    });

    downloadBtn.disabled = false;
    return;
  }

  const layout =
    config.auto ? getAutoGrid(images.length, availableWidth, height) : config;
  const { rows, cols } = layout;
  const cellW = (availableWidth - gap * (cols + 1)) / cols;
  const cellH = (height - gap * (rows + 1)) / rows;
  const gridWidth = cols * cellW + gap * (cols + 1);
  const startX = leftMargin + Math.max(0, availableWidth - gridWidth);

  if (cellW <= 0 || cellH <= 0) {
    alert("no se puede escalar");
    return;
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      if (index >= images.length) {
        continue;
      }
      const img = getLandscapeSource(images[index]);
      const x = startX + gap + col * (cellW + gap);
      const y = gap + row * (cellH + gap);
      drawImageCover(img, x, y, cellW, cellH);
    }
  }

  downloadBtn.disabled = false;
}

function downloadCollage() {
  const format = formatSelect.value;
  if (format === "pdf" && window.jspdf) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: canvas.width >= canvas.height ? "l" : "p",
      unit: "px",
      format: [canvas.width, canvas.height],
    });
    const data = canvas.toDataURL("image/jpeg", 0.95);
    pdf.addImage(data, "JPEG", 0, 0, canvas.width, canvas.height);
    pdf.save("collage-carta.pdf");
    return;
  }

  const link = document.createElement("a");
  link.download = "collage.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

fileInput.addEventListener("change", (event) => {
  loadImages(event.target.files);
});

renderBtn.addEventListener("click", renderCollage);

downloadBtn.addEventListener("click", downloadCollage);

smartOrientToggle.addEventListener("change", () => {
  applySmartOrientation();
});

const uploadLabel = document.querySelector(".upload");

["dragenter", "dragover"].forEach((eventName) => {
  uploadLabel.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadLabel.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  uploadLabel.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadLabel.classList.remove("dragging");
  });
});

uploadLabel.addEventListener("drop", (event) => {
  loadImages(event.dataTransfer.files);
});

renderBtn.addEventListener("click", () => {
  if (!images.length) {
    alert("Primero debes cargar algunas fotos.");
  }
});
