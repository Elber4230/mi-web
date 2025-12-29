const bands = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const presets = {
  flat: Array(10).fill(0),
  rock: [4, 3, 2, 1, -1, -1, 1, 3, 4, 5],
  bass: [6, 5, 3, 1, 0, -1, -1, -1, -2, -2],
  rb: [5, 4, 2, 1, 0, 1, 2, 1, 0, -1],
  vallenato: [3, 2, 1, 0, 1, 2, 3, 2, 1, 0],
  pop: [2, 1, 0, 1, 2, 2, 1, 0, 1, 2],
};

const presetLabels = {
  flat: "Flat",
  rock: "Rock",
  bass: "Bass Boost",
  rb: "R&B",
  vallenato: "Vallenato",
  pop: "Pop",
};

const state = {
  context: null,
  source: null,
  sourceType: "file",
  masterGain: null,
  filters: [],
  gains: Array(10).fill(0),
  bypass: false,
  currentPreset: "flat",
  currentUrl: null,
  mediaStream: null,
  bandControls: [],
};

const audioElement = document.getElementById("audio");
const fileInput = document.getElementById("audio-file");
const fileUpload = document.getElementById("file-upload");
const micToggle = document.getElementById("mic-toggle");
const sourceFileButton = document.getElementById("source-file");
const sourceMicButton = document.getElementById("source-mic");
const bandsContainer = document.getElementById("bands");
const statusText = document.getElementById("status-text");
const presetText = document.getElementById("preset-text");
const bypassToggle = document.getElementById("bypass-toggle");
const masterGainSlider = document.getElementById("master-gain");
const masterGainValue = document.getElementById("master-value");
const warningNotice = document.getElementById("warning-notice");

const formatFrequency = (frequency) =>
  frequency >= 1000 ? `${frequency / 1000}kHz` : `${frequency}Hz`;

const setStatus = (message, { warning = false } = {}) => {
  statusText.textContent = message;
  statusText.classList.toggle("status--warning", warning);
};

const showNotice = (message) => {
  if (!warningNotice) {
    return;
  }
  warningNotice.textContent = message;
  warningNotice.hidden = false;
};

const hideNotice = () => {
  if (!warningNotice) {
    return;
  }
  warningNotice.hidden = true;
};

const disableControls = () => {
  fileInput.disabled = true;
  bypassToggle.disabled = true;
  masterGainSlider.disabled = true;
  micToggle.disabled = true;
  sourceFileButton.disabled = true;
  sourceMicButton.disabled = true;
  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.disabled = true;
  });
  state.bandControls.forEach((control) => {
    control.slider.disabled = true;
  });
};

const setActiveSourceButton = (activeButton, inactiveButton) => {
  activeButton.classList.add("btn--active");
  activeButton.classList.remove("btn--ghost");
  inactiveButton.classList.remove("btn--active");
  inactiveButton.classList.add("btn--ghost");
};

const ensureAudioContext = () => {
  if (!window.AudioContext && !window.webkitAudioContext) {
    setStatus("Este navegador no soporta Web Audio API.", { warning: true });
    disableControls();
    return false;
  }

  if (!state.context) {
    state.context = new (window.AudioContext || window.webkitAudioContext)();
    createFilters();
    state.masterGain = state.context.createGain();
    state.masterGain.gain.value = 1;
  }
  if (state.context.state === "suspended") {
    state.context.resume();
  }
  return true;
};

const createFilters = () => {
  state.filters = bands.map((frequency) => {
    const filter = state.context.createBiquadFilter();
    filter.type = "peaking";
    filter.frequency.value = frequency;
    filter.Q.value = 1.1;
    filter.gain.value = 0;
    return filter;
  });
};

const connectAudioGraph = () => {
  if (!state.context) {
    return;
  }
  if (!state.source) {
    if (state.sourceType === "mic" && state.mediaStream) {
      state.source = state.context.createMediaStreamSource(state.mediaStream);
    } else if (state.sourceType === "file") {
      state.source = state.context.createMediaElementSource(audioElement);
    } else {
      return;
    }
  }

  state.source.disconnect();
  state.filters.forEach((filter) => filter.disconnect());
  state.masterGain.disconnect();

  if (state.bypass) {
    state.source.connect(state.context.destination);
    return;
  }

  let currentNode = state.source;
  state.filters.forEach((filter) => {
    currentNode.connect(filter);
    currentNode = filter;
  });
  currentNode.connect(state.masterGain);
  state.masterGain.connect(state.context.destination);
};

const renderBands = () => {
  bandsContainer.innerHTML = "";
  state.bandControls = [];
  bands.forEach((frequency, index) => {
    const band = document.createElement("div");
    band.className = "band";

    const freqLabel = document.createElement("div");
    freqLabel.className = "band__freq";
    freqLabel.textContent = formatFrequency(frequency);

    const sliderWrapper = document.createElement("div");
    sliderWrapper.className = "band__slider";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "-12";
    slider.max = "12";
    slider.step = "0.5";
    slider.value = state.gains[index];

    const valueLabel = document.createElement("div");
    valueLabel.className = "band__value";
    valueLabel.textContent = `${state.gains[index]} dB`;

    slider.addEventListener("input", (event) => {
      const value = Number(event.target.value);
      state.gains[index] = value;
      valueLabel.textContent = `${value} dB`;
      if (state.filters[index]) {
        state.filters[index].gain.value = value;
      }
    });

    sliderWrapper.appendChild(slider);
    sliderWrapper.appendChild(valueLabel);

    band.appendChild(freqLabel);
    band.appendChild(sliderWrapper);

    bandsContainer.appendChild(band);
    state.bandControls.push({ slider, valueLabel });
  });
};

