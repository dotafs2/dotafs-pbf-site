(() => {
  "use strict";
  const zh = document.documentElement.lang.toLowerCase().startsWith("zh");
  const steps = document.getElementById("steps-input");
  const questions = document.getElementById("questions-input");
  const stepValue = document.getElementById("steps-value");
  const questionValue = document.getElementById("questions-value");
  const tokenRow = document.getElementById("token-row");
  const decisionRow = document.getElementById("decision-row");
  const stepsReadout = document.getElementById("steps-readout");
  const prob = document.getElementById("prob-input");
  const rate = document.getElementById("rate-input");
  const probValue = document.getElementById("prob-value");
  const rateValue = document.getElementById("rate-value");
  const probBar = document.getElementById("predicted-bar");
  const rateBar = document.getElementById("observed-bar");
  const calReadout = document.getElementById("cal-readout");

  function fillRow(row, amount, label, className) {
    row.replaceChildren();
    const count = Math.min(amount, 11);
    for (let i = 0; i < count; i++) {
      const item = document.createElement("span");
      item.textContent = label(i);
      if (className) item.className = className;
      row.append(item);
    }
    if (amount > count) {
      const end = document.createElement("span");
      end.textContent = `… ${amount}`;
      end.className = "ellipsis";
      row.append(end);
    }
  }
  function renderSteps() {
    const n = Number(steps.value);
    const q = Number(questions.value);
    stepValue.textContent = String(n);
    questionValue.textContent = String(q);
    fillRow(tokenRow, n, i => `t${i + 1}`);
    fillRow(decisionRow, q, i => `q${i + 1}`, "is-jev");
    stepsReadout.textContent = zh
      ? `教学抽象：GPT 生成 ${n} 个输出 Token 需要 ${n} 次依赖前一步的输出决策；Jev 对同一 state 的 ${q} 个独立问题在一次请求中并行评估。两种模型的内部计算量和真实耗时不能从这些格子推断。`
      : `Teaching abstraction: ${n} generated GPT tokens require ${n} dependent output steps. Jev evaluates ${q} independent questions on the same state in one parallel request. These blocks do not measure compute or elapsed time.`;
  }
  function renderCalibration() {
    const p = Number(prob.value) / 100;
    const q = Number(rate.value) / 100;
    const gap = Math.abs(p - q);
    const brier = q * (1 - p) ** 2 + (1 - q) * p ** 2;
    probValue.textContent = `${prob.value}%`;
    rateValue.textContent = `${rate.value}%`;
    probBar.style.width = `${prob.value}%`;
    rateBar.style.width = `${rate.value}%`;
    calReadout.textContent = zh
      ? `校准差 |p − f| = ${(gap * 100).toFixed(0)} 个百分点；该组二元事件的平均 Brier 分数 = ${brier.toFixed(3)}（越低越好）。即使 p 很高，若真实频率 f 很低，置信表达仍不可靠。`
      : `Calibration gap |p − f| = ${(gap * 100).toFixed(0)} percentage points; mean binary Brier score for this group = ${brier.toFixed(3)} (lower is better). A high p is unreliable if the observed frequency f is low.`;
  }
  if (steps && questions && prob && rate) {
    [steps, questions].forEach(el => el.addEventListener("input", renderSteps));
    [prob, rate].forEach(el => el.addEventListener("input", renderCalibration));
    document.getElementById("steps-reset").addEventListener("click", () => { steps.value = 8; questions.value = 4; renderSteps(); });
    document.getElementById("cal-reset").addEventListener("click", () => { prob.value = 80; rate.value = 80; renderCalibration(); });
    renderSteps();
    renderCalibration();
  }
})();
