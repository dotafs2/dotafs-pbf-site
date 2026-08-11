function revealHashTarget() {
  if (!window.location.hash) return;

  const target = document.querySelector(window.location.hash);
  if (!target) return;

  window.requestAnimationFrame(() => {
    target.scrollIntoView({ block: "start", behavior: "instant" });
  });
}

window.addEventListener("load", () => {
  window.setTimeout(revealHashTarget, 80);
});

window.addEventListener("hashchange", revealHashTarget);
