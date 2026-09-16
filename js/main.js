// Постоянный анонимный ID посетителя (хранится в localStorage браузера).
// Используется, чтобы позже связать событие в рекламных счётчиках
// (например, СберАдс) с конкретной заявкой в таблице.
function getPseudoId() {
  try {
    var key = "rushanmans_uid";
    var id = localStorage.getItem(key);
    if (!id) {
      id = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
      localStorage.setItem(key, id);
    }
    return id;
  } catch (e) {
    return "no-storage";
  }
}

// Аналитика форм: шлёт цель в Метрику и событие в GA4, если счётчики подключены.
// Пока реальных ID нет — просто пишет в консоль, чтобы было видно, что сработало бы.
function trackEvent(name, params) {
  params = params || {};
  var sent = false;

  if (typeof ym === "function" && window.YM_ID) {
    ym(window.YM_ID, "reachGoal", name, params);
    sent = true;
  }
  if (typeof gtag === "function") {
    gtag("event", name, params);
    sent = true;
  }
  if (!sent) {
    console.log("[analytics]", name, params);
  }
}

// Вешает на форму: старт заполнения (первый фокус), касание каждого поля
// (для воронки — видно, на каком поле люди чаще бросают) и отправку.
function trackForm(formEl, formName) {
  if (!formEl) return;

  var started = false;
  var touched = {};

  formEl.addEventListener("focusin", function (e) {
    var field = e.target;
    if (!field.name) return;

    if (!started) {
      started = true;
      trackEvent("form_start", { form_name: formName });
    }
    if (!touched[field.name]) {
      touched[field.name] = true;
      trackEvent("form_field_touch", { form_name: formName, field: field.name });
    }
  });

  formEl.addEventListener("submit", function () {
    trackEvent("form_submit", { form_name: formName });
  });
}

// Поиск + фильтр по тегам на странице блога.
function initBlogFilter() {
  var grid = document.getElementById("articles-grid");
  var tagFilter = document.getElementById("tag-filter");
  var searchInput = document.getElementById("article-search");
  var noResults = document.getElementById("no-results");
  if (!grid || !tagFilter || !searchInput) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll(".card"));
  var activeTag = "";
  var searchDebounce = null;

  // Собираем уникальные теги со всех карточек и рисуем чипы.
  var allTags = [];
  cards.forEach(function (card) {
    (card.dataset.tags || "").split(/\s+/).forEach(function (t) {
      if (t && allTags.indexOf(t) === -1) allTags.push(t);
    });
  });
  allTags.sort();
  allTags.forEach(function (t) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip tag-chip";
    btn.dataset.tag = t;
    btn.textContent = t;
    tagFilter.appendChild(btn);
  });

  function applyFilter() {
    var query = searchInput.value.trim().toLowerCase();
    var visibleCount = 0;

    cards.forEach(function (card) {
      var tags = (card.dataset.tags || "").split(/\s+/);
      var matchesTag = !activeTag || tags.indexOf(activeTag) !== -1;
      var text = (card.textContent || "").toLowerCase();
      var matchesSearch = !query || text.indexOf(query) !== -1;
      var visible = matchesTag && matchesSearch;
      card.hidden = !visible;
      if (visible) visibleCount++;
    });

    if (noResults) noResults.hidden = visibleCount !== 0;
  }

  tagFilter.addEventListener("click", function (e) {
    var btn = e.target.closest(".tag-chip");
    if (!btn) return;

    tagFilter.querySelectorAll(".tag-chip").forEach(function (b) {
      b.classList.remove("active");
    });
    btn.classList.add("active");
    activeTag = btn.dataset.tag || "";

    trackEvent("blog_tag_filter", { tag: activeTag || "all" });
    applyFilter();
  });

  searchInput.addEventListener("input", function () {
    applyFilter();
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(function () {
      if (searchInput.value.trim()) {
        trackEvent("blog_search", { query: searchInput.value.trim() });
      }
    }, 600);
  });
}

// Мобильное меню
document.addEventListener("DOMContentLoaded", function () {
  initBlogFilter();

  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      links.classList.toggle("open");
    });
  }

  // Подсветка активного пункта меню по текущему файлу
  var current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach(function (a) {
    var href = a.getAttribute("href").split("/").pop();
    if (href === current) a.classList.add("active");
  });
});
