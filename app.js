// ═══════════════════════════════════════════════════════
// APP.JS · Estrategias de IA 2026
// ═══════════════════════════════════════════════════════

// ── Estado global ──────────────────────────────────────
let STATE = JSON.parse(JSON.stringify(ESTADO_INICIAL));
let IS_EDITOR = false;
let DETAIL_TASK_ID = null;

// ── Init ───────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadState();
  initNav();
  renderDashboard();
  renderGantt();
  renderFase1();
  renderHitos();
  initConfig();
  initDetailPanel();
  initEditorToggle();
});

// ════════════════════════════════════════════════════════
// PERSISTENCIA
// ════════════════════════════════════════════════════════
function loadState() {
  try {
    const cfg = JSON.parse(localStorage.getItem("ia_config") || "{}");
    if (cfg.gistId) STATE.config.gistId = cfg.gistId;
    if (cfg.gistToken) STATE.config.gistToken = cfg.gistToken;
    if (cfg.editorPassword) STATE.config.editorPassword = cfg.editorPassword;
  } catch(e) {}

  if (STATE.config.gistId) {
    loadFromGist();
  } else {
    try {
      const saved = JSON.parse(localStorage.getItem("ia_state") || "null");
      if (saved && saved.version) mergeState(saved);
    } catch(e) {}
  }
}

function mergeState(saved) {
  if (saved.tareas) STATE.tareas = { ...STATE.tareas, ...saved.tareas };
  if (saved.actividad) STATE.actividad = saved.actividad;
}

function saveStateLocal() {
  localStorage.setItem("ia_state", JSON.stringify({
    version: STATE.version,
    tareas: STATE.tareas,
    actividad: STATE.actividad
  }));
}

function saveConfigLocal() {
  localStorage.setItem("ia_config", JSON.stringify(STATE.config));
}

async function loadFromGist() {
  setSyncStatus("syncing", "Sincronizando…");
  try {
    const res = await fetch(`https://api.github.com/gists/${STATE.config.gistId}`, {
      headers: STATE.config.gistToken
        ? { Authorization: `token ${STATE.config.gistToken}` }
        : {}
    });
    if (!res.ok) throw new Error("Gist no encontrado");
    const data = await res.json();
    const filename = Object.keys(data.files)[0];
    const content = JSON.parse(data.files[filename].content);
    mergeState(content);
    setSyncStatus("synced", "Sincronizado ✓");
    refreshAll();
  } catch(e) {
    setSyncStatus("error", "Error de sincronización");
    try {
      const saved = JSON.parse(localStorage.getItem("ia_state") || "null");
      if (saved) mergeState(saved);
    } catch(e2) {}
  }
}

async function saveToGist(showToast = true) {
  if (!STATE.config.gistId || !STATE.config.gistToken) {
    saveStateLocal();
    if (showToast) toast("Guardado localmente (sin Gist configurado)");
    return;
  }
  setSyncStatus("syncing", "Guardando…");
  try {
    const body = JSON.stringify({
      files: {
        "ia-estado-2026.json": {
          content: JSON.stringify({
            version: STATE.version,
            tareas: STATE.tareas,
            actividad: STATE.actividad.slice(0,50)
          }, null, 2)
        }
      }
    });
    const res = await fetch(`https://api.github.com/gists/${STATE.config.gistId}`, {
      method: "PATCH",
      headers: {
        Authorization: `token ${STATE.config.gistToken}`,
        "Content-Type": "application/json"
      },
      body
    });
    if (!res.ok) throw new Error("Error al guardar");
    saveStateLocal();
    setSyncStatus("synced", "Guardado en Gist ✓");
    if (showToast) toast("✓ Cambios guardados y sincronizados");
  } catch(e) {
    saveStateLocal();
    setSyncStatus("error", "Error al sincronizar");
    if (showToast) toast("Guardado localmente (error de red)");
  }
}

function setSyncStatus(type, text) {
  const el = document.getElementById("syncStatus");
  el.className = "sync-status " + type;
  el.innerHTML = "●&nbsp;" + text;
}

