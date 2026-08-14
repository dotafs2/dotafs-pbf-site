const page = document.querySelector(".world-models-page");

function cssColor(name) {
  return getComputedStyle(page).getPropertyValue(name).trim();
}

function noise(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

const concepts = {
  vision: ["VISION / VAE", "一帧有上万个像素；V 把它压成较短的隐向量 z，只留下对任务有用的结构。"],
  memory: ["MEMORY / MDN-RNN", "M 读取当前 z、历史 h 和动作 a，输出下一状态的概率分布，而不是一张确定的未来图片。"],
  controller: ["CONTROLLER / LINEAR", "C 不负责模拟世界。它读取 z 和 h，选择转向、加速或躲避等动作。"],
};

document.querySelectorAll("[data-concept]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-concept]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    const [label, copy] = concepts[button.dataset.concept];
    document.querySelector("#concept-label").textContent = label;
    document.querySelector("#concept-copy").textContent = copy;
  });
});

const latentInputs = [...document.querySelectorAll("[data-latent]")];
const latentCells = document.querySelector("#latent-cells");
const latentTail = Array.from({ length: 28 }, (_, index) => noise(index + 4) * 0.72);

for (let index = 0; index < 32; index += 1) {
  const cell = document.createElement("i");
  latentCells.append(cell);
}

function sceneParameters(values) {
  return {
    curve: values[0] * 0.52,
    carOffset: values[1] * 0.32,
    horizon: 0.28 + (values[2] + 1) * 0.07,
    width: 0.56 + values[3] * 0.12,
  };
}

function drawRoadScene(context, width, height, params, detailed) {
  const text = cssColor("--wm-text");
  const muted = cssColor("--wm-muted");
  const line = cssColor("--wm-line");
  const accent = cssColor("--wm-accent");
  const background = cssColor("--wm-bg");
  const horizonY = height * params.horizon;
  const bottomCenter = width / 2;
  const topCenter = width * (0.5 + params.curve * 0.25);
  const bottomHalf = width * params.width;
  const topHalf = width * 0.08;

  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  context.fillStyle = line;
  context.fillRect(0, horizonY, width, 1);

  if (detailed) {
    context.strokeStyle = line;
    context.lineWidth = 1;
    for (let x = 0; x < width; x += width / 16) {
      context.beginPath();
      context.moveTo(x, horizonY);
      context.lineTo(x, height);
      context.stroke();
    }
  }

  context.beginPath();
  context.moveTo(topCenter - topHalf, horizonY);
  context.lineTo(bottomCenter - bottomHalf, height);
  context.lineTo(bottomCenter + bottomHalf, height);
  context.lineTo(topCenter + topHalf, horizonY);
  context.closePath();
  context.fillStyle = detailed ? "#282b2e" : "#25282b";
  context.fill();
  context.strokeStyle = muted;
  context.lineWidth = detailed ? 2 : 1;
  context.stroke();

  context.setLineDash([height * 0.055, height * 0.045]);
  context.beginPath();
  context.moveTo(topCenter, horizonY);
  context.quadraticCurveTo(width * (0.5 + params.curve * 0.12), height * 0.62, bottomCenter, height);
  context.strokeStyle = accent;
  context.lineWidth = detailed ? 2 : 1;
  context.stroke();
  context.setLineDash([]);

  if (detailed) {
    for (let index = 0; index < 7; index += 1) {
      const y = horizonY + (height - horizonY) * (index / 7) ** 1.6;
      const spread = (y - horizonY) * 0.68;
      context.fillStyle = line;
      context.fillRect(topCenter - spread - 9, y, 8, 5);
      context.fillRect(topCenter + spread + 1, y, 8, 5);
    }
  }

  const carX = width * (0.5 + params.carOffset);
  const carY = height * 0.78;
  context.fillStyle = text;
  context.fillRect(carX - width * 0.025, carY - height * 0.035, width * 0.05, height * 0.07);
  context.fillStyle = background;
  context.fillRect(carX - width * 0.014, carY - height * 0.023, width * 0.028, height * 0.018);

  context.fillStyle = muted;
  context.font = `${Math.max(8, width * 0.023)}px IBM Plex Mono, monospace`;
  context.fillText("frame t", 12, 19);
}

