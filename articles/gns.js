const stageCopy = {
  encode: {
    label: "ENCODER / 建图",
    copy: "读取当前位置、最近 5 步速度、粒子材料和边界距离；在半径 R 内连边，并把节点与边都编码成 128 维隐向量。",
  },
  process: {
    label: "PROCESSOR / 多轮消息传递",
    copy: "每一轮先根据发送端、接收端和旧边状态更新边消息，再把邻边消息相加到节点。默认做 10 轮，因此信息可以跨过多条边。",
  },
  decode: {
    label: "DECODER / 提取动力学",
    copy: "读取最后一轮节点隐状态，为每个粒子输出二维或三维平均加速度。网络不直接生成渲染图，也不一次预测整条轨迹。",
  },
  update: {
    label: "UPDATE / 固定时间推进",
    copy: "Euler 更新器把预测加速度积分成新速度和新位置；下一步重新建图，再调用同一个动力学模型，连续形成 rollout。",
  },
};

const stageButtons = [...document.querySelectorAll("[data-stage]")];
const stageLabel = document.querySelector("#stage-label");
const stageText = document.querySelector("#stage-copy");

stageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.stage;
    stageButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    stageLabel.textContent = stageCopy[key].label;
    stageText.textContent = stageCopy[key].copy;
  });
});

const graphCanvas = document.querySelector("#graph-canvas");
const radiusControl = document.querySelector("#radius-control");
const messageControl = document.querySelector("#message-control");
const radiusValue = document.querySelector("#radius-value");
const messageValue = document.querySelector("#message-value");
const edgeCount = document.querySelector("#edge-count");
const neighborCount = document.querySelector("#neighbor-count");
const reachCount = document.querySelector("#reach-count");
const graphCaption = document.querySelector("#graph-caption");
const shuffleGraph = document.querySelector("#shuffle-graph");

let graphSeed = 19;
let graphNodes = [];

function randomUnit() {
  graphSeed = (graphSeed * 1664525 + 1013904223) >>> 0;
  return graphSeed / 4294967296;
}

function createGraphNodes() {
  graphNodes = [];
  const width = graphCanvas.width;
  const height = graphCanvas.height;
  for (let index = 0; index < 34; index += 1) {
    graphNodes.push({
      x: 45 + randomUnit() * (width - 90),
      y: 38 + randomUnit() * (height - 76),
    });
  }
  graphNodes[0] = { x: width * 0.5, y: height * 0.5 };
}

function buildAdjacency(radius) {
  const adjacency = graphNodes.map(() => []);
  const edges = [];
  for (let a = 0; a < graphNodes.length; a += 1) {
    for (let b = a + 1; b < graphNodes.length; b += 1) {
      const dx = graphNodes[a].x - graphNodes[b].x;
      const dy = graphNodes[a].y - graphNodes[b].y;
      if (Math.hypot(dx, dy) <= radius) {
        adjacency[a].push(b);
        adjacency[b].push(a);
        edges.push([a, b]);
      }
    }
  }
  return { adjacency, edges };
}

function graphDistances(adjacency, maxDepth) {
  const distance = new Array(graphNodes.length).fill(Infinity);
  distance[0] = 0;
  const queue = [0];
  while (queue.length) {
    const current = queue.shift();
    if (distance[current] >= maxDepth) continue;
    adjacency[current].forEach((neighbor) => {
      if (distance[neighbor] === Infinity) {
        distance[neighbor] = distance[current] + 1;
        queue.push(neighbor);
      }
    });
  }
  return distance;
}

