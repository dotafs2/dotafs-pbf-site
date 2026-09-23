(() => {
  "use strict";

  const key = "dotafs-language";
  const path = window.location.pathname;
  const routes = {
    "/home/": { zh: "/home/", en: "/home/en/" },
    "/home/index.html": { zh: "/home/", en: "/home/en/" },
    "/home/en/": { zh: "/home/", en: "/home/en/" },
    "/home/en/index.html": { zh: "/home/", en: "/home/en/" },
    "/articles/vehicle-suspension-math.html": { zh: "/articles/vehicle-suspension-math-zh.html", en: "/articles/vehicle-suspension-math.html" },
    "/articles/vehicle-suspension-math-zh.html": { zh: "/articles/vehicle-suspension-math-zh.html", en: "/articles/vehicle-suspension-math.html" }
  };
  let choice;
  try { choice = localStorage.getItem(key); } catch (_) { choice = null; }
  if (choice !== "zh" && choice !== "en") choice = "en";

  // The historical /home/ link is the Chinese route. First-time visitors
  // arrive at English; explicitly selecting Chinese records the preference.
  if ((path === "/home/" || path === "/home/index.html") && choice === "en") {
    window.location.replace(`/home/en/${window.location.search}${window.location.hash}`);
    return;
  }

  function mount() {
    const pageLanguage = document.documentElement.lang.toLowerCase().startsWith("zh") ? "zh" : "en";
    const counterpart = routes[path];
    let switcher = document.querySelector(".next-language-switch");

    if (!switcher) {
      switcher = document.createElement("nav");
      switcher.className = "next-language-switch site-language-switch";
      const nextHeader = document.querySelector(".next-header-inner");
      const journalHeader = document.querySelector(".journal-header");
      if (nextHeader) {
        let content = nextHeader.querySelector(".next-header-content");
        if (!content) {
          content = document.createElement("div");
          content.className = "next-header-content";
          const menu = nextHeader.querySelector(".next-menu");
          nextHeader.append(content);
          if (menu) content.append(menu);
        }
        content.prepend(switcher);
      } else if (journalHeader) {
        journalHeader.append(switcher);
        switcher.classList.add("site-language-journal");
      } else {
        document.body.append(switcher);
        switcher.classList.add("site-language-floating");
      }
      switcher.innerHTML = '<a href="#" lang="zh-CN" hreflang="zh-CN" data-lang="zh">中文</a><span aria-hidden="true">/</span><a href="#" lang="en" hreflang="en" data-lang="en">EN</a>';
    }

    switcher.setAttribute("aria-label", pageLanguage === "zh" ? "语言切换" : "Language selector");
    for (const link of switcher.querySelectorAll("a")) {
      const lang = link.lang.toLowerCase().startsWith("zh") ? "zh" : "en";
      const destination = counterpart ? counterpart[lang] : path !== "/" && lang === pageLanguage
        ? `${path}${window.location.search}${window.location.hash}`
        : lang === "zh" ? "/home/" : "/home/en/";
      const active = counterpart ? lang === pageLanguage : path === "/" ? lang === choice : lang === pageLanguage;
      link.href = destination;
      link.dataset.lang = lang;
      link.classList.toggle("is-active", active);
      if (active && counterpart) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
      if (!counterpart && lang !== pageLanguage && path !== "/") {
        const explanation = pageLanguage === "zh" ? "本页暂无英文版，前往英文文章目录" : "No translation yet; open the Chinese article index";
        link.title = explanation;
        link.setAttribute("aria-label", explanation);
      }
      link.addEventListener("click", () => {
        try { localStorage.setItem(key, lang); } catch (_) { /* Navigation still works. */ }
      });
    }

    if (path === "/") {
      const entry = document.querySelector(".homepage-entry");
      if (entry) {
        entry.href = choice === "zh" ? "/home/" : "/home/en/";
        entry.setAttribute("aria-label", choice === "zh" ? "进入 DOTAFS 的个人主页" : "Open the DOTAFS personal homepage");
        const text = entry.querySelector("b");
        if (text) text.textContent = choice === "zh" ? "我的个人主页" : "Personal homepage";
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