function drawVision() {
  const values = latentInputs.map((input) => Number(input.value));
  const params = sceneParameters(values);
  const source = document.querySelector("#vision-source");
  const sourceContext = source.getContext("2d");
  drawRoadScene(sourceContext, source.width, source.height, params, true);

  const reconstruction = document.querySelector("#vision-reconstruction");
  const reconstructionContext = reconstruction.getContext("2d");
  const small = document.createElement("canvas");
  small.width = 65;
  small.height = 40;
  drawRoadScene(small.getContext("2d"), small.width, small.height, params, false);
  reconstructionContext.imageSmoothingEnabled = false;
  reconstructionContext.clearRect(0, 0, reconstruction.width, reconstruction.height);
  reconstructionContext.drawImage(small, 0, 0, reconstruction.width, reconstruction.height);

  const allValues = [...values, ...latentTail];
  [...latentCells.children].forEach((cell, index) => {
    const value = allValues[index];
    cell.style.opacity = String(0.2 + Math.abs(value) * 0.8);
    cell.style.transform = `scaleY(${0.55 + Math.abs(value) * 0.45})`;
  });
}

latentInputs.forEach((input) => {
  input.addEventListener("input", () => {
    document.querySelector(`[data-latent-output="${input.dataset.latent}"]`).textContent = Number(input.value).toFixed(2);
    drawVision();
  });
});

document.querySelector("#randomize-latent").addEventListener("click", () => {
  latentInputs.forEach((input, index) => {
    const value = Math.max(-1, Math.min(1, noise(Date.now() * 0.001 + index * 3.7)));
    input.value = value.toFixed(2);
    document.querySelector(`[data-latent-output="${index}"]`).textContent = value.toFixed(2);
  });
  drawVision();
});

drawVision();

function fillStrip(container, values) {
  container.replaceChildren();
  values.forEach((value) => {
    const bar = document.createElement("i");
    bar.style.height = `${5 + Math.abs(value) * 18}px`;
    bar.style.opacity = String(0.35 + Math.abs(value) * 0.65);
    container.append(bar);
  });
}

fillStrip(document.querySelector("#z-strip"), Array.from({ length: 18 }, (_, index) => noise(index + 20)));
fillStrip(document.querySelector("#h-strip"), Array.from({ length: 18 }, (_, index) => noise(index + 90) * 0.82));

let predictionAction = 0;

function drawPrediction() {
  const canvas = document.querySelector("#prediction-canvas");
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const temperature = Number(document.querySelector("#prediction-temperature").value);
  const background = cssColor("--wm-bg");
  const line = cssColor("--wm-line");
  const muted = cssColor("--wm-muted");
  const text = cssColor("--wm-text");
  const accent = cssColor("--wm-accent");

  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = line;
  context.lineWidth = 1;
  for (let x = 0; x <= width; x += 70) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y <= height; y += 54) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  context.strokeStyle = muted;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(width * 0.22, height);
  context.quadraticCurveTo(width * 0.32, height * 0.45, width * 0.35, 0);
  context.stroke();
  context.beginPath();
  context.moveTo(width * 0.78, height);
  context.quadraticCurveTo(width * 0.68, height * 0.45, width * 0.65, 0);
  context.stroke();

  const startX = width / 2;
  const startY = height * 0.84;
  for (let sample = 0; sample < 13; sample += 1) {
    context.beginPath();
    context.moveTo(startX, startY);
    for (let step = 1; step <= 18; step += 1) {
      const progress = step / 18;
      const spread = noise(sample * 31 + step * 4.3) * temperature * width * 0.13 * progress;
      const actionShift = predictionAction * width * 0.2 * progress ** 1.4;
      const curveShift = -width * 0.03 * progress ** 2;
      const x = startX + actionShift + curveShift + spread;
      const y = startY - progress * height * 0.68;
      context.lineTo(x, y);
    }
    context.strokeStyle = sample === 0 ? text : accent;
    context.globalAlpha = sample === 0 ? 1 : 0.22 + (sample % 3) * 0.08;
    context.lineWidth = sample === 0 ? 3 : 1.3;
    context.stroke();
  }
  context.globalAlpha = 1;

  context.fillStyle = text;
  context.fillRect(startX - 12, startY - 15, 24, 30);
  context.fillStyle = background;
  context.fillRect(startX - 6, startY - 9, 12, 9);
  context.fillStyle = muted;
  context.font = "11px IBM Plex Mono, monospace";
  context.fillText("13 sampled futures", 16, 24);

  const names = { "-1": ["LEFT", "向左时，未来分布整体偏向道路左侧"], 0: ["STRAIGHT", "直行时，未来样本集中在道路中央"], 1: ["RIGHT", "向右时，未来分布整体偏向道路右侧"] };
  document.querySelector("#action-token").textContent = names[predictionAction][0];
  document.querySelector("#prediction-caption").textContent = temperature > 0.65 ? "温度升高，同一动作也产生明显分叉" : names[predictionAction][1];
}

