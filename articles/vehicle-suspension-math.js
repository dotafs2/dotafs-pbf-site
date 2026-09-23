(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (v, n = 2) => Number(v).toFixed(n);
  const ink = { grid: "#555958", text: "#c9cac5", muted: "#a1a5a2", main: "#9caeaa", second: "#e0dcd3", faint: "#797d7a" };

  function setupCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(240, rect.width), h = rect.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }
  function base(ctx, w, h, xLabel, yLabel, pad = { l: 48, r: 16, t: 18, b: 36 }) {
    const x0 = pad.l, x1 = w - pad.r, y0 = pad.t, y1 = h - pad.b;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = ink.grid; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      let y = y0 + i * (y1 - y0) / 4;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    }
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = ink.muted; ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillText(yLabel, x0 + 5, y0 + 14); ctx.fillText(xLabel, Math.max(x0 + 5, x1 - ctx.measureText(xLabel).width), h - 10);
    return { x0, x1, y0, y1 };
  }
  function line(ctx, points, color, width = 2) {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function dot(ctx, x, y, color, radius = 5) {
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  }
  function label(ctx, text, x, y, color) { ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillStyle = color; ctx.fillText(text, x, y); }

  function suspension() {
    const k = +$("k-input").value * 1000, zeta = +$("zeta-input").value;
    const road = +$("bump-input").value / 1000, mass = 300;
    $("k-value").textContent = fmt(k / 1000, 0);
    $("zeta-value").textContent = fmt(zeta);
    $("bump-value").textContent = fmt(road * 1000, 0);
    const c = zeta * 2 * Math.sqrt(k * mass), wn = Math.sqrt(k / mass);
    // Fixed-step semi-implicit Euler, initialized at the old road equilibrium.
    const dt = .0015, duration = 3.5, values = [];
    let y = 0, v = 0, peak = 0;
    for (let i = 0; i <= Math.round(duration / dt); i++) {
      const t = i * dt;
      if (i > 0) { v += (k * (road - y) - c * v) / mass * dt; y += v * dt; }
      if (i % 8 === 0) values.push({ t, y });
      peak = Math.max(peak, y);
    }
    const { ctx, w, h } = setupCanvas($("suspension-plot"));
    const a = base(ctx, w, h, "time (s) →", "height (mm) ↑");
    const range = Math.max(road * 1.7, peak * 1.22, .05);
    const sx = t => a.x0 + t / duration * (a.x1 - a.x0);
    const sy = d => a.y1 - d / range * (a.y1 - a.y0);
    for (let i = 0; i <= 4; i++) label(ctx, fmt((4 - i) * range * 250, 0), 5, a.y0 + i * (a.y1 - a.y0) / 4 + 3, ink.muted);
    const roadY = sy(road); line(ctx, [[a.x0, roadY], [a.x1, roadY]], ink.faint, 2);
    line(ctx, values.map(vv => [sx(vv.t), sy(vv.y)]), ink.main, 2.5);
    label(ctx, "body", a.x0 + 9, a.y0 + 29, ink.main); label(ctx, "road", a.x0 + 9, a.y0 + 45, ink.faint);
    for (let i = 0; i <= 3; i++) label(ctx, fmt(duration * i / 3, 1), sx(duration * i / 3) - 5, a.y1 + 15, ink.muted);
    $("suspension-readout").textContent = `Natural frequency ${fmt(wn / (2 * Math.PI))} Hz · c = ${fmt(c, 0)} N·s/m · static compression under 300 kg: ${fmt(mass * 9.81 / k * 1000, 0)} mm · step overshoot ${fmt(Math.max(0, peak - road) * 1000, 0)} mm.`;
  }

  function grip() {
    const fx = +$("fx-input").value, fy = +$("fy-input").value, mu = +$("mu-input").value;
    $("fx-value").textContent = fmt(fx); $("fy-value").textContent = fmt(fy); $("mu-value").textContent = fmt(mu);
    const mag = Math.hypot(fx, fy), scale = mag > mu ? mu / mag : 1;
    const { ctx, w, h } = setupCanvas($("grip-plot"));
    const square = Math.min(h - 42, w - 132), cx = (w - 38) / 2 + 13, cy = (h - 30) / 2 + 5;
    const unit = square / 3.8;
    ctx.clearRect(0, 0, w, h); ctx.strokeStyle = ink.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - square / 2, cy); ctx.lineTo(cx + square / 2, cy); ctx.moveTo(cx, cy - square / 2); ctx.lineTo(cx, cy + square / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, mu * unit, 0, Math.PI * 2); ctx.strokeStyle = ink.main; ctx.lineWidth = 2; ctx.stroke();
    const px = cx + fx * unit, py = cy - fy * unit, ax = cx + fx * scale * unit, ay = cy - fy * scale * unit;
    line(ctx, [[cx, cy], [px, py]], ink.faint, 1.5); dot(ctx, px, py, ink.faint, 4);
    line(ctx, [[cx, cy], [ax, ay]], ink.second, 2.5); dot(ctx, ax, ay, ink.second, 5);
    label(ctx, "Fy / Fz ↑", Math.max(5, cx - square / 2), 24, ink.muted);
    label(ctx, "Fx / Fz →", Math.min(w - 86, cx + square / 2 - 75), h - 9, ink.muted);
    label(ctx, "requested · gray", 10, h - 34, ink.faint); label(ctx, "delivered · light", 10, h - 18, ink.second);
    $("grip-readout").textContent = `Requested |F| / Fz = ${fmt(mag)}, available μ = ${fmt(mu)}. Delivered Fx / Fz = ${fmt(fx * scale)}, Fy / Fz = ${fmt(fy * scale)}. ${mag > mu ? "Both components are reduced because grip is shared." : "The request is inside the grip boundary."}`;
  }

  function tire() {
    const kind = $("tire-model").value, s = +$("slip-input").value;
    $("slip-value").textContent = fmt(s);
    const curve = x => {
      const sign = Math.sign(x), ax = Math.abs(x);
      if (kind === "grip") return sign * Math.min(1, ax / .12);
      if (kind === "state") return sign * Math.sqrt(Math.min(1, ax / .17));
      const B = 11, C = 1.7, D = 1, E = .65;
      return D * Math.sin(C * Math.atan(B * x - E * (B * x - Math.atan(B * x))));
    };
    const { ctx, w, h } = setupCanvas($("tire-plot"));
    const a = base(ctx, w, h, "slip ratio κ →", "Fx / reference load ↑");
    const sx = x => a.x0 + (x + .5) * (a.x1 - a.x0);
    const sy = y => a.y0 + (1.17 - y) / 2.34 * (a.y1 - a.y0);
    line(ctx, [[a.x0, sy(0)], [a.x1, sy(0)]], ink.grid, 1);
    for (const y of [-1, 0, 1]) label(ctx, String(y), 24, sy(y) + 4, ink.muted);
    for (const x of [-.5, -.25, 0, .25, .5]) label(ctx, fmt(x, 2), sx(x) - 14, a.y1 + 16, ink.muted);
    const values = []; for (let i = 0; i <= 200; i++) { let x = -.5 + i / 200; values.push([sx(x), sy(curve(x))]); }
    line(ctx, values, ink.main, 2.5); dot(ctx, sx(s), sy(curve(s)), ink.second, 5);
    const messages = {
      grip: "Force rises linearly then hits a flat grip limit; this is a teaching abstraction of a clamped force budget.",
      state: "A shaped, bounded slip response responds strongly at low slip; real AVS also interpolates slip state over time.",
      magic: "Sine–arctangent curvature creates a peak and changing post-peak behavior; real fitted tires require measured coefficients."
    };
    $("tire-readout").textContent = `At κ = ${fmt(s)}, illustrative Fx / load = ${fmt(curve(s))}. ${messages[kind]}`;
  }

  const labs = [
    { controls: ["k-input", "zeta-input", "bump-input"], reset: "suspension-reset", defaults: ["30", "0.55", "60"], draw: suspension },
    { controls: ["fx-input", "fy-input", "mu-input"], reset: "grip-reset", defaults: ["0.6", "0.65", "0.9"], draw: grip },
    { controls: ["tire-model", "slip-input"], reset: "tire-reset", defaults: ["grip", "0.12"], draw: tire }
  ];
  for (const lab of labs) {
    lab.controls.forEach(id => $(id).addEventListener("input", lab.draw));
    $(lab.reset).addEventListener("click", () => { lab.controls.forEach((id, i) => { $(id).value = lab.defaults[i]; }); lab.draw(); });
    lab.draw();
  }
  let resizeTimer;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => labs.forEach(lab => lab.draw()), 80); });
})();
