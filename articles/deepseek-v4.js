const progressBar = document.querySelector("#read-progress-bar");

function updateProgress() {
  if (!progressBar) return;
  const height = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = height > 0 ? window.scrollY / height : 0;
  progressBar.style.width = `${Math.min(1, Math.max(0, ratio)) * 100}%`;
}

window.addEventListener("scroll", updateProgress, { passive: true });
window.addEventListener("resize", updateProgress);
updateProgress();

const techCopy = {
  attention: {
    label: "HYBRID ATTENTION / 混合注意力",
    copy: "CSA 像“先把旧记录做成摘要，再用索引找出最相关的几段”；HCA 像“把更大段历史压成更短的概要，然后仍然全部阅读”。两者交错，再补一条最近 Token 的滑动窗口。",
  },
  mhc: {
    label: "mHC / 受约束的多路残差",
    copy: "它把传统的一条残差信息流扩成多条通道，再把通道之间的混合限制在不会无限放大信号的数学范围内。目标是：网络更有表达力，但堆得很深时仍能稳定训练。",
  },
  muon: {
    label: "MUON / 参数更新优化器",
    copy: "它会整理矩阵梯度的方向，使更新不都挤在少数方向上。V4 让大部分模块使用 Muon，但 Embedding、预测头、RMSNorm 等仍然使用 AdamW，所以它是一套混合优化方案。",
  },
};

const techButtons = [...document.querySelectorAll("[data-tech]")];
const techLabel = document.querySelector("#tech-label");
const techText = document.querySelector("#tech-copy");

techButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.tech;
    techButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    techLabel.textContent = techCopy[key].label;
    techText.textContent = techCopy[key].copy;
  });
});

const contextSteps = [8, 16, 32, 64, 128, 256, 512, 1024];
const contextRange = document.querySelector("#context-range");
const contextValue = document.querySelector("#context-value");
const denseCost = document.querySelector("#dense-cost");
const sparseCost = document.querySelector("#sparse-cost");
const denseBar = document.querySelector("#dense-bar");
const sparseBar = document.querySelector("#sparse-bar");

function compactNumber(value) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1)}M×`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K×`;
  return `${Math.round(value)}×`;
}

function updateContextLab() {
  if (!contextRange) return;
  const lengthK = contextSteps[Number(contextRange.value)];
  const dense = lengthK * lengthK;
  const sparse = lengthK;
  const maxDense = 1024 * 1024;
  const denseWidth = 8 + Math.sqrt(dense / maxDense) * 92;
  const sparseWidth = 8 + Math.sqrt(sparse / 1024) * 46;

  contextValue.textContent = lengthK === 1024 ? "1M" : `${lengthK}K`;
  denseCost.textContent = compactNumber(dense);
  sparseCost.textContent = compactNumber(sparse);
  denseBar.style.width = `${denseWidth}%`;
  sparseBar.style.width = `${sparseWidth}%`;
}

contextRange?.addEventListener("input", updateContextLab);
updateContextLab();

const effortCopy = {
  none: {
    task: "日常问答、改写与简单任务",
    time: 24,
    budget: 18,
    copy: "尽快给出答案，不展开长推理。速度更快、成本更低，但不适合高难度规划。",
  },
  high: {
    task: "复杂问题、计划与日常 Agent",
    time: 58,
    budget: 55,
    copy: "模型显式生成更长的思考过程，通常更慢，但在复杂问题上更可靠。",
  },
  max: {
    task: "困难数学、长链调试与能力边界",
    time: 96,
    budget: 100,
    copy: "尽可能增加推理投入。它不是保证正确，而是愿意花更多 Token 搜索、验证和修正答案。",
  },
};

const effortButtons = [...document.querySelectorAll("[data-effort]")];
const effortTask = document.querySelector("#effort-task");
const effortTime = document.querySelector("#effort-time");
const effortBudget = document.querySelector("#effort-budget");
const effortText = document.querySelector("#effort-copy");

function selectEffort(button) {
  const mode = button.dataset.effort;
  const value = effortCopy[mode];
  effortButtons.forEach((item) => {
    const active = item === button;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  effortTask.textContent = value.task;
  effortTime.style.width = `${value.time}%`;
  effortBudget.style.width = `${value.budget}%`;
  effortText.textContent = value.copy;
}

effortButtons.forEach((button) => button.addEventListener("click", () => selectEffort(button)));

const initialEffort = effortButtons.find((button) => button.classList.contains("is-active"));
if (initialEffort) selectEffort(initialEffort);

const tocLinks = [...document.querySelectorAll(".wm-toc nav a[href^='#']")];
const tocSections = tocLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

if ("IntersectionObserver" in window && tocSections.length) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    tocLinks.forEach((link) => {
      link.classList.toggle("is-current", link.getAttribute("href") === `#${visible.target.id}`);
    });
  }, { rootMargin: "-18% 0px -68%", threshold: [0.05, 0.2, 0.5] });
  tocSections.forEach((section) => observer.observe(section));
}

