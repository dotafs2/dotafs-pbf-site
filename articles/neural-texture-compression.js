const ntcPage = document.querySelector(".ntc-page");

function cssVar(name) {
  return getComputedStyle(ntcPage).getPropertyValue(name).trim();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function seededNoise(value) {
  const raw = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return raw - Math.floor(raw);
}

// Interactive 01: spatial correlation across material channels.
const correlationInput = document.querySelector("#correlation");
const textureCanvases = {
  albedo: document.querySelector("#albedo-canvas"),
  normal: document.querySelector("#normal-canvas"),
  roughness: document.querySelector("#roughness-canvas"),
};
const baseCrack = [
  { x: .08, y: .28 },
  { x: .22, y: .36 },
  { x: .34, y: .53 },
  { x: .48, y: .46 },
  { x: .61, y: .55 },
  { x: .75, y: .39 },
  { x: .91, y: .52 },
];
const channelDrift = {
  albedo: { x: 0, y: 0, phase: 0 },
  normal: { x: .055, y: .15, phase: 2.4 },
  roughness: { x: -.07, y: -.14, phase: 4.7 },
};
let correlationView = "material";
let samplePoint = { u: .48, v: .46 };

function correlationPoints(channel, alignment) {
  const independence = 1 - alignment;
  const drift = channelDrift[channel];
  return baseCrack.map((point, index) => ({
    x: clamp(point.x + independence * (drift.x + Math.sin(index * 1.27 + drift.phase) * .025), .04, .96),
    y: clamp(point.y + independence * (drift.y + Math.cos(index * 1.11 + drift.phase) * .028), .08, .92),
  }));
}

function drawMaterialSurface(context, width, height, channel) {
  const backgrounds = { albedo: "#6d675b", normal: "#737c8a", roughness: "#666a69" };
  context.fillStyle = correlationView === "mask" ? "#1b1d1f" : backgrounds[channel];
  context.fillRect(0, 0, width, height);

  if (correlationView === "mask") return;
  for (let y = 0; y < height; y += 9) {
    for (let x = 0; x < width; x += 9) {
      const offset = channel === "normal" ? 37 : channel === "roughness" ? 79 : 0;
      const value = seededNoise(x * .37 + y * 1.09 + offset);
      context.fillStyle = channel === "normal"
        ? `rgba(27, 31, 39, ${.025 + value * .055})`
        : `rgba(235, 231, 216, ${.022 + value * .05})`;
      context.fillRect(x, y, 8, 8);
    }
  }
}

function traceCrack(context, points, width, height) {
  context.beginPath();
  points.forEach((point, index) => {
    const x = point.x * width;
    const y = point.y * height;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.lineJoin = "round";
  context.lineCap = "round";
}

function drawMaterialChange(context, points, width, height, channel) {
  if (correlationView === "mask") {
    traceCrack(context, points, width, height);
    context.strokeStyle = "rgba(227, 225, 220, .88)";
    context.lineWidth = 6;
    context.stroke();
    traceCrack(context, points, width, height);
    context.strokeStyle = "rgba(137, 149, 153, .72)";
    context.lineWidth = 2;
    context.stroke();
    return;
  }

  if (channel === "albedo") {
    traceCrack(context, points, width, height);
    context.strokeStyle = "rgba(24, 25, 24, .9)";
    context.lineWidth = 11;
    context.stroke();
    traceCrack(context, points, width, height);
    context.strokeStyle = "rgba(210, 202, 181, .24)";
    context.lineWidth = 2;
    context.stroke();
  } else if (channel === "normal") {
    context.save();
    context.translate(-3, 3);
    traceCrack(context, points, width, height);
    context.strokeStyle = "rgba(33, 38, 48, .82)";
    context.lineWidth = 13;
    context.stroke();
    context.restore();
    context.save();
    context.translate(3, -3);
    traceCrack(context, points, width, height);
    context.strokeStyle = "rgba(199, 207, 219, .78)";
    context.lineWidth = 8;
    context.stroke();
    context.restore();
  } else {
    traceCrack(context, points, width, height);
    context.strokeStyle = "rgba(30, 31, 31, .66)";
    context.lineWidth = 18;
    context.stroke();
    traceCrack(context, points, width, height);
    context.strokeStyle = "rgba(190, 194, 190, .38)";
    context.lineWidth = 9;
    context.stroke();
  }
}

function drawSampleCursor(context, width, height) {
  const x = samplePoint.u * width;
  const y = samplePoint.v * height;
  context.save();
  context.setLineDash([4, 4]);
  context.strokeStyle = "rgba(227, 225, 220, .58)";
  context.lineWidth = 1;
  context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
  context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
  context.setLineDash([]);
  context.beginPath();
  context.arc(x, y, 7, 0, Math.PI * 2);
  context.fillStyle = "#1b1d1f";
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = "#e3e1dc";
  context.stroke();
  context.restore();
}

function drawCorrelationTexture(canvas, channel, alignment) {
  const context = canvas.getContext("2d");
  const { width, height } = canvas;
  const points = correlationPoints(channel, alignment);
  drawMaterialSurface(context, width, height, channel);
  drawMaterialChange(context, points, width, height, channel);
  drawSampleCursor(context, width, height);
  context.fillStyle = "rgba(227, 225, 220, .7)";
  context.font = "10px IBM Plex Mono, monospace";
  context.fillText(correlationView === "mask" ? "CHANGE POSITION" : channel.toUpperCase(), 11, 17);
}

function pointSegmentDistance(point, first, second) {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const lengthSquared = dx * dx + dy * dy;
  const amount = lengthSquared === 0 ? 0 : clamp(((point.u - first.x) * dx + (point.v - first.y) * dy) / lengthSquared, 0, 1);
  const x = first.x + amount * dx;
  const y = first.y + amount * dy;
  return Math.hypot(point.u - x, point.v - y);
}

function channelResponse(channel, alignment) {
  const points = correlationPoints(channel, alignment);
  let distance = Infinity;
  for (let index = 0; index < points.length - 1; index += 1) {
    distance = Math.min(distance, pointSegmentDistance(samplePoint, points[index], points[index + 1]));
  }
  return Math.exp(-(distance * distance) / (2 * .042 * .042));
}

function renderCorrelation() {
  const value = Number(correlationInput.value);
  const alignment = value / 100;
  const responses = {
    albedo: channelResponse("albedo", alignment),
    normal: channelResponse("normal", alignment),
    roughness: channelResponse("roughness", alignment),
  };
  Object.entries(textureCanvases).forEach(([channel, canvas]) => drawCorrelationTexture(canvas, channel, alignment));

  const albedoChange = Math.round(responses.albedo * 78);
  const normalChange = Math.round(responses.normal * 72);
  const roughnessChange = Math.round(responses.roughness * 56);
  document.querySelector("#correlation-value").textContent = `${value}%`;
  document.querySelector("#sample-coordinate").textContent = `u ${samplePoint.u.toFixed(2)} · v ${samplePoint.v.toFixed(2)}`;
  document.querySelector("#albedo-state").textContent = `变暗 ${albedoChange}%`;
  document.querySelector("#normal-state").textContent = `转向 ${normalChange}°`;
  document.querySelector("#roughness-state").textContent = `改变 ${roughnessChange}%`;
  document.querySelector("#albedo-response").textContent = `−${albedoChange}%`;
  document.querySelector("#normal-response").textContent = `${normalChange}°`;
  document.querySelector("#roughness-response").textContent = `+${roughnessChange}%`;
  document.querySelector("#albedo-response-bar").style.width = `${responses.albedo * 100}%`;
  document.querySelector("#normal-response-bar").style.width = `${responses.normal * 100}%`;
  document.querySelector("#roughness-response-bar").style.width = `${responses.roughness * 100}%`;

  const active = Object.values(responses).filter((response) => response >= .38).length;
  const summary = document.querySelector("#shared-structure");
  const explanation = document.querySelector("#correlation-explanation");
  if (active === 3) {
    summary.textContent = "3 / 3 个通道在同一坐标响应";
    explanation.textContent = `Albedo 变暗 ${albedoChange}%，Normal 改变 ${normalChange}°，Roughness 改变 ${roughnessChange}%。三个数字不同，但变化发生在同一个 UV；共享 latent 可以先记录一次裂缝形状，再让 decoder 输出三种响应。`;
  } else if (active > 0) {
    summary.textContent = `${active} / 3 个通道在当前坐标响应`;
    explanation.textContent = `当前取样点只靠近 ${active} 个通道的裂缝。结构位置发生错位后，一份共享描述不能同时解释三张图，还需要分别保存更多残差。`;
  } else {
    summary.textContent = "0 / 3：当前坐标不在裂缝上";
    explanation.textContent = "把十字取样点移动到任意一张图的裂缝上，再比较另外两张图在同一 UV 是否也发生变化。";
  }
}

function setCorrelationSample(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  samplePoint = {
    u: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    v: clamp((event.clientY - rect.top) / rect.height, 0, 1),
  };
  renderCorrelation();
  canvas.focus();
}

Object.values(textureCanvases).forEach((canvas) => {
  canvas.addEventListener("pointerdown", (event) => setCorrelationSample(event, canvas));
  canvas.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "ArrowLeft") samplePoint.u = clamp(samplePoint.u - .01, 0, 1);
    if (event.key === "ArrowRight") samplePoint.u = clamp(samplePoint.u + .01, 0, 1);
    if (event.key === "ArrowUp") samplePoint.v = clamp(samplePoint.v - .01, 0, 1);
    if (event.key === "ArrowDown") samplePoint.v = clamp(samplePoint.v + .01, 0, 1);
    renderCorrelation();
  });
});

