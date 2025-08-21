/* ==========================================
   Feedback App — Acme Co.
   - Formulário com validação
   - Lista dinâmica
   - Filtros por nota
   - Dashboard com Chart.js
   - Persistência com localStorage
========================================== */

const STORAGE_KEY = "acme_feedbacks_v1";

const els = {
  form: document.getElementById("feedback-form"),
  name: document.getElementById("name"),
  rating: document.getElementById("rating"),
  comment: document.getElementById("comment"),
  errors: {
    name: document.querySelector('[data-error-for="name"]'),
    rating: document.querySelector('[data-error-for="rating"]'),
  },
  list: document.getElementById("feedback-list"),
  empty: document.getElementById("empty-state"),
  search: document.getElementById("search"),
  clearStorage: document.getElementById("clear-storage"),
  clearFilters: document.getElementById("clear-filters"),
  filterRatings: Array.from(document.querySelectorAll(".filter-rating")),
  metrics: {
    count: document.getElementById("m-count"),
    avg: document.getElementById("m-avg"),
    pos: document.getElementById("m-pos"),
  },
  resetFormBtn: document.getElementById("reset-form"),
};

let feedbacks = loadFromStorage();
let chartInstance = null;

// ========= Utilidades =========
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(feedbacks));
}
function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

// ========= Regras de filtro e busca =========
function getActiveRatings() {
  const active = els.filterRatings
    .filter(cb => cb.checked)
    .map(cb => Number(cb.value));
  return active.length ? active : [1,2,3,4,5];
}

function applyFilters(data) {
  const ratings = getActiveRatings();
  const term = els.search.value.trim().toLowerCase();
  return data.filter(item => {
    const byRating = ratings.includes(item.rating);
    const byTerm =
      !term ||
      item.name.toLowerCase().includes(term) ||
      (item.comment && item.comment.toLowerCase().includes(term));
    return byRating && byTerm;
  });
}

// ========= Renderização da lista =========
function renderList() {
  const filtered = applyFilters(feedbacks);
  els.list.innerHTML = "";

  if (filtered.length === 0) {
    els.empty.style.display = "block";
  } else {
    els.empty.style.display = "none";
    const tpl = document.getElementById("feedback-item-template");

    filtered
      .sort((a, b) => new Date(b.date) - new Date(a.date)) // mais recentes primeiro
      .forEach(item => {
        const node = tpl.content.cloneNode(true);
        node.querySelector(".rating-badge").textContent = `★ ${item.rating}`;
        node.querySelector(".name").textContent = item.name;
        node.querySelector(".date").textContent = fmtDate(item.date);
        node.querySelector(".comment").textContent = item.comment || "—";
        els.list.appendChild(node);
      });
  }
}

// ========= Dashboard (Chart + métricas) =========
function computeMetrics(data) {
  const count = data.length;
  if (!count) return { count: 0, avg: null, posPct: null };

  const avg = data.reduce((sum, f) => sum + f.rating, 0) / count;
  const positives = data.filter(f => f.rating >= 4).length;
  const posPct = (positives / count) * 100;
  return { count, avg, posPct };
}

function renderMetrics() {
  const filtered = applyFilters(feedbacks);
  const { count, avg, posPct } = computeMetrics(filtered);

  els.metrics.count.textContent = count;
  els.metrics.avg.textContent = count ? avg.toFixed(2) : "—";
  els.metrics.pos.textContent = count ? `${posPct.toFixed(0)}%` : "—";
}

function renderChart() {
  const filtered = applyFilters(feedbacks);
  const buckets = [1,2,3,4,5].map(n => filtered.filter(f => f.rating === n).length);

  const ctx = document.getElementById("ratingsChart").getContext("2d");

  if (chartInstance) {
    chartInstance.data.datasets[0].data = buckets;
    chartInstance.update();
    return;
  }

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["1", "2", "3", "4", "5"],
      datasets: [{
        label: "Quantidade por nota",
        data: buckets,
        borderWidth: 1,
        backgroundColor: ["#ff6b6b","#ffa94d","#ffd43b","#69db7c","#6c8cff"],
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { precision:0 } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { mode: "index", intersect: false }
      }
    }
  });
}

// ========= Submissão do formulário =========
function validateForm() {
  let ok = true;
  // nome
  if (!els.name.value.trim()) {
    els.errors.name.textContent = "Informe seu nome.";
    ok = false;
  } else {
    els.errors.name.textContent = "";
  }
  // nota
  if (!els.rating.value) {
    els.errors.rating.textContent = "Selecione uma nota.";
    ok = false;
  } else {
    els.errors.rating.textContent = "";
  }
  return ok;
}

function clearForm() {
  els.form.reset();
  els.errors.name.textContent = "";
  els.errors.rating.textContent = "";
  els.name.focus();
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const entry = {
    id: uid(),
    name: els.name.value.trim(),
    rating: Number(els.rating.value),
    comment: els.comment.value.trim(),
    date: new Date().toISOString(),
  };
  feedbacks.push(entry);
  saveToStorage();

  clearForm();
  rerenderAll();
});

els.resetFormBtn.addEventListener("click", () => {
  els.errors.name.textContent = "";
  els.errors.rating.textContent = "";
});

// ========= Filtros, busca e limpeza =========
els.filterRatings.forEach(cb => cb.addEventListener("change", () => {
  rerenderAll();
}));

els.search.addEventListener("input", () => {
  rerenderAll();
});

els.clearFilters.addEventListener("click", (e) => {
  e.preventDefault();
  els.filterRatings.forEach(cb => cb.checked = false);
  rerenderAll();
});

els.clearStorage.addEventListener("click", () => {
  if (confirm("Apagar todos os feedbacks salvos? Esta ação não pode ser desfeita.")) {
    feedbacks = [];
    saveToStorage();
    rerenderAll();
  }
});

// ========= Renderização inicial =========
function rerenderAll() {
  renderMetrics();
  renderList();
  renderChart();
}

document.addEventListener("DOMContentLoaded", () => {
  rerenderAll();
});
