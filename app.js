const bands = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const presets = {
  flat: Array(10).fill(0),
  rock: [4, 3, 2, 1, -1, -1, 1, 3, 4, 5],
  bass: [6, 5, 3, 1, 0, -1, -1, -1, -2, -2],
};

const state = {
  context: null,
  source: null,
  masterGain: null,
  filters: [],
  gains: Array(10).fill(0),
  bypass: false,
  currentPreset: "flat",
  currentUrl: null,
  bandControls: [],
};

const audioElement = document.getElementById("audio");
const fileInput = document.getElementById("audio-file");
const bandsContainer = document.getElementById("bands");
const statusText = document.getElementById("status-text");
const presetText = document.getElementById("preset-text");
const bypassToggle = document.getElementById("bypass-toggle");
const masterGainSlider = document.getElementById("master-gain");
const masterGainValue = document.getElementById("master-value");

const formatFrequency = (frequency) =>
  frequency >= 1000 ? `${frequency / 1000}kHz` : `${frequency}Hz`;

const ensureAudioContext = () => {
  if (!state.context) {
    state.context = new (window.AudioContext || window.webkitAudioContext)();
    createFilters();
    state.masterGain = state.context.createGain();
    state.masterGain.gain.value = 1;
  }
  if (state.context.state === "suspended") {
    state.context.resume();
  }
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
    state.source = state.context.createMediaElementSource(audioElement);
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

const updateStatus = (message) => {
  statusText.textContent = message;
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
    slider.dataset.index = index;

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
  presetText.textContent = `Preset: ${state.currentPreset.toUpperCase()}`;
};

fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (!file) {
    return;
  }
  ensureAudioContext();
  if (state.currentUrl) {
    URL.revokeObjectURL(state.currentUrl);
  }
  const url = URL.createObjectURL(file);
  state.currentUrl = url;
  audioElement.src = url;
  audioElement.load();
  connectAudioGraph();
  updateStatus(`Listo para reproducir: ${file.name}`);
});

audioElement.addEventListener("play", () => {
  ensureAudioContext();
  connectAudioGraph();
  updateStatus("Reproduciendo con ecualizador activo.");
});

audioElement.addEventListener("pause", () => {
  updateStatus("Pausado.");
});

audioElement.addEventListener("ended", () => {
  updateStatus("Finalizó la reproducción.");
});

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    ensureAudioContext();
    applyPreset(button.dataset.preset);
    updateStatus(`Preset aplicado: ${button.textContent}`);
  });
});

masterGainSlider.addEventListener("input", (event) => {
  const value = Number(event.target.value);
  masterGainValue.textContent = `${value} dB`;
  ensureAudioContext();
  state.masterGain.gain.value = Math.pow(10, value / 20);
});

bypassToggle.addEventListener("change", (event) => {
  state.bypass = event.target.checked;
  ensureAudioContext();
  connectAudioGraph();
  updateStatus(state.bypass ? "EQ en bypass." : "EQ activo.");
});

renderBands();
presetText.textContent = "Preset: FLAT";
index.html
Nuevo
+63
-0

<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ecualizador Web - Piloto</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main class="app">
      <header class="app__header">
        <div>
          <p class="app__eyebrow">Piloto web</p>
          <h1>Ecualizador de parlante</h1>
          <p class="app__subtitle">
            Carga un audio local y ajusta las 10 bandas del ecualizador en tiempo real.
          </p>
        </div>
        <div class="app__actions">
          <label class="file-upload">
            <input id="audio-file" type="file" accept="audio/*" />
            <span>Seleccionar audio</span>
          </label>
          <div class="preset-buttons">
            <button class="btn" data-preset="flat">Flat</button>
            <button class="btn" data-preset="rock">Rock</button>
            <button class="btn" data-preset="bass">Bass Boost</button>
            <button class="btn btn--ghost" data-preset="reset">Reset</button>
          </div>
          <div class="utility-controls">
            <label class="toggle">
              <input id="bypass-toggle" type="checkbox" />
              <span>Bypass EQ</span>
            </label>
            <label class="master">
              <span>Master</span>
              <input id="master-gain" type="range" min="-12" max="6" step="0.5" value="0" />
              <span id="master-value">0 dB</span>
            </label>
          </div>
        </div>
      </header>

      <section class="player">
        <audio id="audio" controls preload="metadata"></audio>
        <div class="status">
          <span id="status-text">Carga un archivo para comenzar.</span>
          <span id="preset-text" class="preset-pill">Preset: Flat</span>
        </div>
      </section>

      <section class="eq" id="eq">
        <div class="eq__header">
          <h2>10 bandas (±12 dB)</h2>
          <p>Frecuencias estándar para un ecualizador gráfico.</p>
        </div>
        <div class="eq__bands" id="bands"></div>
      </section>
    </main>

    <script src="app.js"></script>
  </body>