document.querySelectorAll("[data-correlation-view]").forEach((button) => {
  button.addEventListener("click", () => {
    correlationView = button.dataset.correlationView;
    document.querySelectorAll("[data-correlation-view]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderCorrelation();
  });
});

correlationInput.addEventListener("input", renderCorrelation);
document.querySelector("#correlation-reset").addEventListener("click", () => {
  correlationInput.value = "82";
  correlationView = "material";
  samplePoint = { u: .48, v: .46 };
  document.querySelectorAll("[data-correlation-view]").forEach((item) => {
    const active = item.dataset.correlationView === "material";
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  renderCorrelation();
  correlationInput.focus();
});
renderCorrelation();

// Interactive 02: random-access decoder.
const decoderGrid = document.querySelector("#decoder-grid");
const decoderU = document.querySelector("#decoder-u");
const decoderV = document.querySelector("#decoder-v");
const decoderLod = document.querySelector("#decoder-lod");
decoderGrid.tabIndex = 0;

function decoderState() {
  return {
    u: Number(decoderU.value) / 100,
    v: Number(decoderV.value) / 100,
    lod: Number(decoderLod.value),
  };
}

function drawDecoderGrid() {
  const { u, v, lod } = decoderState();
  const context = decoderGrid.getContext("2d");
  const width = decoderGrid.width;
  const height = decoderGrid.height;
  const padding = 34;
  const gridWidth = width - padding * 2;
  const gridHeight = height - padding * 2;
  const cells = Math.max(5, 12 - lod);
  const cellWidth = gridWidth / cells;
  const cellHeight = gridHeight / cells;
  const targetX = padding + u * gridWidth;
  const targetY = padding + v * gridHeight;
  const ix = clamp(Math.floor(u * cells), 0, cells - 1);
  const iy = clamp(Math.floor(v * cells), 0, cells - 1);

  context.clearRect(0, 0, width, height);
  context.fillStyle = cssVar("--ntc-bg");
  context.fillRect(0, 0, width, height);

  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      const seed = x * 17 + y * 31 + lod * 13;
      const value = 29 + Math.round(seededNoise(seed) * 18);
      context.fillStyle = `rgb(${value}, ${value + 3}, ${value + 5})`;
      context.fillRect(padding + x * cellWidth + 1, padding + y * cellHeight + 1, cellWidth - 2, cellHeight - 2);
    }
  }

  context.strokeStyle = cssVar("--ntc-line-strong");
  context.lineWidth = 1;
  for (let index = 0; index <= cells; index += 1) {
    const x = padding + index * cellWidth;
    const y = padding + index * cellHeight;
    context.beginPath(); context.moveTo(x, padding); context.lineTo(x, height - padding); context.stroke();
    context.beginPath(); context.moveTo(padding, y); context.lineTo(width - padding, y); context.stroke();
  }

  const neighbors = [
    [ix, iy],
    [Math.min(ix + 1, cells - 1), iy],
    [ix, Math.min(iy + 1, cells - 1)],
    [Math.min(ix + 1, cells - 1), Math.min(iy + 1, cells - 1)],
  ];
  neighbors.forEach(([x, y], index) => {
    const centerX = padding + (x + .5) * cellWidth;
    const centerY = padding + (y + .5) * cellHeight;
    context.beginPath();
    context.arc(centerX, centerY, Math.max(5, Math.min(cellWidth, cellHeight) * .16), 0, Math.PI * 2);
    context.fillStyle = index === 0 ? cssVar("--ntc-text") : cssVar("--ntc-accent");
    context.fill();
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(targetX, targetY);
    context.strokeStyle = "rgba(227, 225, 220, .38)";
    context.stroke();
  });

  context.beginPath();
  context.arc(targetX, targetY, 7, 0, Math.PI * 2);
  context.fillStyle = "#1b1d1f";
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = cssVar("--ntc-text");
  context.stroke();

  context.fillStyle = cssVar("--ntc-muted");
  context.font = "10px IBM Plex Mono, monospace";
  context.fillText(`G₀ / feature level ${Math.floor(lod / 2)}`, padding, 19);
  context.fillText(`${cells} × ${cells} teaching grid`, width - 176, height - 11);
}

function renderDecoder() {
  const { u, v, lod } = decoderState();
  drawDecoderGrid();

  document.querySelector("#decoder-u-value").textContent = u.toFixed(2);
  document.querySelector("#decoder-v-value").textContent = v.toFixed(2);
  document.querySelector("#decoder-lod-value").textContent = String(lod);
  document.querySelector("#address-readout").textContent = `texel (${Math.round(u * 100)}, ${Math.round(v * 100)}), mip ${lod}`;

  const level = Math.floor(lod / 2);
  document.querySelector("#feature-readout").textContent = `G₀: 4 cells · G₁: 1 blend · L${level}`;

  const wave = Math.sin(u * 8.4 + v * 4.1 + lod * .48);
  const grain = Math.cos(v * 11.2 - u * 3.7 + lod * .33);
  const red = Math.round(clamp(91 + wave * 24 - lod * 2.2, 34, 180));
  const green = Math.round(clamp(86 + grain * 18 - lod * 1.8, 32, 170));
  const blue = Math.round(clamp(72 + wave * 10 + grain * 8 - lod * 1.4, 28, 150));
  const nx = clamp(Math.sin(u * 10.8) * .18 / (1 + lod * .18), -.3, .3);
  const ny = clamp(Math.cos(v * 9.7) * .18 / (1 + lod * .18), -.3, .3);
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  const rough = clamp(.48 + .18 * Math.sin(u * 5.2 + v * 7.1) + lod * .025, .08, .94);

  const albedoSwatch = document.querySelector("#albedo-swatch");
  albedoSwatch.style.backgroundColor = `rgb(${red}, ${green}, ${blue})`;
  document.querySelector("#albedo-output").textContent = `rgb(${red}, ${green}, ${blue})`;
  document.querySelector("#normal-output").textContent = `(${nx.toFixed(2)}, ${ny.toFixed(2)}, ${nz.toFixed(2)})`;
  document.querySelector("#normal-disc").style.setProperty("--normal-angle", `${Math.atan2(nx, -ny) * 180 / Math.PI}deg`);
  document.querySelector("#rough-output").textContent = rough.toFixed(2);
  document.querySelector("#rough-meter").style.height = `${Math.round(rough * 100)}%`;

  const detailText = lod <= 2
    ? "查询落在较细的 feature level。四个 G₀ 邻居保留局部细节，G₁ 提供缓慢变化的底色。"
    : lod <= 5
      ? "LOD 变高后使用更粗的 feature level；网络仍只读局部特征，但输出会逐步丢掉高频变化。"
      : "这是远距离 mip。更粗的网格足以描述低频外观，也说明多个 mip 为什么能共享一组 latent。";
  document.querySelector("#decoder-explanation").textContent = `在 mip ${lod}，${detailText}`;
}

[decoderU, decoderV, decoderLod].forEach((input) => input.addEventListener("input", renderDecoder));

decoderGrid.addEventListener("pointerdown", (event) => {
  const rect = decoderGrid.getBoundingClientRect();
  const paddingX = rect.width * 34 / decoderGrid.width;
  const paddingY = rect.height * 34 / decoderGrid.height;
  const u = clamp((event.clientX - rect.left - paddingX) / (rect.width - paddingX * 2), 0, 1);
  const v = clamp((event.clientY - rect.top - paddingY) / (rect.height - paddingY * 2), 0, 1);
  decoderU.value = String(Math.round(u * 100));
  decoderV.value = String(Math.round(v * 100));
  renderDecoder();
  decoderGrid.focus();
});

decoderGrid.addEventListener("keydown", (event) => {
  const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  if (event.key === "ArrowLeft") decoderU.value = String(Math.max(0, Number(decoderU.value) - 1));
  if (event.key === "ArrowRight") decoderU.value = String(Math.min(100, Number(decoderU.value) + 1));
  if (event.key === "ArrowUp") decoderV.value = String(Math.max(0, Number(decoderV.value) - 1));
  if (event.key === "ArrowDown") decoderV.value = String(Math.min(100, Number(decoderV.value) + 1));
  renderDecoder();
});

document.querySelector("#decoder-reset").addEventListener("click", () => {
  decoderU.value = "36";
  decoderV.value = "58";
  decoderLod.value = "1";
  renderDecoder();
  decoderU.focus();
});
renderDecoder();

// Filtering comparison.
const filterData = {
  nearest: { taps: 1, copy: "<strong>单点：</strong>最快，但纹理缩放时容易闪烁和锯齿。" },
  bilinear: { taps: 4, copy: "<strong>精确双线性：</strong>查询周围四个 texel 并混合，意味着 decoder 也要运行四次。" },
  trilinear: { taps: 8, copy: "<strong>精确三线性：</strong>两个 mip 各取四个 texel；相对单点约八倍 decoder 工作。" },
  stochastic: { taps: 1, copy: "<strong>随机过滤：</strong>每帧抖动一次单点查询，再依靠时间重建积累近似过滤；便宜，但可能出现高光闪烁。" },
};

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    const data = filterData[button.dataset.filter];
    document.querySelector("#filter-taps").textContent = String(data.taps);
    document.querySelector("#filter-copy").innerHTML = data.copy;
  });
});

