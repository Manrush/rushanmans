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

// Мобильное меню
document.addEventListener("DOMContentLoaded", function () {
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