</html>
style.css
Nuevo
+259
-0

:root {
  color-scheme: light;
  font-family: "Inter", "Segoe UI", system-ui, sans-serif;
  --bg: #0f172a;
  --surface: #111c33;
  --card: #1e293b;
  --accent: #38bdf8;
  --accent-strong: #0ea5e9;
  --text: #e2e8f0;
  --muted: #94a3b8;
  --border: rgba(148, 163, 184, 0.2);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  min-height: 100vh;
  background: radial-gradient(circle at top, #1e293b, var(--bg));
  color: var(--text);
  padding: 40px 24px 60px;
}

.app {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.app__header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 24px;
  background: var(--surface);
  padding: 24px 28px;
  border-radius: 16px;
  border: 1px solid var(--border);
}

.app__eyebrow {
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0.2em;
  color: var(--accent);
  margin-bottom: 8px;
}

h1 {
  font-size: 32px;
  margin-bottom: 8px;
}

.app__subtitle {
  color: var(--muted);
  max-width: 520px;
  line-height: 1.5;
}

.app__actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: flex-end;
}

.file-upload {
  background: var(--accent-strong);
  color: #0b1120;
  font-weight: 600;
  padding: 10px 18px;
  border-radius: 999px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.file-upload input {
  display: none;
}

.file-upload:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(14, 165, 233, 0.35);
}

.preset-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.utility-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  justify-content: flex-end;
}

.toggle {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  font-size: 14px;
  color: var(--muted);
}

.toggle input {
  accent-color: var(--accent);
}

.master {
  display: grid;
  grid-template-columns: auto 120px auto;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--muted);
}

.master input {
  accent-color: var(--accent);
}

.btn {
  border: 1px solid transparent;
  background: var(--card);
  color: var(--text);
  padding: 8px 14px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.btn--ghost {
  background: transparent;
  border-color: var(--border);
}

.player {
  background: var(--surface);
  padding: 20px 24px;
  border-radius: 16px;
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.player audio {
  width: 100%;
}

.status {
  font-size: 14px;
  color: var(--muted);
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.preset-pill {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.2);
  color: var(--accent);
  font-size: 12px;
}

.eq {
  background: var(--surface);
  padding: 24px;
  border-radius: 16px;
  border: 1px solid var(--border);
}

.eq__header {
  margin-bottom: 20px;
}

.eq__header h2 {
  font-size: 20px;
  margin-bottom: 6px;
}

.eq__header p {
  color: var(--muted);
  font-size: 14px;
}

.eq__bands {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
  gap: 18px;
}

.band {
  background: var(--card);
  padding: 16px 12px;
  border-radius: 12px;
  text-align: center;
  border: 1px solid transparent;
  transition: border 0.2s ease;
}

.band:hover {
  border-color: var(--accent);
}

.band__freq {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 12px;
}

.band__slider {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.band input[type="range"] {
  writing-mode: bt-lr;
  -webkit-appearance: slider-vertical;
  width: 6px;
  height: 120px;
}

.band__value {
  font-size: 12px;
  color: var(--muted);
}

@media (max-width: 720px) {
  .app__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .app__actions {
    align-items: flex-start;
  }

  .utility-controls {
    justify-content: flex-start;
  }
}