const applyPreset = (presetKey) => {
  if (presetKey === "reset") {
    state.gains = Array(10).fill(0);
    state.currentPreset = "flat";
  } else if (presets[presetKey]) {
    state.gains = [...presets[presetKey]];
    state.currentPreset = presetKey;
  }

  state.filters.forEach((filter, index) => {
    filter.gain.value = state.gains[index];
  });
  state.bandControls.forEach((control, index) => {
    control.slider.value = state.gains[index];
    control.valueLabel.textContent = `${state.gains[index]} dB`;
  });
  const label = presetLabels[state.currentPreset] || state.currentPreset.toUpperCase();
  presetText.textContent = `Preset: ${label}`;
};

const setSourceType = async (sourceType) => {
  if (state.sourceType === sourceType) {
    return;
  }
  state.sourceType = sourceType;
  if (state.source) {
    state.source.disconnect();
    state.source = null;
  }
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach((track) => track.stop());
    state.mediaStream = null;
  }

  if (sourceType === "mic") {
    fileUpload.hidden = true;
    micToggle.hidden = false;
    audioElement.pause();
    audioElement.removeAttribute("src");
    audioElement.load();
    setActiveSourceButton(sourceMicButton, sourceFileButton);
    setStatus("Micrófono listo. Actívalo para comenzar.");
    return;
  }

  fileUpload.hidden = false;
  micToggle.hidden = true;
  setActiveSourceButton(sourceFileButton, sourceMicButton);
  setStatus("Carga un archivo para comenzar.");
};

const startMicrophone = async () => {
  if (!ensureAudioContext()) {
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus("El navegador no permite acceso al micrófono.", { warning: true });
    return;
  }
  if (!window.isSecureContext) {
    showNotice(
      "El micrófono requiere HTTPS o localhost. Abre esta demo en un servidor local."
    );
  }
  try {
    state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (state.source) {
      state.source.disconnect();
      state.source = null;
    }
    connectAudioGraph();
    micToggle.textContent = "Desactivar micrófono";
    micToggle.dataset.active = "true";
    setStatus("Micrófono activo. Ajusta las bandas en tiempo real.");
  } catch (error) {
    setStatus("No se pudo activar el micrófono.", { warning: true });
  }
};

const stopMicrophone = () => {
  if (!state.mediaStream) {
    return;
  }
  state.mediaStream.getTracks().forEach((track) => track.stop());
  state.mediaStream = null;
  if (state.source) {
    state.source.disconnect();
    state.source = null;
  }
  micToggle.textContent = "Activar micrófono";
  micToggle.dataset.active = "false";
  setStatus("Micrófono detenido.");
};

const init = () => {
  renderBands();
  presetText.textContent = "Preset: Flat";

  if (location.protocol === "file:") {
    showNotice(
      "Si el audio no se carga, prueba abrir esta demo con un servidor local (python -m http.server 8000)."
    );
  } else {
    hideNotice();
  }
};

sourceFileButton.addEventListener("click", () => {
  setSourceType("file");
});

sourceMicButton.addEventListener("click", () => {
  setSourceType("mic");
});

micToggle.addEventListener("click", () => {
  const isActive = micToggle.dataset.active === "true";
  if (isActive) {
    stopMicrophone();
  } else {
    startMicrophone();
  }
});

fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (!file) {
    return;
  }
  if (!ensureAudioContext()) {
    return;
  }
  if (state.currentUrl) {
    URL.revokeObjectURL(state.currentUrl);
  }
  const url = URL.createObjectURL(file);
  state.currentUrl = url;
  state.sourceType = "file";
  audioElement.src = url;
  audioElement.load();
  connectAudioGraph();
  setStatus(`Listo para reproducir: ${file.name}`);
});

audioElement.addEventListener("play", () => {
  if (!ensureAudioContext()) {
    return;
  }
  connectAudioGraph();
  setStatus("Reproduciendo con ecualizador activo.");
});

audioElement.addEventListener("pause", () => {
  setStatus("Pausado.");
});

audioElement.addEventListener("ended", () => {
  setStatus("Finalizó la reproducción.");
});

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!ensureAudioContext()) {
      return;
    }
    applyPreset(button.dataset.preset);
    setStatus(`Preset aplicado: ${button.textContent}`);
  });
});

masterGainSlider.addEventListener("input", (event) => {
  const value = Number(event.target.value);
  masterGainValue.textContent = `${value} dB`;
  if (!ensureAudioContext()) {
    return;
  }
  state.masterGain.gain.value = Math.pow(10, value / 20);
});

bypassToggle.addEventListener("change", (event) => {
  state.bypass = event.target.checked;
  if (!ensureAudioContext()) {
    return;
  }
  connectAudioGraph();
  setStatus(state.bypass ? "EQ en bypass." : "EQ activo.");
});

init();