function drawGraph() {
  const context = graphCanvas.getContext("2d");
  const radius = Number(radiusControl.value);
  const rounds = Number(messageControl.value);
  const { adjacency, edges } = buildAdjacency(radius);
  const distances = graphDistances(adjacency, rounds);

  context.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
  context.fillStyle = "#181a1c";
  context.fillRect(0, 0, graphCanvas.width, graphCanvas.height);

  context.strokeStyle = "rgba(227, 225, 220, 0.035)";
  context.lineWidth = 1;
  for (let x = 0; x <= graphCanvas.width; x += 46) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, graphCanvas.height);
    context.stroke();
  }
  for (let y = 0; y <= graphCanvas.height; y += 46) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(graphCanvas.width, y);
    context.stroke();
  }

  context.beginPath();
  context.arc(graphNodes[0].x, graphNodes[0].y, radius, 0, Math.PI * 2);
  context.fillStyle = "rgba(109, 145, 172, 0.055)";
  context.fill();
  context.strokeStyle = "rgba(109, 145, 172, 0.55)";
  context.setLineDash([6, 6]);
  context.stroke();
  context.setLineDash([]);

  edges.forEach(([a, b]) => {
    const active = distances[a] <= rounds && distances[b] <= rounds;
    context.beginPath();
    context.moveTo(graphNodes[a].x, graphNodes[a].y);
    context.lineTo(graphNodes[b].x, graphNodes[b].y);
    context.strokeStyle = active ? "rgba(109, 145, 172, 0.42)" : "rgba(227, 225, 220, 0.12)";
    context.lineWidth = active ? 1.5 : 1;
    context.stroke();
  });

  graphNodes.forEach((node, index) => {
    const depth = distances[index];
    const active = depth <= rounds;
    context.beginPath();
    context.arc(node.x, node.y, index === 0 ? 8 : 5, 0, Math.PI * 2);
    if (index === 0) context.fillStyle = "#e3e1dc";
    else if (depth === 1) context.fillStyle = "#83a8c4";
    else if (active) context.fillStyle = `rgba(109, 145, 172, ${Math.max(0.35, 0.88 - depth * 0.1)})`;
    else context.fillStyle = "rgba(227, 225, 220, 0.28)";
    context.fill();
  });

  context.fillStyle = "#e3e1dc";
  context.font = "12px IBM Plex Mono, monospace";
  context.fillText("selected particle", graphNodes[0].x + 13, graphNodes[0].y - 12);

  radiusValue.textContent = String(radius);
  messageValue.textContent = String(rounds);
  edgeCount.textContent = String(edges.length);
  neighborCount.textContent = String(adjacency[0].length);
  reachCount.textContent = String(distances.filter((value) => value > 0 && value <= rounds).length);
  graphCaption.textContent = rounds === 1
    ? "一轮只聚合直接邻居，蓝色虚线圈表示中心粒子的连接半径"
    : `${rounds} 轮消息可沿图逐层传播，但计算量也随轮数增加`;
}

createGraphNodes();
drawGraph();
radiusControl.addEventListener("input", drawGraph);
messageControl.addEventListener("input", drawGraph);
shuffleGraph.addEventListener("click", () => {
  graphSeed += 97;
  createGraphNodes();
  drawGraph();
});

const errorCanvas = document.querySelector("#error-canvas");
const errorButtons = [...document.querySelectorAll("[data-error-model]")];
const horizonControl = document.querySelector("#horizon-control");
const horizonValue = document.querySelector("#horizon-value");
const errorCaption = document.querySelector("#error-caption");
const finalError = document.querySelector("#final-error");
const errorMessage = document.querySelector("#error-message");
let errorModel = "clean";

function conceptualError(t, horizon, model) {
  const x = t / Math.max(1, horizon);
  if (model === "noise") {
    return 0.018 + 0.18 * x + 0.06 * x * x + Math.sin(t * 0.24) * 0.012 * x;
  }
  return 0.012 + 0.1 * x + 0.68 * x * x + 0.2 * x * x * x + Math.sin(t * 0.19) * 0.018 * x;
}

