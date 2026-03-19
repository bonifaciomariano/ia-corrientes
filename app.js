// ═══════════════════════════════════════════════════════
// APP.JS · Estrategias de IA 2026
// ═══════════════════════════════════════════════════════

let STATE = JSON.parse(JSON.stringify(ESTADO_INICIAL));
let IS_EDITOR = false;
let DETAIL_TASK_ID = null;
let DASHBOARD_FASE_FILTER = null; // null = global

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
  if (saved.descripciones) STATE.descripciones = { ...saved.descripciones };
}

function saveStateLocal() {
  localStorage.setItem("ia_state", JSON.stringify({
    version: STATE.version,
    tareas: STATE.tareas,
    actividad: STATE.actividad,
    descripciones: STATE.descripciones || {}
  }));
}

function saveConfigLocal() {
  localStorage.setItem("ia_config", JSON.stringify(STATE.config));
}

async function loadFromGist() {
  setSyncStatus("syncing", "Sincronizando…");
  try {
    const res = await fetch(`https://api.github.com/gists/${STATE.config.gistId}`, {
      headers: STATE.config.gistToken ? { Authorization: `token ${STATE.config.gistToken}` } : {}
    });
    if (!res.ok) throw new Error("Gist error");
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
            actividad: STATE.actividad.slice(0,50),
            descripciones: STATE.descripciones || {}
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
    if (!res.ok) throw new Error("Save error");
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

function getDesc(id, fallback) {
  return (STATE.descripciones && STATE.descripciones[id]) || fallback;
}

function setTaskState(id, status, notas, desc) {
  const prev = getTaskState(id);
  STATE.tareas[id] = { status, notas, updatedAt: new Date().toISOString() };
  if (desc !== undefined) {
    if (!STATE.descripciones) STATE.descripciones = {};
    STATE.descripciones[id] = desc;
  }
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
  const faseIds = ["f1","f2","f3","f4"];
  const faseNombres = ["Gobernanza y Diagnóstico","Estrategia y Marco Normativo","Desarrollo de Pilotos","Evaluación y Cierre"];
  const fasePeriodos = ["Mar – Jun 2026","Jun – Ago 2026","Sep – Nov 2026","Dic 2026"];

  // Determine what to show: global or filtered phase
  const isFiltered = DASHBOARD_FASE_FILTER !== null;
  const activeFaseId = isFiltered ? faseIds[DASHBOARD_FASE_FILTER] : null;
  const pct = isFiltered ? phasePct(activeFaseId) : globalPct();
  const heroLabel = isFiltered ? `FASE ${DASHBOARD_FASE_FILTER+1} · ${faseNombres[DASHBOARD_FASE_FILTER].toUpperCase()}` : "PROGRESO GLOBAL";
  const heroSub = isFiltered ? fasePeriodos[DASHBOARD_FASE_FILTER] : "del plan operativo 2026";
  const heroBtnLabel = isFiltered ? "← Ver global" : null;

  const circ = 314;
  const offset = circ - (circ * pct / 100);

  // Upcoming hitos for current filter
  const upcoming = TODOS_LOS_HITOS.filter(h => {
    if (isFiltered && h.fase !== `Fase ${DASHBOARD_FASE_FILTER+1}`) return false;
    return getTaskState(h.taskId).status !== "completado";
  }).slice(0, 5);

  const dashboard = document.getElementById("tab-dashboard");
  dashboard.innerHTML = `
  <div class="dashboard-layout">
    <!-- LEFT: hero card (tall) -->
    <div class="dash-hero-col">
      <div class="dash-card dash-card--hero">
        ${isFiltered ? `<button class="hero-back-btn" onclick="setDashFilter(null)">← Vista global</button>` : ""}
        <div class="hero-label">${heroLabel}</div>
        <div class="hero-pct">${pct}%</div>
        <div class="hero-sub">${heroSub}</div>
        <div class="progress-track" style="margin:20px 0 28px;">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="phase-ring-wrap" style="margin:0 auto;">
          <svg class="phase-ring" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" class="ring-bg"/>
            <circle cx="60" cy="60" r="50" class="ring-fill"
              stroke-dasharray="${circ}" stroke-dashoffset="${offset}"/>
          </svg>
          <div class="ring-label">
            <span>${pct}%</span>
            <span>avance</span>
          </div>
        </div>
        <!-- Hitos below ring -->
        <div style="margin-top:28px;">
          <div class="card-title" style="color:rgba(255,255,255,0.4);margin-bottom:12px;">
            ${isFiltered ? "Hitos pendientes de esta fase" : "Próximos hitos"}
          </div>
          <div id="upcomingHitos">
            ${upcoming.length ? upcoming.map(h => `
              <div class="hito-item hito-item--dark" onclick="openDetail('${h.taskId}')">
                <div class="hito-diamond"></div>
                <div class="hito-info">
                  <div class="hito-item-name" style="color:#fff;">${h.nombre}</div>
                  <div class="hito-item-date">${h.fecha}</div>
                </div>
                <span class="hito-item-phase">${h.fase}</span>
              </div>`).join("")
            : `<p class="empty-state" style="color:rgba(255,255,255,0.35);">
                ${isFiltered ? "Sin hitos pendientes en esta fase" : "Todos los hitos completados 🎉"}
              </p>`}
          </div>
        </div>
      </div>
    </div>

    <!-- RIGHT: 2x2 phase cards + activity -->
    <div class="dash-right-col">
      <div class="dash-phases-grid">
        ${faseIds.map((fid, i) => {
          const fpct = phasePct(fid);
          const tasks = TODAS_LAS_TASKS.filter(t => t.faseId === fid);
          const done = tasks.filter(t => getTaskState(t.id).status === "completado").length;
          const isActive = i === DASHBOARD_FASE_FILTER;
          return `
          <div class="dash-card phase-card ${isActive ? "phase-card--selected" : ""}"
               onclick="setDashFilter(${isActive ? "null" : i})" style="cursor:pointer;">
            <div class="phase-card-header">
              <span class="phase-num">0${i+1}</span>
              <span class="phase-badge ${fpct===100?'phase-badge--done':fpct>0?'phase-badge--active':'phase-badge--pending'}">
                ${fpct===100?"Completado":fpct>0?"En curso":"Pendiente"}
              </span>
            </div>
            <div class="phase-card-title">${faseNombres[i]}</div>
            <div class="phase-card-period">${fasePeriodos[i]}</div>
            <div class="phase-progress-track">
              <div class="phase-progress-fill" style="width:${fpct}%"></div>
            </div>
            <div class="phase-card-stats">
              <span>${fpct}%</span>
              <span>${done} / ${tasks.length} tareas</span>
            </div>
          </div>`;
        }).join("")}
      </div>

      <!-- Activity -->
      <div class="dash-card dash-card--activity" style="margin-top:16px;">
        <div class="card-title">Actividad reciente</div>
        <div id="recentActivity" class="activity-list">
          ${STATE.actividad.length
            ? STATE.actividad.slice(0,6).map(a => `
              <div class="activity-item">
                <div class="activity-dot"></div>
                <div>
                  <div style="font-size:12px;">${a.texto}</div>
                  <div class="activity-time">${fmtDate(a.ts)}</div>
                </div>
              </div>`).join("")
            : `<p class="empty-state">Sin actividad registrada aún.</p>`}
        </div>
      </div>
    </div>
  </div>`;
}

function setDashFilter(idx) {
  DASHBOARD_FASE_FILTER = idx;
  renderDashboard();
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-AR", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });
  } catch(e) { return ""; }
}

// ════════════════════════════════════════════════════════
// GANTT ANUAL — tabla HTML real
// ════════════════════════════════════════════════════════
function renderGantt() {
  const container = document.getElementById("ganttContainer");

  // Column widths
  const LW = 260;  // label col px
  const WW = 36;   // week col px
  const MW = 58;   // month col px
  const NW = 12;   // weeks
  const NM = 7;    // months

  const monthBands = [
    { label:"MARZO", cols:3 }, { label:"ABRIL", cols:4 },
    { label:"MAYO",  cols:4 }, { label:"JUN",   cols:1 },
  ];

  let html = `<div style="overflow-x:auto;font-family:'Poppins',sans-serif;">
  <table style="border-collapse:collapse;table-layout:fixed;width:${LW+NW*WW+NM*MW}px;">
  <colgroup>
    <col style="width:${LW}px;">
    ${Array(NW).fill(`<col style="width:${WW}px;">`).join("")}
    ${Array(NM).fill(`<col style="width:${MW}px;">`).join("")}
  </colgroup>
  <thead>
    <!-- Row 1: month bands -->
    <tr style="background:#1A2E1A;">
      <th style="padding:8px 14px;font-size:10px;font-weight:600;color:rgba(255,255,255,0.4);letter-spacing:.1em;text-transform:uppercase;text-align:left;border-right:1px solid rgba(255,255,255,0.08);border-bottom:2px solid #C5E830;">PRODUCTO / FASE</th>
      ${monthBands.map(m => `<th colspan="${m.cols}" style="padding:8px 0;font-size:10px;font-weight:700;color:#C5E830;letter-spacing:.1em;text-transform:uppercase;text-align:center;border-right:1px solid rgba(255,255,255,0.1);border-bottom:2px solid #C5E830;">${m.label}</th>`).join("")}
      ${MESES_POSTERIORES.map(m => `<th style="padding:8px 0;font-size:10px;font-weight:600;color:rgba(255,255,255,0.55);letter-spacing:.08em;text-transform:uppercase;text-align:center;border-right:1px solid rgba(255,255,255,0.06);border-bottom:2px solid #C5E830;">${m.label}</th>`).join("")}
    </tr>
    <!-- Row 2: week labels -->
    <tr style="background:#3D6B20;">
      <th style="border-right:1px solid rgba(255,255,255,0.1);border-bottom:1px solid rgba(255,255,255,0.1);"></th>
      ${SEMANAS_F1.map(w => `<th style="font-size:9px;font-weight:400;color:rgba(255,255,255,0.6);padding:4px 0;text-align:center;border-right:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.1);">${w}</th>`).join("")}
      ${MESES_POSTERIORES.map(() => `<th style="border-right:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.1);"></th>`).join("")}
    </tr>
  </thead>
  <tbody>`;

  // ── Fase 1 ──────────────────────────────────────────
  html += faseHeaderRow(FASES[0], NW, NM, LW, WW, MW);

  PRODUCTOS_F1.forEach(prod => {
    const st = getTaskState(prod.id).status;
    html += prodRow(prod.id, `<span class="sdot sdot--${st}"></span>${prod.nombre}`, prod.t_start, prod.t_end, NW, NM, WW, MW, true, "row-prod");
    prod.subproductos.forEach(sub => {
      html += subRow(sub, NW, NM, WW, MW);
    });
  });

  html += sepRow(NW, NM);

  // ── Fases 2-4 ───────────────────────────────────────
  [
    { fase: FASES[1], prods: PRODUCTOS_F2 },
    { fase: FASES[2], prods: PRODUCTOS_F3 },
    { fase: FASES[3], prods: PRODUCTOS_F4 },
  ].forEach(({ fase, prods }) => {
    html += faseHeaderRow(fase, NW, NM, LW, WW, MW);
    prods.forEach(prod => {
      const st = getTaskState(prod.id).status;
      html += laterProdRow(prod, st, NW, NM, WW, MW);
    });
    html += sepRow(NW, NM);
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

function faseHeaderRow(fase, NW, NM, LW, WW, MW) {
  const obj = fase.objetivo || "";
  return `
  <tr style="background:#1A2E1A;">
    <td style="padding:9px 14px;font-size:10px;font-weight:700;color:#C5E830;letter-spacing:.1em;text-transform:uppercase;border-right:1px solid rgba(255,255,255,0.08);">
      ${fase.num} · ${fase.nombre} · ${fase.periodo}
    </td>
    ${Array(NW+NM).fill("").map((_, i) => {
      const inF1 = fase.tipo === "semanas" && i < NW && i >= fase.t_start && i <= fase.t_end;
      const isMth = fase.tipo === "meses" && i >= NW;
      const mIdx = i - NW;
      const inF234 = isMth && mIdx >= fase.t_start && mIdx <= fase.t_end;
      const bg = (inF1 || inF234) ? "background:#3D6B20;" : "";
      return `<td style="${bg}border-right:1px solid rgba(255,255,255,0.05);"></td>`;
    }).join("")}
  </tr>
  <tr style="background:#1A2E1A;border-bottom:1px solid rgba(255,255,255,0.04);">
    <td colspan="${NW+NM+1}" style="padding:5px 16px 8px 22px;font-size:10px;color:rgba(255,255,255,0.4);font-style:italic;line-height:1.5;">${obj}</td>
  </tr>`;
}

function prodRow(id, labelHtml, ts, te, NW, NM, WW, MW, isF1, cls) {
  return `
  <tr class="${cls||''}" style="background:#fff;border-bottom:1px solid #E0E0E0;cursor:pointer;"
      onmouseover="this.style.background='#EAF0E3'" onmouseout="this.style.background='#fff'"
      onclick="openDetail('${id}')">
    <td style="padding:9px 12px 9px 14px;font-size:12px;font-weight:600;color:#1A1A1A;border-right:1px solid #E0E0E0;border-left:3px solid #2D5016;">${labelHtml}</td>
    ${Array(NW+NM).fill("").map((_, i) => {
      if (isF1 && i < NW) {
        const inRange = i >= ts && i <= te;
        const st = getTaskState(id).status;
        const bg = inRange ? (st==="completado"?"#2D5016":st==="en-curso"?"#3D6B20":"#2D5016") : "transparent";
        return `<td style="background:${inRange?bg:"transparent"};border-right:1px solid rgba(224,224,224,0.5);height:38px;"></td>`;
      }
      return `<td style="border-right:1px solid rgba(224,224,224,0.5);height:38px;"></td>`;
    }).join("")}
  </tr>`;
}

function subRow(sub, NW, NM, WW, MW) {
  const st = getTaskState(sub.id).status;
  const rowBg = sub.es_hito ? "#EAF0E3" : "#FAFAFA";
  const cls = sub.es_hito ? "hito-label" : "sub-label";
  return `
  <tr style="background:${rowBg};border-bottom:1px solid #E0E0E0;cursor:pointer;"
      onmouseover="this.style.background='#EAF0E3'" onmouseout="this.style.background='${rowBg}'"
      onclick="openDetail('${sub.id}')">
    <td style="padding:7px 12px 7px 26px;font-size:11px;color:${sub.es_hito?'#2D5016':'#444'};font-weight:${sub.es_hito?600:300};border-right:1px solid #E0E0E0;">
      <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${st==='completado'?'#2D5016':st==='en-curso'?'#FFC107':'#AAAAAA'};margin-right:7px;flex-shrink:0;vertical-align:middle;"></span>
      ${sub.es_hito ? "✓ " : ""}${sub.nombre}
    </td>
    ${Array(NW+NM).fill("").map((_, i) => {
      if (i >= NW) return `<td style="border-right:1px solid rgba(224,224,224,0.4);height:32px;"></td>`;
      const inRange = i >= sub.t_start && i <= sub.t_end;
      if (!inRange) return `<td style="border-right:1px solid rgba(224,224,224,0.4);height:32px;"></td>`;
      if (sub.es_hito) {
        return `<td style="background:#C5E830;border-right:1px solid rgba(224,224,224,0.4);height:32px;text-align:center;vertical-align:middle;">
          <div style="width:11px;height:11px;background:#2D5016;transform:rotate(45deg);display:inline-block;border:1.5px solid #1A2E1A;"></div>
        </td>`;
      }
      const bg = st==="completado"?"#2D5016":st==="en-curso"?"#3D6B20":"#E8ECF2";
      return `<td style="background:${bg};border-right:1px solid rgba(224,224,224,0.4);height:32px;"></td>`;
    }).join("")}
  </tr>`;
}

function laterProdRow(prod, st, NW, NM, WW, MW) {
  return `
  <tr style="background:#fff;border-bottom:1px solid #E0E0E0;cursor:pointer;"
      onmouseover="this.style.background='#EAF0E3'" onmouseout="this.style.background='#fff'"
      onclick="openDetail('${prod.id}')">
    <td style="padding:9px 12px 9px 14px;font-size:12px;font-weight:600;color:#1A1A1A;border-right:1px solid #E0E0E0;border-left:3px solid #2D5016;">
      <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${st==='completado'?'#2D5016':st==='en-curso'?'#FFC107':'#AAAAAA'};margin-right:7px;vertical-align:middle;"></span>
      ${prod.nombre}
    </td>
    ${Array(NW+NM).fill("").map((_, i) => {
      if (i < NW) return `<td style="border-right:1px solid rgba(224,224,224,0.4);height:38px;"></td>`;
      const mIdx = i - NW;
      const isHito = prod.t_hito === mIdx;
      const inRange = mIdx >= prod.t_start && mIdx <= prod.t_end;
      if (isHito) {
        return `<td style="background:#C5E830;border-right:1px solid rgba(224,224,224,0.4);height:38px;text-align:center;vertical-align:middle;">
          <div style="width:12px;height:12px;background:#2D5016;transform:rotate(45deg);display:inline-block;"></div>
        </td>`;
      }
      if (inRange) {
        const bg = st==="completado"?"#2D5016":st==="en-curso"?"#3D6B20":"#2D5016";
        return `<td style="background:${bg};border-right:1px solid rgba(224,224,224,0.4);height:38px;"></td>`;
      }
      return `<td style="border-right:1px solid rgba(224,224,224,0.4);height:38px;"></td>`;
    }).join("")}
  </tr>`;
}

function sepRow(NW, NM) {
  return `<tr style="background:#1A2E1A;height:6px;"><td colspan="${NW+NM+1}"></td></tr>`;
}

// ════════════════════════════════════════════════════════
// FASE 1 DETAIL
// ════════════════════════════════════════════════════════
function renderFase1() {
  const container = document.getElementById("fase1Products");
  container.innerHTML = PRODUCTOS_F1.map(prod => {
    const st = getTaskState(prod.id).status;
    const completedSubs = prod.subproductos.filter(s => getTaskState(s.id).status === "completado").length;
    const totalSubs = prod.subproductos.length;
    const pct = Math.round(completedSubs / totalSubs * 100);
    const desc = getDesc(prod.id, prod.desc);

    return `
    <div class="f1-product" id="f1prod-${prod.id}">
      <div class="f1-product-header" onclick="toggleF1Product('${prod.id}')">
        <div class="f1-product-num">${prod.num}</div>
        <div class="f1-product-info">
          <div class="f1-product-name">${prod.nombre}</div>
          <div class="f1-product-desc">${prod.hito.fecha}</div>
        </div>
        <div style="display:flex;align-items:center;gap:20px;">
          <div style="text-align:right;">
            <div style="font-size:10px;font-weight:700;letter-spacing:.08em;color:#C5E830;text-transform:uppercase;margin-bottom:2px;">Avance</div>
            <div style="font-size:20px;font-weight:700;color:#C5E830;">${pct}%</div>
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
        <div style="padding:18px 22px 14px;border-bottom:1px solid #E0E0E0;background:#FAFAFA;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
          <div style="flex:1;">
            <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#4A5568;margin-bottom:8px;">Descripción</div>
            <p style="font-size:13px;color:#444;line-height:1.7;font-weight:300;">${desc}</p>
          </div>
          <button class="edit-desc-btn" onclick="openDetail('${prod.id}')" title="Editar descripción">✎</button>
        </div>
        <div style="padding:16px 22px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#4A5568;margin-bottom:12px;">Cronograma semanal</div>
          ${renderF1MiniGantt(prod)}
        </div>
      </div>
    </div>`;
  }).join("");
}

function renderF1MiniGantt(prod) {
  const CW = 42;
  const LW = 260;
  const N = 12;
  const bands = [
    { label:"MAR", s:0, span:3 }, { label:"ABR", s:3, span:4 },
    { label:"MAY", s:7, span:4 }, { label:"JUN", s:11, span:1 },
  ];

  let html = `<div style="overflow-x:auto;"><table style="border-collapse:collapse;table-layout:fixed;width:${LW+N*CW}px;">
  <colgroup><col style="width:${LW}px;">${Array(N).fill(`<col style="width:${CW}px;">`).join("")}</colgroup>
  <thead>
    <tr style="background:#1A2E1A;">
      <th style="border-right:1px solid rgba(255,255,255,.1);padding:4px 8px;font-size:9px;color:rgba(255,255,255,.4);text-transform:uppercase;font-weight:600;letter-spacing:.08em;">Tarea</th>
      ${bands.map(b => `<th colspan="${b.span}" style="font-size:9px;font-weight:700;color:#C5E830;text-align:center;letter-spacing:.08em;padding:4px 0;border-right:1px solid rgba(255,255,255,.1);">${b.label}</th>`).join("")}
    </tr>
    <tr style="background:#3D6B20;">
      <th style="border-right:1px solid rgba(255,255,255,.1);"></th>
      ${SEMANAS_F1.map(w => `<th style="font-size:8px;color:rgba(255,255,255,.6);text-align:center;padding:3px 0;border-right:1px solid rgba(255,255,255,.06);">${w}</th>`).join("")}
    </tr>
  </thead>
  <tbody>`;

  prod.subproductos.forEach(sub => {
    const st = getTaskState(sub.id).status;
    const rowBg = sub.es_hito ? "#EAF0E3" : "#fff";
    const dot = `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${st==='completado'?'#2D5016':st==='en-curso'?'#FFC107':'#CCC'};margin-right:6px;vertical-align:middle;"></span>`;

    html += `<tr style="background:${rowBg};border-bottom:1px solid #E0E0E0;cursor:pointer;"
      onmouseover="this.style.background='#EAF0E3'" onmouseout="this.style.background='${rowBg}'"
      onclick="openDetail('${sub.id}')">
      <td style="padding:6px 10px 6px 12px;font-size:11px;color:${sub.es_hito?'#2D5016':'#444'};font-weight:${sub.es_hito?600:300};border-right:1px solid #E0E0E0;">${dot}${sub.es_hito?"✓ ":""}${sub.nombre}</td>
      ${Array(N).fill("").map((_, i) => {
        const inRange = i >= sub.t_start && i <= sub.t_end;
        if (!inRange) return `<td style="border-right:1px solid rgba(224,224,224,.5);height:32px;"></td>`;
        if (sub.es_hito) return `<td style="background:#C5E830;border-right:1px solid rgba(224,224,224,.5);height:32px;text-align:center;vertical-align:middle;"><div style="width:10px;height:10px;background:#2D5016;transform:rotate(45deg);display:inline-block;"></div></td>`;
        const bg = st==="completado"?"#2D5016":st==="en-curso"?"#3D6B20":"#E8ECF2";
        return `<td style="background:${bg};border-right:1px solid rgba(224,224,224,.5);height:32px;"></td>`;
      }).join("")}
    </tr>`;
  });

  html += `</tbody></table></div>`;
  return html;
}

function toggleF1Product(prodId) {
  const body = document.getElementById(`f1body-${prodId}`);
  const toggle = document.getElementById(`f1toggle-${prodId}`);
  body.classList.toggle("open");
  toggle.classList.toggle("open");
}

// ════════════════════════════════════════════════════════
// HITOS CALENDAR
// ════════════════════════════════════════════════════════
function renderHitos() {
  const container = document.getElementById("hitoCalendar");
  const MESES = ["Abril","Mayo","Agosto","Noviembre","Diciembre"];
  container.innerHTML = MESES.map(mes => {
    const hitosDelMes = TODOS_LOS_HITOS.filter(h => h.mes === mes);
    return `
    <div class="hito-month-block">
      <div class="hito-month-name">${mes.toUpperCase()} 2026</div>
      ${hitosDelMes.length
        ? `<div class="hito-month-items">${hitosDelMes.map(h => {
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
          }).join("")}</div>`
        : `<div class="hito-month-empty">Sin hitos registrados en este mes.</div>`}
    </div>`;
  }).join("");
}

// ════════════════════════════════════════════════════════
// DETAIL PANEL — incluye campo de descripción editable
// ════════════════════════════════════════════════════════
function initDetailPanel() {
  document.getElementById("detailClose").addEventListener("click", closeDetail);
  document.getElementById("detailOverlay").addEventListener("click", closeDetail);
  document.querySelectorAll(".status-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!IS_EDITOR) return;
      document.querySelectorAll(".status-btn").forEach(b => b.classList.remove("active", "pendiente","en-curso","completado"));
      btn.classList.add("active", btn.dataset.status);
    });
  });
  document.getElementById("detailSave").addEventListener("click", saveDetail);
}

function openDetail(taskId) {
  DETAIL_TASK_ID = taskId;

  // Find task info across all data
  let nombre = taskId;
  let fase = "";
  let meta = "";
  let currentDesc = "";
  let hasDesc = false;

  PRODUCTOS_F1.forEach(p => {
    if (p.id === taskId) {
      nombre = p.nombre; fase = `Fase 1 · Producto ${p.num}`;
      meta = p.hito.fecha;
      currentDesc = getDesc(p.id, p.desc);
      hasDesc = true;
    }
    p.subproductos.forEach(s => {
      if (s.id === taskId) {
        nombre = s.nombre; fase = `Fase 1 · ${p.nombre}`;
        meta = s.fecha || "";
        currentDesc = getDesc(s.id, "");
        hasDesc = true;
      }
    });
  });

  const laterProds = [...PRODUCTOS_F2, ...PRODUCTOS_F3, ...PRODUCTOS_F4];
  laterProds.forEach(p => {
    if (p.id === taskId) {
      nombre = p.nombre;
      const fi = p.id.startsWith("f2")?"Fase 2":p.id.startsWith("f3")?"Fase 3":"Fase 4";
      fase = fi;
      meta = p.hito ? p.hito.fecha : "";
      currentDesc = getDesc(p.id, "");
      hasDesc = true;
    }
  });

  const st = getTaskState(taskId);

  document.getElementById("detailPhaseTag").textContent = fase || "Proyecto 2026";
  document.getElementById("detailTitle").textContent = nombre;
  document.getElementById("detailMeta").textContent = meta;
  document.getElementById("detailNotes").value = st.notas || "";
  document.getElementById("detailNotes").disabled = !IS_EDITOR;
  document.getElementById("detailSave").disabled = !IS_EDITOR;

  // Show/hide description field
  const descSection = document.getElementById("detailDescSection");
  if (descSection) {
    descSection.style.display = hasDesc ? "block" : "none";
    const descEl = document.getElementById("detailDescText");
    if (descEl) { descEl.value = currentDesc; descEl.disabled = !IS_EDITOR; }
  }

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
  const descEl = document.getElementById("detailDescText");
  const desc = descEl ? descEl.value : undefined;
  setTaskState(DETAIL_TASK_ID, status, notas, desc);
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
    setStatus("gistStatus","ok","✓ Configuración guardada");
    toast("✓ Configuración guardada");
  });

  document.getElementById("testGist").addEventListener("click", async () => {
    const id = document.getElementById("gistId").value.trim();
    const token = document.getElementById("gistToken").value.trim();
    if (!id) { setStatus("gistStatus","err","Ingresá el ID del Gist"); return; }
    setStatus("gistStatus","","Probando conexión…");
    try {
      const res = await fetch(`https://api.github.com/gists/${id}`, {
        headers: token ? { Authorization: `token ${token}` } : {}
      });
      setStatus("gistStatus", res.ok ? "ok" : "err", res.ok ? "✓ Conexión exitosa" : "Error: Gist no encontrado o token inválido");
    } catch(e) { setStatus("gistStatus","err","Error de red"); }
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
    const data = JSON.stringify({ version:STATE.version, tareas:STATE.tareas, actividad:STATE.actividad, descripciones:STATE.descripciones||{} }, null, 2);
    const blob = new Blob([data], { type:"application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "ia-estado-2026.json"; a.click();
    toast("✓ Estado exportado");
  });

  document.getElementById("importFile").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        mergeState(JSON.parse(ev.target.result));
        saveStateLocal();
        refreshAll();
        toast("✓ Estado importado correctamente");
      } catch(err) { toast("Error: archivo JSON inválido"); }
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
