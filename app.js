const fileInput = document.getElementById("fileInput");
const thumbs = document.getElementById("thumbs");
const layoutSelect = document.getElementById("layoutSelect");
const sizeSelect = document.getElementById("sizeSelect");
const formatSelect = document.getElementById("formatSelect");
const gapInput = document.getElementById("gapInput");
const bgInput = document.getElementById("bgInput");
const renderBtn = document.getElementById("renderBtn");
const downloadBtn = document.getElementById("downloadBtn");
const canvas = document.getElementById("collageCanvas");
const ctx = canvas.getContext("2d");

let images = [];
const landscapeCache = new WeakMap();

function loadImages(files) {
  const fileArray = Array.from(files || []);
  if (!fileArray.length) return;

  images = [];
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

  Promise.all(readers)
    .then((loaded) => {
      images = loaded;
      loaded.forEach((img) => {
        const thumb = document.createElement("img");
        thumb.src = img.src;
        thumbs.appendChild(thumb);
      });
    })
    .catch((error) => {
      console.error("Error cargando imágenes", error);
    });
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

  const targetRatio = width / height;
  let best = { rows: 1, cols: count, score: Number.POSITIVE_INFINITY };

  for (let rows = 1; rows <= count; rows += 1) {
    const cols = Math.ceil(count / rows);
    const gridRatio = cols / rows;
    const empty = rows * cols - count;
    const score = Math.abs(Math.log(gridRatio / targetRatio)) + empty * 0.25;

    if (score < best.score) {
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

function renderCollage() {
  if (!images.length) return;

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

    slots.forEach((slot, index) => {
      const img = getLandscapeSource(images[index % images.length]);
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

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      const img = getLandscapeSource(images[index % images.length]);
      const x = leftMargin + gap + col * (cellW + gap);
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