// Interactive 03: paper trade-off profiles.
const profiles = {
  "0.2": { storage: 3.52, psnr: 32.71, runtime: 1.15, copy: "极低码率：适合先看整体材质是否可接受，细小高频细节最容易被抹掉。" },
  "0.5": { storage: 8.53, psnr: 36.12, runtime: 1.46, copy: "中低码率：论文中与 BC Medium 做 iso-quality 比较时，存储约为后者的五分之一。" },
  "1.0": { storage: 17.03, psnr: 39.92, runtime: 1.33, copy: "平衡档：质量明显上升，仍远小于未压缩 4K × 4K × 9 通道材质。" },
  "2.25": { storage: 38.03, psnr: 45.30, runtime: 1.92, copy: "高质量档：平均 PSNR 最高，但存储和运行解码成本也达到四个档位中的最大值。" },
};

function renderProfile(key) {
  const profile = profiles[key];
  document.querySelector("#storage-value").textContent = `${profile.storage.toFixed(2)} MB`;
  document.querySelector("#psnr-value").textContent = `${profile.psnr.toFixed(2)} dB`;
  document.querySelector("#runtime-value").textContent = `${profile.runtime.toFixed(2)} ms`;
  document.querySelector("#storage-bar").style.width = `${Math.max(5, profile.storage / 42 * 100)}%`;
  document.querySelector("#psnr-bar").style.width = `${profile.psnr / 50 * 100}%`;
  document.querySelector("#runtime-bar").style.width = `${profile.runtime / 2.1 * 100}%`;
  document.querySelector("#profile-copy").textContent = profile.copy;
}

