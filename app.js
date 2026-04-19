(() => {
  const BOOKMARK_KEY = "xistory:bookmarks:v1";
  const TAG_KEY = "xistory:tags:v1";
  const VALID_TAGS = ["red", "orange", "yellow", "green", "blue"];

  const el = (id) => document.getElementById(id);
  const listView = el("list-view");
  const detailView = el("detail-view");
  const listEl = el("list");
  const metaEl = el("meta");
  const searchEl = el("search");
  const tabsEl = el("tabs");
  const imageWrap = el("image-wrap");
  const tagRow = el("tag-row");

  let DATA = { problems: [], sections: {} };
  let currentTab = "all";
  let bookmarks = new Set(JSON.parse(localStorage.getItem(BOOKMARK_KEY) || "[]"));
  let tags = (() => {
    try { return JSON.parse(localStorage.getItem(TAG_KEY) || "{}"); }
    catch { return {}; }
  })();

  const saveBookmarks = () =>
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify([...bookmarks]));
  const saveTags = () =>
    localStorage.setItem(TAG_KEY, JSON.stringify(tags));

  const getTag = (code) => {
    const t = tags[code];
    return VALID_TAGS.includes(t) ? t : "";
  };
  const setTag = (code, tag) => {
    if (!tag) delete tags[code];
    else if (VALID_TAGS.includes(tag)) tags[code] = tag;
    saveTags();
  };

  // ===== Preload + loading state =====
  const preloaded = new Map(); // code -> HTMLImageElement
  function preload(code) {
    if (preloaded.has(code)) return;
    const img = new Image();
    img.src = `${code}.png`;
    preloaded.set(code, img);
  }
  function preloadNeighbors(code) {
    const sorted = siblingPool();
    const idx = sorted.findIndex((p) => p.code === code);
    if (idx < 0) return;
    const next = sorted[(idx + 1) % sorted.length];
    const prev = sorted[(idx - 1 + sorted.length) % sorted.length];
    preload(next.code);
    preload(prev.code);
  }

  function setDetailImage(code) {
    const img = el("detail-img");
    imageWrap.classList.remove("errored");
    imageWrap.classList.add("loading");
    img.onload = () => imageWrap.classList.remove("loading");
    img.onerror = () => {
      imageWrap.classList.remove("loading");
      imageWrap.classList.add("errored");
    };
    img.src = `${code}.png`;
    img.alt = code;
    // Cached? then onload may have already fired synchronously
    if (img.complete && img.naturalWidth > 0) {
      imageWrap.classList.remove("loading");
    }
  }

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
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = currentTab === "bookmark"
        ? "아직 북마크한 문제가 없어요."
        : "일치하는 문제가 없어요.";
      listEl.appendChild(li);
      metaEl.textContent = "0문항";
      return;
    }
    metaEl.textContent = `${items.length}문항`;
    const frag = document.createDocumentFragment();
    for (const p of items) {
      const li = document.createElement("li");
      const tag = getTag(p.code);
      li.className = "card" + (tag ? ` tag-${tag}` : "");
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

  function updateTagPicker(code) {
    const current = getTag(code);
    tagRow.querySelectorAll(".tag-chip").forEach((btn) => {
      btn.classList.toggle("selected", (btn.dataset.tag || "") === current);
    });
  }

  function renderTabs() {
    tabsEl.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === currentTab);
    });
  }

  // ===== Detail view =====
  function showDetailFor(code, { animate = null } = {}) {
    const p = DATA.problems.find((x) => x.code === code);
    if (!p) return;

    el("detail-code").textContent = p.code;
    el("detail-section").textContent =
      `${sectionOf(p.code)} · ${DATA.sections[sectionOf(p.code)] || ""}`;

    setDetailImage(p.code);

    const ansBox = el("answer");
    ansBox.textContent = p.answer ?? "(정답 미등록)";
    ansBox.classList.add("hidden");
    el("reveal-btn").textContent = "정답 보기";

    updateBookmarkBtn(p.code);
    updateTagPicker(p.code);

    // Preload neighbors for instant prev/next
    preloadNeighbors(p.code);

    if (animate === "left" || animate === "right") {
      imageWrap.classList.remove("swipe-out-left", "swipe-out-right", "swipe-in");
      imageWrap.classList.add(animate === "left" ? "swipe-in-left" : "swipe-in-right");
      requestAnimationFrame(() => {
        imageWrap.classList.add("swipe-in");
        imageWrap.classList.remove("swipe-in-left", "swipe-in-right");
      });
      setTimeout(() => imageWrap.classList.remove("swipe-in"), 260);
    }
  }

  function openDetail(code) {
    const isAlreadyInDetail = !detailView.hidden;
    showDetailFor(code);
    if (!isAlreadyInDetail) {
      listView.hidden = true;
      detailView.hidden = false;
      history.pushState({ view: "detail", code }, "", `#${code}`);
    } else {
      history.replaceState({ view: "detail", code }, "", `#${code}`);
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function closeDetail({ fromPop = false } = {}) {
    detailView.hidden = true;
    listView.hidden = false;
    if (!fromPop) {
      history.back();
    }
  }

  function updateBookmarkBtn(code) {
    const btn = el("bookmark-btn");
    const svg = el("bookmark-svg");
    const on = bookmarks.has(code);
    btn.classList.toggle("on", on);
    svg.setAttribute("fill", on ? "currentColor" : "none");
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
    const current = !detailView.hidden ? el("detail-code").textContent : null;
    let p = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && p.code === current) {
      p = pool[(pool.indexOf(p) + 1) % pool.length];
    }
    openDetail(p.code);
  }

  function siblingPool() {
    const sorted = [...DATA.problems].sort(naturalSort);
    return sorted;
  }

  function moveNeighbor(delta, viaSwipe = false) {
    const code = el("detail-code").textContent;
    const sorted = siblingPool();
    const idx = sorted.findIndex((p) => p.code === code);
    if (idx < 0) return;
    const next = sorted[(idx + delta + sorted.length) % sorted.length];

    if (viaSwipe) {
      const outClass = delta > 0 ? "swipe-out-left" : "swipe-out-right";
      imageWrap.classList.add(outClass);
      setTimeout(() => {
        imageWrap.classList.remove("swipe-out-left", "swipe-out-right");
        showDetailFor(next.code, { animate: delta > 0 ? "left" : "right" });
        history.replaceState({ view: "detail", code: next.code }, "", `#${next.code}`);
      }, 180);
    } else {
      showDetailFor(next.code, { animate: delta > 0 ? "left" : "right" });
      history.replaceState({ view: "detail", code: next.code }, "", `#${next.code}`);
    }
  }

  // ===== Swipe handling =====
  (function setupSwipe() {
    let startX = 0, startY = 0, startT = 0;
    let active = false;
    const THRESH = 60;
    const RATIO = 1.4;
    const MAX_TIME = 800;

    imageWrap.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) { active = false; return; }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startT = Date.now();
      active = true;
    }, { passive: true });

    imageWrap.addEventListener("touchmove", (e) => {
      if (!active) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dy) > Math.abs(dx)) { active = false; return; }
      // Follow finger slightly for feedback
      imageWrap.classList.add("swiping");
      imageWrap.style.transform = `translateX(${dx * 0.5}px)`;
      imageWrap.style.opacity = String(Math.max(0.4, 1 - Math.abs(dx) / 400));
    }, { passive: true });

    imageWrap.addEventListener("touchend", (e) => {
      if (!active) return;
      active = false;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      const dt = Date.now() - startT;

      // reset inline transform
      imageWrap.classList.remove("swiping");
      imageWrap.style.transform = "";
      imageWrap.style.opacity = "";

      if (dt < MAX_TIME && Math.abs(dx) > THRESH && Math.abs(dx) > Math.abs(dy) * RATIO) {
        moveNeighbor(dx < 0 ? 1 : -1, true);
      }
    }, { passive: true });

    imageWrap.addEventListener("touchcancel", () => {
      active = false;
      imageWrap.classList.remove("swiping");
      imageWrap.style.transform = "";
      imageWrap.style.opacity = "";
    }, { passive: true });
  })();

  // ===== Scroll border on detail topbar =====
  const detailTop = detailView.querySelector(".topbar");
  window.addEventListener("scroll", () => {
    if (detailView.hidden) return;
    detailTop.classList.toggle("scrolled", window.scrollY > 4);
  }, { passive: true });

  // ===== Event wiring =====
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
  el("back-btn").addEventListener("click", () => closeDetail());
  el("bookmark-btn").addEventListener("click", toggleBookmark);
  el("prev-btn").addEventListener("click", () => moveNeighbor(-1));
  el("next-btn").addEventListener("click", () => moveNeighbor(1));

  tagRow.addEventListener("click", (e) => {
    const btn = e.target.closest(".tag-chip");
    if (!btn) return;
    const code = el("detail-code").textContent;
    if (!code) return;
    const newTag = btn.dataset.tag || "";
    const current = getTag(code);
    // Clicking the already-selected colored chip clears the tag (quick toggle)
    const final = current === newTag && newTag !== "" ? "" : newTag;
    setTag(code, final);
    updateTagPicker(code);
    // Keep list in sync for when user returns
    renderList();
  });

  el("reveal-btn").addEventListener("click", () => {
    const ans = el("answer");
    const btn = el("reveal-btn");
    if (ans.classList.contains("hidden")) {
      ans.classList.remove("hidden");
      btn.textContent = "정답 숨기기";
    } else {
      ans.classList.add("hidden");
      btn.textContent = "정답 보기";
    }
  });

  // Android/browser back → close detail
  window.addEventListener("popstate", (e) => {
    if (!detailView.hidden) {
      closeDetail({ fromPop: true });
    }
  });

  document.addEventListener("keydown", (e) => {
    if (!detailView.hidden) {
      if (e.key === "Escape") closeDetail();
      if (e.key === "ArrowLeft") moveNeighbor(-1);
      if (e.key === "ArrowRight") moveNeighbor(1);
      if (e.key === " ") {
        e.preventDefault();
        el("reveal-btn").click();
      }
    }
  });

  // ===== Boot =====
  fetch("data.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((d) => {
      DATA = d;
      renderTabs();
      renderList();

      const hash = decodeURIComponent(location.hash.slice(1));
      if (hash && DATA.problems.some((p) => p.code === hash)) {
        showDetailFor(hash);
        listView.hidden = true;
        detailView.hidden = false;
        // Replace so Back exits to list (no detail entry stacked below)
        history.replaceState({ view: "list" }, "", location.pathname + location.search);
        history.pushState({ view: "detail", code: hash }, "", `#${hash}`);
      } else {
        history.replaceState({ view: "list" }, "", location.pathname + location.search);
      }
    })
    .catch((err) => {
      metaEl.textContent = "데이터 로드 실패: " + err.message;
    });
})();
