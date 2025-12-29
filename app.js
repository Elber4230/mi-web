+const bands = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
+const presets = {
+  flat: Array(10).fill(0),
+  rock: [4, 3, 2, 1, -1, -1, 1, 3, 4, 5],
+  bass: [6, 5, 3, 1, 0, -1, -1, -1, -2, -2],
+};
+
+const state = {
+  context: null,
+  source: null,
+  masterGain: null,
+  filters: [],
+  gains: Array(10).fill(0),
+  bypass: false,
+  currentPreset: "flat",
+  currentUrl: null,
+  bandControls: [],
+};
+
+const audioElement = document.getElementById("audio");
+const fileInput = document.getElementById("audio-file");
+const bandsContainer = document.getElementById("bands");
+const statusText = document.getElementById("status-text");
+const presetText = document.getElementById("preset-text");
+const bypassToggle = document.getElementById("bypass-toggle");
+const masterGainSlider = document.getElementById("master-gain");
+const masterGainValue = document.getElementById("master-value");
+
+const formatFrequency = (frequency) =>
+  frequency >= 1000 ? `${frequency / 1000}kHz` : `${frequency}Hz`;
+
+const ensureAudioContext = () => {
+  if (!state.context) {
+    state.context = new (window.AudioContext || window.webkitAudioContext)();
+    createFilters();
+    state.masterGain = state.context.createGain();
+    state.masterGain.gain.value = 1;
+  }
+  if (state.context.state === "suspended") {
+    state.context.resume();
+  }
+};
+
+const createFilters = () => {
+  state.filters = bands.map((frequency) => {
+    const filter = state.context.createBiquadFilter();
+    filter.type = "peaking";
+    filter.frequency.value = frequency;
+    filter.Q.value = 1.1;
+    filter.gain.value = 0;
+    return filter;
+  });
+};
+
+const connectAudioGraph = () => {
+  if (!state.context) {
+    return;
+  }
+  if (!state.source) {
+    state.source = state.context.createMediaElementSource(audioElement);
+  }
+
+  state.source.disconnect();
+  state.filters.forEach((filter) => filter.disconnect());
+  state.masterGain.disconnect();
+
+  if (state.bypass) {
+    state.source.connect(state.context.destination);
+    return;
+  }
+
+  let currentNode = state.source;
+  state.filters.forEach((filter) => {
+    currentNode.connect(filter);
+    currentNode = filter;
+  });
+  currentNode.connect(state.masterGain);
+  state.masterGain.connect(state.context.destination);
+};
+
+const updateStatus = (message) => {
+  statusText.textContent = message;
+};
+
+const renderBands = () => {
+  bandsContainer.innerHTML = "";
+  state.bandControls = [];
+  bands.forEach((frequency, index) => {
+    const band = document.createElement("div");
+    band.className = "band";
+
+    const freqLabel = document.createElement("div");
+    freqLabel.className = "band__freq";
+    freqLabel.textContent = formatFrequency(frequency);
+
+    const sliderWrapper = document.createElement("div");
+    sliderWrapper.className = "band__slider";
+
+    const slider = document.createElement("input");
+    slider.type = "range";
+    slider.min = "-12";
+    slider.max = "12";
+    slider.step = "0.5";
+    slider.value = state.gains[index];
+    slider.dataset.index = index;
+
+    const valueLabel = document.createElement("div");
+    valueLabel.className = "band__value";
+    valueLabel.textContent = `${state.gains[index]} dB`;
+
+    slider.addEventListener("input", (event) => {
+      const value = Number(event.target.value);
+      state.gains[index] = value;
+      valueLabel.textContent = `${value} dB`;
+      if (state.filters[index]) {
+        state.filters[index].gain.value = value;
+      }
+    });
+
+    sliderWrapper.appendChild(slider);
+    sliderWrapper.appendChild(valueLabel);
+
+    band.appendChild(freqLabel);
+    band.appendChild(sliderWrapper);
+
+    bandsContainer.appendChild(band);
+    state.bandControls.push({ slider, valueLabel });
+  });
+};
+
+const applyPreset = (presetKey) => {
+  if (presetKey === "reset") {
+    state.gains = Array(10).fill(0);
+    state.currentPreset = "flat";
+  } else if (presets[presetKey]) {
+    state.gains = [...presets[presetKey]];
+    state.currentPreset = presetKey;
+  }
+
+  state.filters.forEach((filter, index) => {
+    filter.gain.value = state.gains[index];
+  });
+  state.bandControls.forEach((control, index) => {
+    control.slider.value = state.gains[index];
+    control.valueLabel.textContent = `${state.gains[index]} dB`;
+  });
+  presetText.textContent = `Preset: ${state.currentPreset.toUpperCase()}`;
+};
+
+fileInput.addEventListener("change", (event) => {
+  const [file] = event.target.files;
+  if (!file) {
+    return;
+  }
+  ensureAudioContext();
+  if (state.currentUrl) {
+    URL.revokeObjectURL(state.currentUrl);
+  }
+  const url = URL.createObjectURL(file);
+  state.currentUrl = url;
+  audioElement.src = url;
+  audioElement.load();
+  connectAudioGraph();
+  updateStatus(`Listo para reproducir: ${file.name}`);
+});
+
+audioElement.addEventListener("play", () => {
+  ensureAudioContext();
+  connectAudioGraph();
+  updateStatus("Reproduciendo con ecualizador activo.");
+});
+
+audioElement.addEventListener("pause", () => {
+  updateStatus("Pausado.");
+});
+
+audioElement.addEventListener("ended", () => {
+  updateStatus("Finalizó la reproducción.");
+});
+
+document.querySelectorAll("[data-preset]").forEach((button) => {
+  button.addEventListener("click", () => {
+    ensureAudioContext();
+    applyPreset(button.dataset.preset);
+    updateStatus(`Preset aplicado: ${button.textContent}`);
+  });
+});
+
+masterGainSlider.addEventListener("input", (event) => {
+  const value = Number(event.target.value);
+  masterGainValue.textContent = `${value} dB`;
+  ensureAudioContext();
+  state.masterGain.gain.value = Math.pow(10, value / 20);
+});
+
+bypassToggle.addEventListener("change", (event) => {
+  state.bypass = event.target.checked;
+  ensureAudioContext();
+  connectAudioGraph();
+  updateStatus(state.bypass ? "EQ en bypass." : "EQ activo.");
+});
+
+renderBands();
+presetText.textContent = "Preset: FLAT";