document.querySelectorAll("[data-profile]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-profile]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderProfile(button.dataset.profile);
  });
});
renderProfile("0.2");

// Current SDK deployment modes.
const modes = {
  sample: {
    flow: ["NTC asset", "shader decoder", "当前 texel", "material channels"],
    memory: "保留 NTC 紧凑表示",
    cost: "每次材质采样都执行 decoder",
    fit: "高端 GPU、显存与带宽紧张的场景",
    copy: "直接在 shader 里按坐标解码。它最接近论文的 random access，也最依赖现代矩阵计算能力；输出是未过滤 texel，通常要配 stochastic filtering。",
  },
  load: {
    flow: ["NTC asset", "加载时解码", "BCn texture", "硬件采样"],
    memory: "运行时仍占用 BCn 大小",
    cost: "关卡 / 材质加载时集中转码",
    fit: "减少磁盘与 PCIe 传输，不改渲染采样",
    copy: "在 map 或 game load 时把 NTC 解成 BCn。运行阶段继续走熟悉的硬件纹理路径；显存没有变小，但安装包和上传数据可以更小。",
  },
  feedback: {
    flow: ["sampler feedback", "选择可见 tiles", "转码为 BCn", "sparse texture"],
    memory: "只驻留当前需要的稀疏 tiles",
    cost: "按反馈逐 tile 解码与维护",
    fit: "大型场景、virtual texturing 一类工作流",
    copy: "先由 sampler feedback 找出需要的区域，再只把这些 tile 解码到 sparse BCn 纹理。它把 NTC 更像压缩后端，采样阶段仍使用硬件过滤。",
  },
};

function renderMode(key) {
  const mode = modes[key];
  document.querySelector("#mode-flow").innerHTML = mode.flow.map((item) => `<li>${item}</li>`).join("");
  document.querySelector("#mode-memory").textContent = mode.memory;
  document.querySelector("#mode-cost").textContent = mode.cost;
  document.querySelector("#mode-fit").textContent = mode.fit;
  document.querySelector("#mode-copy").textContent = mode.copy;
}

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-mode]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderMode(button.dataset.mode);
  });
});

// Sidebar scroll state.
const tocLinks = [...document.querySelectorAll(".ntc-toc nav a")];
const tocSections = tocLinks.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    tocLinks.forEach((link) => link.classList.toggle("is-current", link.getAttribute("href") === `#${visible.target.id}`));
  }, { rootMargin: "-20% 0px -68%", threshold: [0, .15, .4] });
  tocSections.forEach((section) => observer.observe(section));
}