// ════════════════════════════════════════════════════════
// NAVEGACIÓN
// ════════════════════════════════════════════════════════
function initNav() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + tab).classList.add("active");
    });
  });
}

// ════════════════════════════════════════════════════════
// HELPERS DE ESTADO
// ════════════════════════════════════════════════════════
function getTaskState(id) {
  return STATE.tareas[id] || { status: "pendiente", notas: "" };
}

function setTaskState(id, status, notas) {
  const prev = getTaskState(id);
  STATE.tareas[id] = { status, notas, updatedAt: new Date().toISOString() };
  if (prev.status !== status) {
    const task = TODAS_LAS_TASKS.find(t => t.id === id);
    const nombre = task ? task.nombre : id;
    addActividad(`"${nombre.slice(0,50)}" → ${statusLabel(status)}`);
  }
}

function addActividad(texto) {
  STATE.actividad.unshift({ texto, ts: new Date().toISOString() });
  if (STATE.actividad.length > 50) STATE.actividad = STATE.actividad.slice(0,50);
}

function statusLabel(s) {
  return { pendiente:"Pendiente", "en-curso":"En curso", completado:"Completado" }[s] || s;
}

function phasePct(faseId) {
  const tasks = TODAS_LAS_TASKS.filter(t => t.faseId === faseId);
  if (!tasks.length) return 0;
  const done = tasks.filter(t => getTaskState(t.id).status === "completado").length;
  return Math.round((done / tasks.length) * 100);
}

function globalPct() {
  const total = TODAS_LAS_TASKS.length;
  if (!total) return 0;
  const done = TODAS_LAS_TASKS.filter(t => getTaskState(t.id).status === "completado").length;
  return Math.round((done / total) * 100);
}

// ════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════
function renderDashboard() {
  const gp = globalPct();
  document.getElementById("globalPct").textContent = gp + "%";
  document.getElementById("globalBar").style.width = gp + "%";
  document.getElementById("ringPct").textContent = gp + "%";
  const circ = 314;
  document.getElementById("globalRing").style.strokeDashoffset = circ - (circ * gp / 100);

  ["f1","f2","f3","f4"].forEach((fid, i) => {
    const pct = phasePct(fid);
    const tasks = TODAS_LAS_TASKS.filter(t => t.faseId === fid);
    const done = tasks.filter(t => getTaskState(t.id).status === "completado").length;
    document.getElementById(`phase-bar-${i}`).style.width = pct + "%";
    document.getElementById(`phase-pct-${i}`).textContent = pct + "%";
    document.getElementById(`phase-tasks-${i}`).textContent = `${done} / ${tasks.length} tareas`;
  });

  // Próximos hitos
  const container = document.getElementById("upcomingHitos");
  const upcoming = TODOS_LOS_HITOS.filter(h => {
    const s = getTaskState(h.taskId).status;
    return s !== "completado";
  }).slice(0, 5);
  container.innerHTML = upcoming.length ? upcoming.map(h => `
    <div class="hito-item" onclick="openDetail('${h.taskId}')">
      <div class="hito-diamond ${getTaskState(h.taskId).status === 'completado' ? 'done' : ''}"></div>
      <div class="hito-info">
        <div class="hito-item-name">${h.nombre}</div>
        <div class="hito-item-date">${h.fecha}</div>
      </div>
      <span class="hito-item-phase">${h.fase}</span>
    </div>`).join("") : `<p class="empty-state">Todos los hitos completados 🎉</p>`;

  // Actividad reciente
  const actEl = document.getElementById("recentActivity");
  actEl.innerHTML = STATE.actividad.length
    ? STATE.actividad.slice(0,8).map(a => `
      <div class="activity-item">
        <div class="activity-dot"></div>
        <div>
          <div>${a.texto}</div>
          <div class="activity-time">${fmtDate(a.ts)}</div>
        </div>
      </div>`).join("")
    : `<p class="empty-state">Sin actividad registrada aún.</p>`;
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-AR", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });
  } catch(e) { return ""; }
}

