(() => {
  const setPressed = (buttons, activeButton) => {
    buttons.forEach((button) => {
      const active = button === activeButton;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };

  const swarmLab = document.querySelector("[data-swarm-lab]");
  if (swarmLab) {
    const metrics = {
      resilience: {
        caption: "Portfolio resilience at tick 3,200. Shared societies preserve a broader set of viable solutions.",
        rows: [
          ["Explicit culture", 0.2474],
          ["No explicit culture", 0.2365],
          ["100 isolated agents", 0.1794],
        ],
      },
      inventions: {
        caption: "Mean validated inventions in the long-horizon runs. The no-explicit-culture condition is highest.",
        rows: [
          ["Explicit culture", 5.75],
          ["No explicit culture", 7.0],
          ["100 isolated agents", 2.75],
        ],
      },
      strongest: {
        caption: "Endpoint score of the strongest single artifact. The paper explicitly reports 0.3488 for isolated search and 0.2380 for explicit culture; the matching no-explicit-culture value is not reported in that result summary.",
        rows: [
          ["Explicit culture", 0.238],
          ["No explicit culture", null],
          ["100 isolated agents", 0.3488],
        ],
      },
    };
    const buttons = [...swarmLab.querySelectorAll("[data-swarm-metric]")];
    const rows = [...swarmLab.querySelectorAll(".bar-row")];
    const caption = swarmLab.querySelector("[data-swarm-caption]");

    const render = (key, button) => {
      const metric = metrics[key];
      const values = metric.rows.map((row) => row[1]).filter((value) => value !== null);
      const max = Math.max(...values);
      metric.rows.forEach(([label, value], index) => {
        const row = rows[index];
        row.querySelector("span").textContent = label;
        row.querySelector(".bar-fill").style.width = value === null ? "0%" : `${(value / max) * 100}%`;
        row.querySelector("output").textContent = value === null ? "Not reported" : value.toFixed(key === "inventions" ? 2 : 4);
        row.classList.toggle("is-strong", value === max);
      });
      caption.textContent = metric.caption;
      setPressed(buttons, button);
    };

    buttons.forEach((button) => button.addEventListener("click", () => render(button.dataset.swarmMetric, button)));
    render("resilience", buttons[0]);
  }

  const societyLab = document.querySelector("[data-society-lab]");
  if (societyLab) {
    const worlds = {
      claude: ["10 / 10", "Strong", "None", "Stability: institutions stayed active, but the authors also describe the 98% approval rate as rubber-stamp governance."],
      grok: ["0 / 10", "Low", "Extreme", "Collapse: violence escalated until every resident died."],
      gemini: ["10 / 10", "Moderate", "Extreme", "Shared hallucination: residents survived while converging on a collective narrative detached from world state."],
      gpt: ["0 / 10", "None", "Low", "Dysfunction: no workable governance emerged, and no residents survived."],
      mixed: ["3 / 10", "Fragile", "Medium", "Complexity: model differences entered the same society and produced a sharp split in norm compliance."],
    };
    const buttons = [...societyLab.querySelectorAll("[data-world]")];
    const outputs = [...societyLab.querySelectorAll("[data-world-output]")];
    const trait = societyLab.querySelector("[data-world-trait]");
    const render = (key, button) => {
      const world = worlds[key];
      outputs.forEach((output, index) => { output.textContent = world[index]; });
      trait.textContent = world[3];
      setPressed(buttons, button);
    };
    buttons.forEach((button) => button.addEventListener("click", () => render(button.dataset.world, button)));
    render("claude", buttons[0]);
  }

  const versionLab = document.querySelector("[data-version-lab]");
  if (versionLab) {
    const buttons = [...versionLab.querySelectorAll("[data-decision]")];
    const candidate = versionLab.querySelector("[data-candidate]");
    const arrow = versionLab.querySelector("[data-version-arrow]");
    const history = versionLab.querySelector("[data-history]");
    const tests = versionLab.querySelector("[data-tests]");
    const provenance = versionLab.querySelector("[data-provenance]");
    const message = versionLab.querySelector("[data-version-message]");

    const render = (decision, button) => {
      const accepted = decision === "accept";
      candidate.classList.toggle("is-accepted", accepted);
      candidate.classList.toggle("is-rejected", !accepted);
      candidate.querySelector("span").textContent = accepted ? "ACCEPTED WORLD" : "REJECTED BRANCH";
      candidate.querySelector("strong").textContent = accepted ? "v₄₂" : "v₄₁";
      arrow.textContent = accepted ? "→" : "×";
      history.textContent = accepted ? "v₄₁ → v₄₂" : "Remains v₄₁";
      tests.textContent = accepted ? "Constraints pass" : "Candidate excluded";
      provenance.textContent = accepted ? "Episode + diff stored" : "Rejection stored";
      message.textContent = accepted
        ? "The parent accepts the candidate. Persistent history advances, and the next finite-lived agent continues from v₄₂."
        : "The parent rejects the candidate. The recursive branch ends while the persistent world stays at v₄₁. An agent's work does not itself change accepted history.";
      setPressed(buttons, button);
    };
    buttons.forEach((button) => button.addEventListener("click", () => render(button.dataset.decision, button)));
    render("accept", buttons[0]);
  }

  const tocLinks = [...document.querySelectorAll(".agent-world-page .wm-toc a[href^='#']")];
  const sections = tocLinks.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  if ("IntersectionObserver" in window && sections.length) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      tocLinks.forEach((link) => link.classList.toggle("is-current", link.getAttribute("href") === `#${visible.target.id}`));
    }, { rootMargin: "-20% 0px -65%", threshold: [0, 0.25, 0.75] });
    sections.forEach((section) => observer.observe(section));
  }
})();