document.querySelectorAll("[data-predict-action]").forEach((button) => {
  button.addEventListener("click", () => {
    predictionAction = Number(button.dataset.predictAction);
    document.querySelectorAll("[data-predict-action]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    drawPrediction();
  });
});

document.querySelector("#prediction-temperature").addEventListener("input", (event) => {
  document.querySelector("#prediction-temperature-value").textContent = Number(event.target.value).toFixed(2);
  drawPrediction();
});

drawPrediction();

const controllerScenarios = [0.72, -0.78, 0.08, 0.46, -0.34];
let controllerScenarioIndex = 0;
let controllerChoice = null;
const controllerInputs = document.querySelector("#controller-input-bars");

for (let index = 0; index < 14; index += 1) {
  controllerInputs.append(document.createElement("i"));
}

function updateControllerInputs() {
  const curve = controllerScenarios[controllerScenarioIndex];
  [...controllerInputs.children].forEach((bar, index) => {
    const value = Math.abs(Math.sin(index * 1.17 + curve * 2.4));
    bar.style.height = `${20 + value * 92}px`;
    bar.style.opacity = String(0.3 + value * 0.7);
  });
}

function drawController() {
  const canvas = document.querySelector("#controller-canvas");
  const context = canvas.getContext("2d");
  const curve = controllerScenarios[controllerScenarioIndex];
  drawRoadScene(context, canvas.width, canvas.height, { curve, carOffset: controllerChoice === null ? 0 : controllerChoice * 0.08, horizon: 0.31, width: 0.55 }, true);
  context.fillStyle = cssColor("--wm-text");
  context.font = "12px IBM Plex Mono, monospace";
  context.fillText(controllerChoice === null ? "waiting for C" : `action: ${["LEFT", "STRAIGHT", "RIGHT"][controllerChoice + 1]}`, 16, canvas.height - 18);
  document.querySelector("#curve-label").textContent = Math.abs(curve) < 0.2 ? "前方道路接近直线" : `前方道路向${curve < 0 ? "左" : "右"}弯`;
}

function setScoreBar(name, value, selected) {
  const normalized = Math.max(0, Math.min(1, value));
  document.querySelector(`#score-${name}`).style.width = `${normalized * 100}%`;
  document.querySelector(`#value-${name}`).textContent = normalized.toFixed(2);
  document.querySelector(`#score-${name}`).style.opacity = selected ? "1" : ".45";
}

function runController() {
  const curve = controllerScenarios[controllerScenarioIndex];
  const actions = [-1, 0, 1];
  const raw = actions.map((action) => Math.exp(1.8 * (1 - Math.abs(action - curve))));
  const total = raw.reduce((sum, value) => sum + value, 0);
  const scores = raw.map((value) => value / total);
  const bestIndex = scores.indexOf(Math.max(...scores));
  controllerChoice = actions[bestIndex];
  ["left", "straight", "right"].forEach((name, index) => setScoreBar(name, scores[index], index === bestIndex));
  const actionName = ["向左", "直行", "向右"][bestIndex];
  document.querySelector("#controller-result").textContent = `C 选择${actionName}；最高输出为 ${scores[bestIndex].toFixed(2)}。`;
  drawController();
}

document.querySelector("#new-curve").addEventListener("click", () => {
  controllerScenarioIndex = (controllerScenarioIndex + 1) % controllerScenarios.length;
  controllerChoice = null;
  ["left", "straight", "right"].forEach((name) => setScoreBar(name, 0, false));
  document.querySelector("#controller-result").textContent = "输入已经改变，等待 C 重新决定。";
  updateControllerInputs();
  drawController();
});

document.querySelector("#run-controller").addEventListener("click", runController);
updateControllerInputs();
drawController();

const dreamSteps = [
  ["STEP 1 / COLLECT", "先在真实环境中随机探索", "保存每一步的画面和动作，让模型看到“做了什么”以及“接下来发生了什么”。", "frames + actions", "→"],
  ["STEP 2 / VISION", "V 把画面压成 z", "高维像素被换成较短的隐状态。后面的模型只需要处理 z，不必反复处理整张图片。", "encode to z", "→"],
  ["STEP 3 / MEMORY", "M 学会预测下一个 z", "给定当前 z、动作 a 和历史 h，模型输出下一隐状态以及结束信号的分布。", "learn dynamics", "→"],
  ["STEP 4 / DREAM", "让 C 只在内部世界中训练", "真实环境暂时退出循环；M 不断采样未来，C 在这些未来里反复试错。", "C ↔ M", "↔"],
  ["STEP 5 / TRANSFER", "把学到的 C 放回真实环境", "如果内部世界保留了任务所需的规律，Dream 中学到的策略就能迁回现实。", "deploy policy", "←"],
];
let activeDreamStep = 0;

function updateDream(step) {
  activeDreamStep = step;
  document.querySelectorAll("[data-dream-step]").forEach((button) => {
    const active = Number(button.dataset.dreamStep) === step;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const [label, title, copy, transfer, arrow] = dreamSteps[step];
  document.querySelector("#dream-step-label").textContent = label;
  document.querySelector("#dream-step-title").textContent = title;
  document.querySelector("#dream-step-copy").textContent = copy;
  document.querySelector("#dream-transfer").textContent = transfer;
  document.querySelector("#dream-arrow").textContent = arrow;
  const real = document.querySelector(".real-window");
  const model = document.querySelector(".model-window");
  real.style.opacity = step === 3 ? ".35" : "1";
  model.style.opacity = step === 0 ? ".35" : "1";
  model.style.transform = step === 2 || step === 3 ? "translateY(-5px)" : "none";
  document.querySelector("#next-dream-step").textContent = step === dreamSteps.length - 1 ? "回到第一步" : "下一步";
}

document.querySelectorAll("[data-dream-step]").forEach((button) => {
  button.addEventListener("click", () => updateDream(Number(button.dataset.dreamStep)));
});
document.querySelector("#next-dream-step").addEventListener("click", () => updateDream((activeDreamStep + 1) % dreamSteps.length));
updateDream(0);

const realClothCanvas = document.querySelector("#real-cloth");
const modelClothCanvas = document.querySelector("#dream-cloth");
const clothColumns = 9;
const clothRows = 6;
const clothSpacing = 34;
const clothOrigin = { x: 170, y: 67 };
const clothPinned = new Set([0, clothColumns - 1]);
const clothLinks = [];
let clothAction = "gravity";
let clothStep = 0;

for (let row = 0; row < clothRows; row += 1) {
  for (let column = 0; column < clothColumns; column += 1) {
    const index = row * clothColumns + column;
    if (column < clothColumns - 1) clothLinks.push([index, index + 1]);
    if (row < clothRows - 1) clothLinks.push([index, index + clothColumns]);
  }
}

function createClothState() {
  return Array.from({ length: clothColumns * clothRows }, (_, index) => {
    const column = index % clothColumns;
    const row = Math.floor(index / clothColumns);
    const x = clothOrigin.x + column * clothSpacing;
    const y = clothOrigin.y + row * clothSpacing;
    return { x, y, px: x, py: y };
  });
}

let realCloth = createClothState();
let modelCloth = createClothState();

function simulateCloth(points, learned) {
  const target = points[(clothRows - 1) * clothColumns + clothColumns - 1];
  if (clothAction === "pull") target.x += learned ? 4.3 : 4.8;
  if (clothAction === "lift") target.y -= learned ? 6.3 : 7.2;

  points.forEach((point, index) => {
    if (clothPinned.has(index)) return;
    const velocityX = (point.x - point.px) * 0.985;
    const velocityY = (point.y - point.py) * 0.985;
    point.px = point.x;
    point.py = point.y;
    point.x += velocityX + (learned ? noise(index + clothStep * 71) * 0.18 : 0);
    point.y += velocityY + 1.75 + (learned ? noise(index + clothStep * 47) * 0.18 : 0);
  });

  const iterations = learned ? 3 : 7;
  const stiffness = learned ? 0.91 : 1;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    clothLinks.forEach(([firstIndex, secondIndex], linkIndex) => {
      const first = points[firstIndex];
      const second = points[secondIndex];
      const dx = second.x - first.x;
      const dy = second.y - first.y;
      const distance = Math.hypot(dx, dy) || 1;
      const rest = clothSpacing * (learned ? 1 + noise(linkIndex * 13) * 0.006 : 1);
      const correction = ((distance - rest) / distance) * 0.5 * stiffness;
      if (!clothPinned.has(firstIndex)) {
        first.x += dx * correction;
        first.y += dy * correction;
      }
      if (!clothPinned.has(secondIndex)) {
        second.x -= dx * correction;
        second.y -= dy * correction;
      }
    });
    points.forEach((point, index) => {
      if (clothPinned.has(index)) {
        point.x = clothOrigin.x + (index % clothColumns) * clothSpacing;
        point.y = clothOrigin.y;
        point.px = point.x;
        point.py = point.y;
      }
      point.y = Math.min(point.y, 325);
    });
  }
}

function drawCloth(canvas, points, learned) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = cssColor("--wm-bg");
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = cssColor("--wm-line");
  context.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 34) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 34) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke();
  }
  context.strokeStyle = learned ? cssColor("--wm-accent") : cssColor("--wm-muted");
  context.lineWidth = 1.4;
  clothLinks.forEach(([firstIndex, secondIndex]) => {
    context.beginPath();
    context.moveTo(points[firstIndex].x, points[firstIndex].y);
    context.lineTo(points[secondIndex].x, points[secondIndex].y);
    context.stroke();
  });
  points.forEach((point, index) => {
    context.beginPath();
    context.arc(point.x, point.y, clothPinned.has(index) ? 4.2 : 2.7, 0, Math.PI * 2);
    context.fillStyle = clothPinned.has(index) ? cssColor("--wm-text") : cssColor("--wm-accent");
    context.fill();
  });
}