// ════════════════════════════════════════════════════════
// GANTT ANUAL
// ════════════════════════════════════════════════════════
function renderGantt() {
  const container = document.getElementById("ganttContainer");
  const LABEL_W = 300;
  const WEEK_W = 38;
  const MONTH_W = 64;
  const ROW_H = 36;
  const N_WEEKS = 12;
  const N_MONTHS = 7;
  const TOTAL_W = LABEL_W + N_WEEKS * WEEK_W + N_MONTHS * MONTH_W;
  const gridCols = `${LABEL_W}px repeat(${N_WEEKS}, ${WEEK_W}px) repeat(${N_MONTHS}, ${MONTH_W}px)`;

  // Month groups for header
  const monthGroups = [
    { label:"MARZO", start:0, span:3 },
    { label:"ABRIL", start:3, span:4 },
    { label:"MAYO",  start:7, span:4 },
    { label:"JUN",   start:11, span:1 },
  ];

  let html = `<div style="min-width:${TOTAL_W}px;">`;

  // Header: month bands
  html += `<div style="display:flex; background:#1A2E1A; border-bottom:2px solid #C5E830; position:sticky;top:56px;z-index:9;">
    <div style="width:${LABEL_W}px;flex-shrink:0;padding:8px 14px;font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:.1em;text-transform:uppercase;border-right:1px solid rgba(255,255,255,0.08);">PRODUCTO / FASE</div>`;
  monthGroups.forEach(mg => {
    html += `<div style="width:${mg.span*WEEK_W}px;flex-shrink:0;padding:8px 0;font-size:10px;font-weight:700;color:#C5E830;letter-spacing:.1em;text-transform:uppercase;text-align:center;border-right:1px solid rgba(255,255,255,0.1);">${mg.label}</div>`;
  });
  MESES_POSTERIORES.forEach(m => {
    html += `<div style="width:${MONTH_W}px;flex-shrink:0;padding:8px 0;font-size:10px;font-weight:700;color:rgba(255,255,255,0.65);letter-spacing:.1em;text-transform:uppercase;text-align:center;border-right:1px solid rgba(255,255,255,0.08);">${m.label}</div>`;
  });
  html += `</div>`;

  // Week labels
  html += `<div style="display:flex;background:#3D6B20;position:sticky;top:${56+37}px;z-index:8;">
    <div style="width:${LABEL_W}px;flex-shrink:0;border-right:1px solid rgba(255,255,255,0.1);"></div>`;
  SEMANAS_F1.forEach(w => {
    html += `<div style="width:${WEEK_W}px;flex-shrink:0;font-size:9px;color:rgba(255,255,255,0.55);padding:5px 0;text-align:center;border-right:1px solid rgba(255,255,255,0.06);">${w}</div>`;
  });
  MESES_POSTERIORES.forEach(() => {
    html += `<div style="width:${MONTH_W}px;flex-shrink:0;border-right:1px solid rgba(255,255,255,0.06);"></div>`;
  });
  html += `</div>`;

  // Build rows
  const allFaseProds = [
    { fase: FASES[0], prods: PRODUCTOS_F1, tipo:"semanas" },
    { fase: FASES[1], prods: PRODUCTOS_F2, tipo:"meses" },
    { fase: FASES[2], prods: PRODUCTOS_F3, tipo:"meses" },
    { fase: FASES[3], prods: PRODUCTOS_F4, tipo:"meses" },
  ];

  allFaseProds.forEach(({ fase, prods, tipo }) => {
    // Fase separator row
    html += ganttRow({
      label: `${fase.num} · ${fase.nombre} · ${fase.periodo}`,
      labelClass: "fase-label",
      rowClass: "row-fase",
      cells: buildFaseCells(fase, WEEK_W, MONTH_W, N_WEEKS, N_MONTHS),
      onclick: null,
      LABEL_W
    });

    // Phase objective row
    html += `<div style="display:flex;background:#1A2E1A;border-bottom:1px solid rgba(255,255,255,0.04);">
      <div style="width:${LABEL_W}px;flex-shrink:0;padding:6px 16px 6px 22px;font-size:10px;color:rgba(255,255,255,0.4);font-style:italic;line-height:1.4;border-right:1px solid rgba(255,255,255,0.06);">${fase.objetivo}</div>
      ${Array(N_WEEKS+N_MONTHS).fill(`<div style="flex-shrink:0;border-right:1px solid rgba(255,255,255,0.04);"></div>`).join("")}
    </div>`;

    prods.forEach(prod => {
      const st = getTaskState(prod.id).status;
      const isF1 = tipo === "semanas";
      const cells = isF1
        ? buildF1ProdCells(prod, WEEK_W, MONTH_W, N_WEEKS, N_MONTHS)
        : buildLaterProdCells(prod, WEEK_W, MONTH_W, N_WEEKS, N_MONTHS);

      html += ganttRow({
        label: `<span class="status-dot ${st}"></span>${prod.nombre}`,
        labelClass: "prod-label",
        rowClass: "row-prod",
        cells,
        onclick: `openDetail('${prod.id}')`,
        LABEL_W
      });

      // Subproductos (solo F1)
      if (isF1 && prod.subproductos) {
        prod.subproductos.forEach(sub => {
          const ss = getTaskState(sub.id).status;
          const subCells = buildSubCells(sub, WEEK_W, MONTH_W, N_WEEKS, N_MONTHS);
          html += ganttRow({
            label: `<span class="status-dot ${ss}"></span>${sub.nombre}`,
            labelClass: sub.es_hito ? "hito-label" : "sub-label",
            rowClass: sub.es_hito ? "row-hito" : "row-sub",
            cells: subCells,
            onclick: `openDetail('${sub.id}')`,
            LABEL_W
          });
        });
      }
    });

    // Sep row
    html += `<div style="height:6px;background:#1A2E1A;"></div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function ganttRow({ label, labelClass, rowClass, cells, onclick, LABEL_W }) {
  const clickAttr = onclick ? `onclick="${onclick}" style="cursor:pointer"` : "";
  return `<div class="gantt-row ${rowClass}" ${clickAttr}>
    <div class="gantt-label ${labelClass}" style="width:${LABEL_W}px;flex-shrink:0;">${label}</div>
    ${cells}
  </div>`;
}

function buildFaseCells(fase, WW, MW, NW, NM) {
  let out = "";
  for (let i = 0; i < NW; i++) {
    const inRange = (i >= fase.t_start && i <= fase.t_end);
    out += `<div style="width:${WW}px;flex-shrink:0;height:30px;${inRange?`background:#3D6B20;`:""}border-right:1px solid rgba(255,255,255,0.05);"></div>`;
  }
  for (let i = 0; i < NM; i++) {
    const faseIdx = MESES_POSTERIORES[i].fase - 1;
    const inFase = (faseIdx === parseInt(fase.num) - 1);
    out += `<div style="width:${MW}px;flex-shrink:0;height:30px;${inFase?`background:#3D6B20;`:""}border-right:1px solid rgba(255,255,255,0.05);"></div>`;
  }
  return out;
}

function buildF1ProdCells(prod, WW, MW, NW, NM) {
  let out = "";
  for (let i = 0; i < NW; i++) {
    const inRange = (i >= prod.t_start && i <= prod.t_end);
    const bg = inRange ? "background:#2D5016;" : "";
    out += `<div style="width:${WW}px;flex-shrink:0;height:40px;${bg}border-right:1px solid #E0E0E040;"></div>`;
  }
  for (let i = 0; i < NM; i++) {
    out += `<div style="width:${MW}px;flex-shrink:0;height:40px;border-right:1px solid #E0E0E040;"></div>`;
  }
  return out;
}

function buildLaterProdCells(prod, WW, MW, NW, NM) {
  let out = "";
  for (let i = 0; i < NW; i++) {
    out += `<div style="width:${WW}px;flex-shrink:0;height:40px;border-right:1px solid #E0E0E040;"></div>`;
  }
  for (let i = 0; i < NM; i++) {
    const inRange = (i >= prod.t_start && i <= prod.t_end);
    const isHito = prod.t_hito === i;
    let bg = "";
    let inner = "";
    if (isHito) { bg = "background:#C5E830;"; inner = `<div style="display:flex;align-items:center;justify-content:center;height:100%;"><div style="width:12px;height:12px;background:#2D5016;transform:rotate(45deg);"></div></div>`; }
    else if (inRange) { bg = "background:#2D5016;"; }
    out += `<div style="width:${MW}px;flex-shrink:0;height:40px;${bg}border-right:1px solid #E0E0E040;">${inner}</div>`;
  }
  return out;
}

function buildSubCells(sub, WW, MW, NW, NM) {
  let out = "";
  for (let i = 0; i < NW; i++) {
    const inRange = (i >= sub.t_start && i <= sub.t_end);
    let bg = "", inner = "";
    if (sub.es_hito && inRange) {
      bg = "background:#C5E830;";
      inner = `<div style="display:flex;align-items:center;justify-content:center;height:100%;"><div style="width:11px;height:11px;background:#2D5016;transform:rotate(45deg);border:1.5px solid #1A2E1A;"></div></div>`;
    } else if (!sub.es_hito && inRange) {
      bg = "background:#E8ECF2;";
    }
    out += `<div style="width:${WW}px;flex-shrink:0;height:32px;${bg}border-right:1px solid #E0E0E040;">${inner}</div>`;
  }
  for (let i = 0; i < NM; i++) {
    out += `<div style="width:${MW}px;flex-shrink:0;height:32px;border-right:1px solid #E0E0E040;"></div>`;
  }
  return out;
}

// ════════════════════════════════════════════════════════
// FASE 1 DETAIL
// ════════════════════════════════════════════════════════
function renderFase1() {
  const container = document.getElementById("fase1Products");
  container.innerHTML = PRODUCTOS_F1.map((prod, pi) => {
    const st = getTaskState(prod.id).status;
    const completedSubs = prod.subproductos.filter(s => getTaskState(s.id).status === "completado").length;
    const totalSubs = prod.subproductos.length;
    const pct = Math.round(completedSubs / totalSubs * 100);

    return `
    <div class="f1-product" id="f1prod-${prod.id}">
      <div class="f1-product-header" onclick="toggleF1Product('${prod.id}')">
        <div class="f1-product-num">${prod.num}</div>
        <div class="f1-product-info">
          <div class="f1-product-name">${prod.nombre}</div>
          <div class="f1-product-desc">${prod.periodo || prod.hito.fecha}</div>
        </div>
        <div style="display:flex;align-items:center;gap:16px;">
          <div style="text-align:right;">
            <div style="font-size:10px;font-weight:700;letter-spacing:.08em;color:#C5E830;text-transform:uppercase;margin-bottom:2px;">Avance</div>
            <div style="font-size:18px;font-weight:700;color:#C5E830;">${pct}%</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.4);">${completedSubs}/${totalSubs} tareas</div>
          </div>
          <div class="f1-product-hito">
            <div class="f1-hito-label">Hito</div>
            <div class="f1-hito-name">${prod.hito.nombre}</div>
            <div class="f1-hito-date">${prod.hito.fecha}</div>
          </div>
        </div>
        <div class="f1-product-toggle" id="f1toggle-${prod.id}">▾</div>
      </div>

      <div class="f1-product-body" id="f1body-${prod.id}">
        <!-- Descripción -->
        <div style="padding:20px 22px 12px;border-bottom:1px solid #E0E0E0;background:#FAFAFA;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#4A5568;margin-bottom:8px;">Descripción</div>
          <p style="font-size:13px;color:#444;line-height:1.7;font-weight:300;">${prod.desc}</p>
        </div>

        <!-- Mini Gantt semanal -->
        <div class="f1-gantt" style="padding:16px 22px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#4A5568;margin-bottom:12px;">Cronograma semanal</div>
          ${renderF1MiniGantt(prod)}
        </div>
      </div>
    </div>`;
  }).join("");
}

function renderF1MiniGantt(prod) {
  const LABEL_W = 240;
  const CELL_W = 44;
  const N = 12;

  let html = `<div style="overflow-x:auto;"><div style="min-width:${LABEL_W + N*CELL_W}px;">`;

  // Header weeks
  html += `<div style="display:flex;margin-bottom:4px;">
    <div style="width:${LABEL_W}px;flex-shrink:0;"></div>`;
  SEMANAS_F1.forEach(w => {
    html += `<div style="width:${CELL_W}px;flex-shrink:0;font-size:9px;font-weight:600;color:#4A5568;text-align:center;padding:3px 0;">${w}</div>`;
  });
  html += `</div>`;

  // Month bands
  const bands = [
    { label:"MAR", start:0, span:3 },
    { label:"ABR", start:3, span:4 },
    { label:"MAY", start:7, span:4 },
    { label:"JUN", start:11, span:1 },
  ];
  html += `<div style="display:flex;margin-bottom:8px;">
    <div style="width:${LABEL_W}px;flex-shrink:0;"></div>`;
  bands.forEach(b => {
    html += `<div style="width:${b.span*CELL_W}px;flex-shrink:0;font-size:9px;font-weight:700;letter-spacing:.08em;color:#fff;background:#1A2E1A;text-align:center;padding:3px 0;border-right:1px solid #2D5016;">${b.label}</div>`;
  });
  html += `</div>`;

  // Task rows
  prod.subproductos.forEach(sub => {
    const st = getTaskState(sub.id).status;
    const rowBg = sub.es_hito ? "#EAF0E3" : (st === "completado" ? "#F0F8E8" : "#fff");
    const labelColor = sub.es_hito ? "#2D5016" : "#444";
    const prefix = sub.es_hito ? "✓ " : "";

    html += `<div style="display:flex;border-bottom:1px solid #E0E0E0;min-height:34px;cursor:pointer;transition:background .12s;"
      onmouseover="this.style.background='#EAF0E3'" onmouseout="this.style.background='${rowBg}'"
      onclick="openDetail('${sub.id}')" style="background:${rowBg};">
      <div style="width:${LABEL_W}px;flex-shrink:0;padding:6px 12px;font-size:11px;color:${labelColor};font-weight:${sub.es_hito?'600':'300'};display:flex;align-items:center;gap:6px;border-right:1px solid #E0E0E0;">
        <span style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:${st==='completado'?'#2D5016':st==='en-curso'?'#FFC107':'#AAAAAA'};"></span>
        ${prefix}${sub.nombre}
      </div>`;

    for (let i = 0; i < N; i++) {
      const inRange = (i >= sub.t_start && i <= sub.t_end);
      let cellBg = "transparent";
      let inner = "";
      if (sub.es_hito && inRange) {
        cellBg = "#C5E830";
        inner = `<div style="display:flex;align-items:center;justify-content:center;height:100%;"><div style="width:10px;height:10px;background:#2D5016;transform:rotate(45deg);"></div></div>`;
      } else if (!sub.es_hito && inRange) {
        cellBg = st === "completado" ? "#2D5016" : st === "en-curso" ? "#3D6B20" : "#E8ECF2";
      }
      html += `<div style="width:${CELL_W}px;flex-shrink:0;height:34px;background:${cellBg};border-right:1px solid #E0E0E040;">${inner}</div>`;
    }
    html += `</div>`;
  });

  html += `</div></div>`;
  return html;
}

function toggleF1Product(prodId) {
  const body = document.getElementById(`f1body-${prodId}`);
  const toggle = document.getElementById(`f1toggle-${prodId}`);
  const isOpen = body.classList.contains("open");
  body.classList.toggle("open");
  toggle.classList.toggle("open");
}

// ════════════════════════════════════════════════════════
// HITOS CALENDAR
// ════════════════════════════════════════════════════════
function renderHitos() {
  const container = document.getElementById("hitoCalendar");
  const MESES_CON_HITOS = ["Abril","Mayo","Agosto","Noviembre","Diciembre"];

  container.innerHTML = MESES_CON_HITOS.map(mes => {
    const hitosDelMes = TODOS_LOS_HITOS.filter(h => h.mes === mes);
    return `
    <div class="hito-month-block">
      <div class="hito-month-name">${mes.toUpperCase()} 2026</div>
      ${hitosDelMes.length ? `<div class="hito-month-items">
        ${hitosDelMes.map(h => {
          const st = getTaskState(h.taskId).status;
          return `
          <div class="hito-cal-item" onclick="openDetail('${h.taskId}')">
            <div class="hito-cal-date">
              <div class="hito-cal-date-week">${h.dia ? "SEM." : "MES"}</div>
              <div class="hito-cal-date-day">${h.dia || "—"}</div>
            </div>
            <div class="hito-cal-divider"></div>
            <div class="hito-cal-info">
              <div class="hito-cal-name">${h.nombre}</div>
              <div class="hito-cal-product">${h.fase} · ${h.producto}</div>
            </div>
            <div class="hito-cal-status">
              <span class="status-pill ${st}">${statusLabel(st)}</span>
              <span style="font-size:10px;color:#AAAAAA;">${h.fecha}</span>
            </div>
          </div>`;
        }).join("")}
      </div>` : `<div class="hito-month-empty">Sin hitos registrados</div>`}
    </div>`;
  }).join("");
}

// ════════════════════════════════════════════════════════
// DETAIL PANEL
// ════════════════════════════════════════════════════════
function initDetailPanel() {
  document.getElementById("detailClose").addEventListener("click", closeDetail);
  document.getElementById("detailOverlay").addEventListener("click", closeDetail);

  document.querySelectorAll(".status-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!IS_EDITOR) return;
      document.querySelectorAll(".status-btn").forEach(b => b.classList.remove("active", b.dataset.status));
      btn.classList.add("active", btn.dataset.status);
    });
  });

  document.getElementById("detailSave").addEventListener("click", saveDetail);
}

function openDetail(taskId) {
  DETAIL_TASK_ID = taskId;

  // Find task info
  let taskInfo = TODAS_LAS_TASKS.find(t => t.id === taskId);
  let nombre = taskInfo ? taskInfo.nombre : taskId;
  let fase = "";
  let meta = "";

  // Look in F1 products and subproductos
  PRODUCTOS_F1.forEach(p => {
    if (p.id === taskId) { nombre = p.nombre; fase = "Fase 1 · " + p.num; meta = p.hito.fecha; }
    p.subproductos.forEach(s => {
      if (s.id === taskId) { nombre = s.nombre; fase = "Fase 1 · Producto " + p.num; meta = s.fecha || ""; }
    });
  });

  const st = getTaskState(taskId);

  document.getElementById("detailPhaseTag").textContent = fase || "Proyecto 2026";
  document.getElementById("detailTitle").textContent = nombre;
  document.getElementById("detailMeta").textContent = meta;
  document.getElementById("detailNotes").value = st.notas || "";
  document.getElementById("detailNotes").disabled = !IS_EDITOR;
  document.getElementById("detailSave").disabled = !IS_EDITOR;

  document.querySelectorAll(".status-btn").forEach(btn => {
    btn.classList.remove("active","pendiente","en-curso","completado");
    btn.disabled = !IS_EDITOR;
    if (btn.dataset.status === st.status) btn.classList.add("active", st.status);
  });

  document.getElementById("detailPanel").classList.add("open");
  document.getElementById("detailOverlay").classList.add("open");
}

function closeDetail() {
  document.getElementById("detailPanel").classList.remove("open");
  document.getElementById("detailOverlay").classList.remove("open");
  DETAIL_TASK_ID = null;
}

function saveDetail() {
  if (!DETAIL_TASK_ID || !IS_EDITOR) return;
  const activeBtn = document.querySelector(".status-btn.active");
  const status = activeBtn ? activeBtn.dataset.status : "pendiente";
  const notas = document.getElementById("detailNotes").value;
  setTaskState(DETAIL_TASK_ID, status, notas);
  saveToGist();
  closeDetail();
  refreshAll();
  toast("✓ Estado actualizado");
}

// ════════════════════════════════════════════════════════
// EDITOR MODE
// ════════════════════════════════════════════════════════
function initEditorToggle() {
  document.getElementById("editorToggle").addEventListener("click", () => {
    if (IS_EDITOR) {
      IS_EDITOR = false;
      document.getElementById("editorToggle").textContent = "Modo lectura";
      document.getElementById("editorToggle").classList.remove("active");
      toast("Modo lectura activado");
    } else {
      const pwd = prompt("Contraseña de editor:");
      if (pwd === STATE.config.editorPassword) {
        IS_EDITOR = true;
        document.getElementById("editorToggle").textContent = "● Editor";
        document.getElementById("editorToggle").classList.add("active");
        toast("✓ Modo editor activado");
      } else if (pwd !== null) {
        toast("Contraseña incorrecta");
      }
    }
  });
}

// ════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════
function initConfig() {
  document.getElementById("gistId").value = STATE.config.gistId || "";
  document.getElementById("gistToken").value = STATE.config.gistToken || "";

  document.getElementById("saveGistConfig").addEventListener("click", () => {
    STATE.config.gistId = document.getElementById("gistId").value.trim();
    STATE.config.gistToken = document.getElementById("gistToken").value.trim();
    saveConfigLocal();
    setStatus("gistStatus", "ok", "✓ Configuración guardada");
    toast("✓ Configuración guardada");
  });

  document.getElementById("testGist").addEventListener("click", async () => {
    const id = document.getElementById("gistId").value.trim();
    const token = document.getElementById("gistToken").value.trim();
    if (!id) { setStatus("gistStatus","err","Ingresá el ID del Gist"); return; }
    setStatus("gistStatus","", "Probando conexión…");
    try {
      const res = await fetch(`https://api.github.com/gists/${id}`, {
        headers: token ? { Authorization: `token ${token}` } : {}
      });
      if (res.ok) setStatus("gistStatus","ok","✓ Conexión exitosa");
      else setStatus("gistStatus","err","Error: Gist no encontrado o token inválido");
    } catch(e) {
      setStatus("gistStatus","err","Error de red");
    }
  });

  document.getElementById("unlockBtn").addEventListener("click", () => {
    const pwd = document.getElementById("editorPassword").value;
    if (pwd === STATE.config.editorPassword) {
      IS_EDITOR = true;
      document.getElementById("editorToggle").textContent = "● Editor";
      document.getElementById("editorToggle").classList.add("active");
      setStatus("editorStatus","ok","✓ Modo editor activado");
      toast("✓ Modo editor activado");
    } else {
      setStatus("editorStatus","err","Contraseña incorrecta");
    }
  });

  document.getElementById("exportBtn").addEventListener("click", () => {
    const data = JSON.stringify({ version:STATE.version, tareas:STATE.tareas, actividad:STATE.actividad }, null, 2);
    const blob = new Blob([data], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ia-estado-2026.json"; a.click();
    URL.revokeObjectURL(url);
    toast("✓ Estado exportado");
  });

  document.getElementById("importFile").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        mergeState(data);
        saveStateLocal();
        refreshAll();
        toast("✓ Estado importado correctamente");
        setStatus("gistStatus","ok","Estado importado desde archivo");
      } catch(err) {
        toast("Error: archivo JSON inválido");
      }
    };
    reader.readAsText(file);
  });
}

function setStatus(id, cls, msg) {
  const el = document.getElementById(id);
  el.className = "config-status " + cls;
  el.textContent = msg;
}

// ════════════════════════════════════════════════════════
// REFRESH
// ════════════════════════════════════════════════════════
function refreshAll() {
  renderDashboard();
  renderGantt();
  renderFase1();
  renderHitos();
}

// ════════════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════════════
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}