function drawErrorChart() {
  const context = errorCanvas.getContext("2d");
  const width = errorCanvas.width;
  const height = errorCanvas.height;
  const horizon = Number(horizonControl.value);
  const pad = { left: 70, right: 28, top: 34, bottom: 54 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const maxY = 1.05;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#181a1c";
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(227, 225, 220, 0.11)";
  context.lineWidth = 1;
  context.font = "11px IBM Plex Mono, monospace";
  context.fillStyle = "rgba(227, 225, 220, 0.48)";
  context.textAlign = "right";
  for (let tick = 0; tick <= 4; tick += 1) {
    const value = (maxY / 4) * tick;
    const y = pad.top + plotHeight - (value / maxY) * plotHeight;
    context.beginPath();
    context.moveTo(pad.left, y);
    context.lineTo(width - pad.right, y);
    context.stroke();
    context.fillText(value.toFixed(1), pad.left - 10, y + 4);
  }

  context.textAlign = "center";
  for (let tick = 0; tick <= 4; tick += 1) {
    const step = Math.round((horizon / 4) * tick);
    const x = pad.left + (tick / 4) * plotWidth;
    context.fillText(String(step), x, height - 24);
  }
  context.fillText("rollout step", pad.left + plotWidth / 2, height - 7);

  const drawCurve = (model, color, lineWidth) => {
    context.beginPath();
    for (let step = 0; step <= horizon; step += 1) {
      const value = conceptualError(step, horizon, model);
      const x = pad.left + (step / horizon) * plotWidth;
      const y = pad.top + plotHeight - (value / maxY) * plotHeight;
      if (step === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.stroke();
  };

  drawCurve("clean", errorModel === "clean" ? "#e3e1dc" : "rgba(227,225,220,.2)", errorModel === "clean" ? 3 : 1.5);
  drawCurve("noise", errorModel === "noise" ? "#6d91ac" : "rgba(109,145,172,.22)", errorModel === "noise" ? 3 : 1.5);

  context.textAlign = "left";
  context.fillStyle = errorModel === "clean" ? "#e3e1dc" : "rgba(227,225,220,.45)";
  context.fillRect(width - 245, 27, 20, 3);
  context.fillText("clean one-step only", width - 215, 33);
  context.fillStyle = errorModel === "noise" ? "#6d91ac" : "rgba(109,145,172,.45)";
  context.fillRect(width - 245, 49, 20, 3);
  context.fillText("noise-trained", width - 215, 55);

  const end = conceptualError(horizon, horizon, errorModel);
  horizonValue.textContent = String(horizon);
  finalError.textContent = end.toFixed(2);
  if (errorModel === "clean") {
    errorCaption.textContent = "模型从未学过“带一点误差的状态”，偏差会逐步放大";
    errorMessage.textContent = "训练分布和 rollout 分布逐渐分离。";
  } else {
    errorCaption.textContent = "模型练过轻微偏差状态，能够学到一定的纠偏趋势";
    errorMessage.textContent = "适量噪声用一点单步精度换取更稳的连续预测。";
  }
}

errorButtons.forEach((button) => {
  button.addEventListener("click", () => {
    errorModel = button.dataset.errorModel;
    errorButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    drawErrorChart();
  });
});
horizonControl.addEventListener("input", drawErrorChart);
drawErrorChart();

const progressBar = document.querySelector("#read-progress-bar");
function updateProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
  progressBar.style.width = `${progress * 100}%`;
}
window.addEventListener("scroll", updateProgress, { passive: true });
window.addEventListener("resize", updateProgress);
updateProgress();

const tocLinks = [...document.querySelectorAll(".wm-toc nav a")];
const observed = [...document.querySelectorAll("main [id]")].filter((item) =>
  tocLinks.some((link) => link.getAttribute("href") === `#${item.id}`),
);

if ("IntersectionObserver" in window) {
  const sectionObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visible) return;
    tocLinks.forEach((link) => link.classList.toggle("is-current", link.getAttribute("href") === `#${visible.target.id}`));
  }, { rootMargin: "-16% 0px -68% 0px", threshold: 0 });
  observed.forEach((item) => sectionObserver.observe(item));
}
