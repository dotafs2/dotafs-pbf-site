(() => {
  "use strict";
  const video = document.getElementById("boston-water-video");
  if (!video) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let visible = false;
  video.muted = true;
  function syncPlayback() {
    if (visible && !document.hidden && !reducedMotion.matches) {
      video.play().catch(() => { /* Keep the poster if autoplay is unavailable. */ });
    } else {
      video.pause();
    }
  }
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncPlayback();
  }, { threshold: 0.01 });
  observer.observe(video);
  reducedMotion.addEventListener("change", syncPlayback);
  document.addEventListener("visibilitychange", syncPlayback);
})();
