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

// Interactive 01: channel-correlation teaching textures.
const correlationInput = document.querySelector("#correlation");
const textureCanvases = {
  albedo: document.querySelector("#albedo-canvas"),
  normal: document.querySelector("#normal-canvas"),
  roughness: document.querySelector("#roughness-canvas"),
};

function crackPoint(index, channel, correlation, width, height) {
  const sharedX = width * (0.12 + index * 0.115) + Math.sin(index * 1.73) * 14;
  const sharedY = height * (0.22 + index * 0.075) + Math.sin(index * .88) * 28;
  const independence = 1 - correlation;
  const channelOffset = { albedo: 0, normal: 29, roughness: 61 }[channel];
  return {
    x: sharedX + independence * (seededNoise(index + channelOffset) - .5) * width * .7,
    y: sharedY + independence * (seededNoise(index * 3 + channelOffset) - .5) * height * .65,
  };
}

function drawBaseTexture(context, width, height, channel) {
  const background = channel === "normal" ? "#727a86" : channel === "roughness" ? "#626667" : "#6e685b";
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  for (let y = 0; y < height; y += 8) {
    for (let x = 0; x < width; x += 8) {
      const n = seededNoise(x * .41 + y * 1.17 + (channel === "normal" ? 40 : channel === "roughness" ? 80 : 0));
      const alpha = .025 + n * .065;
      context.fillStyle = channel === "normal" ? `rgba(32, 39, 50, ${alpha})` : `rgba(236, 232, 218, ${alpha})`;
      context.fillRect(x, y, 7, 7);
    }
  }
}

function drawCrack(context, points, channel) {
  context.save();
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.lineJoin = "round";
  context.lineCap = "round";

  if (channel === "albedo") {
    context.strokeStyle = "rgba(25, 27, 26, .82)";
    context.lineWidth = 8;
    context.stroke();
    context.strokeStyle = "rgba(205, 195, 170, .24)";
    context.lineWidth = 2;
    context.stroke();
  } else if (channel === "normal") {
    context.strokeStyle = "rgba(42, 48, 60, .68)";
    context.lineWidth = 10;
    context.stroke();
    context.translate(3, -3);
    context.strokeStyle = "rgba(188, 196, 211, .72)";
    context.lineWidth = 5;
    context.stroke();
  } else {
    context.strokeStyle = "rgba(30, 32, 32, .72)";
    context.lineWidth = 13;
    context.stroke();
    context.strokeStyle = "rgba(184, 188, 187, .30)";
    context.lineWidth = 4;
    context.stroke();
  }
  context.restore();
}

function drawTexture(canvas, channel, correlation) {
  const context = canvas.getContext("2d");
  const { width, height } = canvas;
  drawBaseTexture(context, width, height, channel);

  const points = Array.from({ length: 8 }, (_, index) => crackPoint(index, channel, correlation, width, height));
  drawCrack(context, points, channel);

  const branchStart = points[4];
  const branch = [
    branchStart,
    { x: branchStart.x + 28 + (1 - correlation) * (channel === "normal" ? 22 : -12), y: branchStart.y - 25 },
    { x: branchStart.x + 58 + (1 - correlation) * (channel === "roughness" ? -36 : 20), y: branchStart.y - 42 },
  ];
  drawCrack(context, branch, channel);

  context.fillStyle = "rgba(227, 225, 220, .72)";
  context.font = "10px IBM Plex Mono, monospace";
  context.fillText(channel.toUpperCase(), 11, 17);
}

function renderCorrelation() {
  const value = Number(correlationInput.value);
  const correlation = value / 100;
  Object.entries(textureCanvases).forEach(([channel, canvas]) => drawTexture(canvas, channel, correlation));

  document.querySelector("#correlation-value").textContent = `${value}%`;
  const sharedCost = Math.round(300 * (1 - correlation * .44));
  document.querySelector("#shared-cost").textContent = `${sharedCost} units`;

  let label = "低";
  let copy = "三个通道的结构位置差异很大，共享表示难以复用同一条边缘，联合压缩的收益会减弱。";
  if (value >= 67) {
    label = "高";
    copy = "裂缝与凸起在三张图中大体对齐，decoder 可以复用一份空间描述，再分别输出不同通道。";
  } else if (value >= 34) {
    label = "中";
    copy = "大轮廓仍能共享，但局部细节开始错位；latent 既要保存公共结构，也要补充各通道差异。";
  }
  document.querySelector("#shared-structure").textContent = label;
  document.querySelector("#correlation-explanation").textContent = copy;
}

correlationInput.addEventListener("input", renderCorrelation);
document.querySelector("#correlation-reset").addEventListener("click", () => {
  correlationInput.value = "78";
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
