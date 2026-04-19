(() => {
  const BOOKMARK_KEY = "xistory:bookmarks:v1";

  const el = (id) => document.getElementById(id);
  const listView = el("list-view");
  const detailView = el("detail-view");
  const listEl = el("list");
  const metaEl = el("meta");
  const searchEl = el("search");
  const tabsEl = el("tabs");

  let DATA = { problems: [], sections: {} };
  let currentTab = "all";
  let bookmarks = new Set(JSON.parse(localStorage.getItem(BOOKMARK_KEY) || "[]"));

  const saveBookmarks = () =>
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify([...bookmarks]));

  const sectionOf = (code) => code[0];

  function naturalSort(a, b) {
    const sa = sectionOf(a.code), sb = sectionOf(b.code);
    if (sa !== sb) return sa.localeCompare(sb);
    return (+a.code.slice(1)) - (+b.code.slice(1));
  }

  function filteredProblems() {
    const q = searchEl.value.trim().toUpperCase();
    let items = [...DATA.problems];
    if (currentTab === "bookmark") {
      items = items.filter((p) => bookmarks.has(p.code));
    } else if (currentTab !== "all") {
      items = items.filter((p) => sectionOf(p.code) === currentTab);
    }
    if (q) items = items.filter((p) => p.code.includes(q));
    return items.sort(naturalSort);
  }

  function renderList() {
    const items = filteredProblems();
    listEl.innerHTML = "";
    if (items.length === 0) {
      listEl.innerHTML = `<li class="empty">일치하는 문제가 없어요.</li>`;
      metaEl.textContent = "0문항";
      return;
    }
    metaEl.textContent = `${items.length}문항`;
    const frag = document.createDocumentFragment();
    for (const p of items) {
      const li = document.createElement("li");
      li.className = "card";
      li.dataset.code = p.code;
      li.innerHTML = `
        ${bookmarks.has(p.code) ? `<span class="star">⭐</span>` : ""}
        <div class="code">${p.code}</div>
        <span class="sec">${DATA.sections[sectionOf(p.code)] || ""}</span>
      `;
      li.addEventListener("click", () => openDetail(p.code));
      frag.appendChild(li);
    }
    listEl.appendChild(frag);
  }

  function renderTabs() {
    tabsEl.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === currentTab);
    });
  }

  function openDetail(code) {
    const p = DATA.problems.find((x) => x.code === code);
    if (!p) return;
    el("detail-code").textContent = p.code;
    el("detail-section").textContent =
      `${sectionOf(p.code)} · ${DATA.sections[sectionOf(p.code)] || ""}`;
    const img = el("detail-img");
    img.src = `${p.code}.png`;
    img.alt = p.code;

    const ansBox = el("answer");
    ansBox.textContent = p.answer ?? "(정답 미등록)";
    ansBox.classList.add("hidden");
    el("reveal-btn").textContent = "정답 보기";

    updateBookmarkBtn(p.code);

    listView.hidden = true;
    detailView.hidden = false;
    window.scrollTo({ top: 0, behavior: "instant" });
    history.replaceState({ code }, "", `#${p.code}`);
  }

  function closeDetail() {
    detailView.hidden = true;
    listView.hidden = false;
    history.replaceState({}, "", location.pathname + location.search);
  }

  function updateBookmarkBtn(code) {
    const btn = el("bookmark-btn");
    const on = bookmarks.has(code);
    btn.classList.toggle("on", on);
    btn.textContent = on ? "⭐" : "☆";
  }

  function toggleBookmark() {
    const code = el("detail-code").textContent;
    if (!code) return;
    if (bookmarks.has(code)) bookmarks.delete(code);
    else bookmarks.add(code);
    saveBookmarks();
    updateBookmarkBtn(code);
  }

  function randomProblem(fromFiltered = false) {
    const pool = fromFiltered ? filteredProblems() : DATA.problems;
    if (pool.length === 0) return;
    const p = pool[Math.floor(Math.random() * pool.length)];
    openDetail(p.code);
  }

  function neighborProblem(delta) {
    const code = el("detail-code").textContent;
    const sorted = [...DATA.problems].sort(naturalSort);
    const idx = sorted.findIndex((p) => p.code === code);
    if (idx < 0) return;
    const next = sorted[(idx + delta + sorted.length) % sorted.length];
    openDetail(next.code);
  }

  // Event wiring
  searchEl.addEventListener("input", renderList);

  tabsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    currentTab = btn.dataset.tab;
    renderTabs();
    renderList();
  });

  el("random-btn").addEventListener("click", () => randomProblem(true));
  el("random-btn-2").addEventListener("click", () => randomProblem(false));
  el("back-btn").addEventListener("click", closeDetail);
  el("bookmark-btn").addEventListener("click", toggleBookmark);
  el("prev-btn").addEventListener("click", () => neighborProblem(-1));
  el("next-btn").addEventListener("click", () => neighborProblem(1));

  el("reveal-btn").addEventListener("click", () => {
    const ans = el("answer");
    if (ans.classList.contains("hidden")) {
      ans.classList.remove("hidden");
      el("reveal-btn").textContent = "정답 숨기기";
    } else {
      ans.classList.add("hidden");
      el("reveal-btn").textContent = "정답 보기";
    }
  });

  document.addEventListener("keydown", (e) => {
    if (!detailView.hidden) {
      if (e.key === "Escape") closeDetail();
      if (e.key === "ArrowLeft") neighborProblem(-1);
      if (e.key === "ArrowRight") neighborProblem(1);
      if (e.key === " ") {
        e.preventDefault();
        el("reveal-btn").click();
      }
    }
  });

  // Boot
  fetch("data.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((d) => {
      DATA = d;
      renderTabs();
      renderList();

      const hash = decodeURIComponent(location.hash.slice(1));
      if (hash && DATA.problems.some((p) => p.code === hash)) {
        openDetail(hash);
      }
    })
    .catch((err) => {
      metaEl.textContent = "데이터 로드 실패: " + err.message;
    });
})();
