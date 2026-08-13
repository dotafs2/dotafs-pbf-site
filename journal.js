function revealHashTarget() {
  if (!window.location.hash) return;
  const target = document.querySelector(window.location.hash);
  if (!target) return;
  window.requestAnimationFrame(() => target.scrollIntoView({ block: "start", behavior: "smooth" }));
}

window.addEventListener("load", revealHashTarget);
window.addEventListener("hashchange", revealHashTarget);
