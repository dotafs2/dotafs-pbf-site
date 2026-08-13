const root = document.documentElement;
const themeToggle = document.querySelector("#theme-toggle");
const storageKey = "dotafs-journal-theme";

function preferredTheme() {
  const storedTheme = window.localStorage.getItem(storageKey);
  if (storedTheme === "light" || storedTheme === "dark") return storedTheme;
  return "light";
}

function applyTheme(theme) {
  root.dataset.theme = theme;

  if (!themeToggle) return;
  const isDark = theme === "dark";
  themeToggle.querySelector("span").textContent = isDark ? "☀" : "☾";
  themeToggle.setAttribute("aria-label", isDark ? "切换到浅色模式" : "切换到深色模式");
}

applyTheme(preferredTheme());

themeToggle?.addEventListener("click", () => {
  const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
  window.localStorage.setItem(storageKey, nextTheme);
  applyTheme(nextTheme);
});

function revealHashTarget() {
  if (!window.location.hash) return;
  const target = document.querySelector(window.location.hash);
  if (!target) return;
  window.requestAnimationFrame(() => target.scrollIntoView({ block: "start", behavior: "smooth" }));
}

window.addEventListener("load", revealHashTarget);
window.addEventListener("hashchange", revealHashTarget);