function clothError() {
  return realCloth.reduce((sum, point, index) => sum + Math.hypot(point.x - modelCloth[index].x, point.y - modelCloth[index].y), 0) / realCloth.length;
}

function renderCloth() {
  drawCloth(realClothCanvas, realCloth, false);
  drawCloth(modelClothCanvas, modelCloth, true);
  document.querySelector("#cloth-step").textContent = String(clothStep);
  document.querySelector("#cloth-error").textContent = `${clothError().toFixed(2)} px`;
}

document.querySelectorAll("[data-cloth-action]").forEach((button) => {
  button.addEventListener("click", () => {
    clothAction = button.dataset.clothAction;
    document.querySelectorAll("[data-cloth-action]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    document.querySelector("#cloth-message").textContent = { gravity: "没有额外控制输入。", pull: "动作条件：拉动右下角。", lift: "动作条件：提起右下角。" }[clothAction];
  });
});

document.querySelector("#step-cloth").addEventListener("click", () => {
  clothStep += 1;
  simulateCloth(realCloth, false);
  simulateCloth(modelCloth, true);
  renderCloth();
  document.querySelector("#cloth-message").textContent = clothStep < 4 ? "单步预测仍然接近。" : "小误差正在沿 rollout 累积。";
});

document.querySelector("#reset-cloth").addEventListener("click", () => {
  realCloth = createClothState();
  modelCloth = createClothState();
  clothStep = 0;
  clothAction = "gravity";
  document.querySelectorAll("[data-cloth-action]").forEach((item) => {
    const active = item.dataset.clothAction === "gravity";
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  document.querySelector("#cloth-message").textContent = "两边从完全相同的状态开始。";
  renderCloth();
});

renderCloth();

const tocLinks = [...document.querySelectorAll(".wm-toc nav a")];
const tocSections = tocLinks.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    tocLinks.forEach((link) => link.classList.toggle("is-current", link.getAttribute("href") === `#${visible.target.id}`));
  }, { rootMargin: "-20% 0px -65%", threshold: [0, .2, .5] });
  tocSections.forEach((section) => observer.observe(section));
}
