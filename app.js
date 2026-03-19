// ═══════════════════════════════════════════════════════
// APP.JS · Estrategias de IA 2026
// ═══════════════════════════════════════════════════════

let STATE = JSON.parse(JSON.stringify(ESTADO_INICIAL));
let IS_EDITOR = false;
let DETAIL_TASK_ID = null;
let DASHBOARD_FASE_FILTER = null;

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
    const cfg = JSON.parse(localStorage.getItem("ia_config")||"{}");
    if (cfg.gistId) STATE.config.gistId = cfg.gistId;
    if (cfg.gistToken) STATE.config.gistToken = cfg.gistToken;
    if (cfg.editorPassword) STATE.config.editorPassword = cfg.editorPassword;
  } catch(e){}
  if (STATE.config.gistId) { loadFromGist(); return; }
  try {
    const saved = JSON.parse(localStorage.getItem("ia_state")||"null");
    if (saved?.version) mergeState(saved);
  } catch(e){}
}

function mergeState(saved) {
  if (saved.tareas)       STATE.tareas = {...STATE.tareas,...saved.tareas};
  if (saved.actividad)    STATE.actividad = saved.actividad;
  if (saved.descripciones) STATE.descripciones = {...(STATE.descripciones||{}),...saved.descripciones};
  if (saved.cronograma)   { STATE.cronograma = saved.cronograma; applyDynamicCronograma(saved.cronograma); }
}

function saveStateLocal() {
  saveCronogramaToState(STATE);
  localStorage.setItem("ia_state", JSON.stringify({
    version:STATE.version, tareas:STATE.tareas,
    actividad:STATE.actividad, descripciones:STATE.descripciones||{},
    cronograma:STATE.cronograma
  }));
}

function saveConfigLocal() {
  localStorage.setItem("ia_config", JSON.stringify(STATE.config));
}

async function loadFromGist() {
  setSyncStatus("syncing","Sincronizando…");
  try {
    const res = await fetch(`https://api.github.com/gists/${STATE.config.gistId}`,{
      headers: STATE.config.gistToken ? {Authorization:`token ${STATE.config.gistToken}`} : {}
    });
    if (!res.ok) throw new Error("err");
    const data = await res.json();
    const fname = Object.keys(data.files)[0];
    mergeState(JSON.parse(data.files[fname].content));
    setSyncStatus("synced","Sincronizado ✓");
    refreshAll();
  } catch(e) {
    setSyncStatus("error","Error de sincronización");
    try { const s=JSON.parse(localStorage.getItem("ia_state")||"null"); if(s) mergeState(s); } catch(e2){}
  }
}

async function saveToGist(showToast=true) {
  saveCronogramaToState(STATE);
  if (!STATE.config.gistId || !STATE.config.gistToken) {
    saveStateLocal();
    if (showToast) toast("Guardado localmente (sin Gist configurado)");
    return;
  }
  setSyncStatus("syncing","Guardando…");
  try {
    const payload = {version:STATE.version,tareas:STATE.tareas,
      actividad:STATE.actividad.slice(0,50),descripciones:STATE.descripciones||{},
      cronograma:STATE.cronograma};
    const res = await fetch(`https://api.github.com/gists/${STATE.config.gistId}`,{
      method:"PATCH",
      headers:{Authorization:`token ${STATE.config.gistToken}`,"Content-Type":"application/json"},
      body: JSON.stringify({files:{"ia-estado-2026.json":{content:JSON.stringify(payload,null,2)}}})
    });
    if (!res.ok) throw new Error("err");
    saveStateLocal();
    setSyncStatus("synced","Guardado en Gist ✓");
    if (showToast) toast("✓ Cambios guardados y sincronizados");
  } catch(e) {
    saveStateLocal();
    setSyncStatus("error","Error al sincronizar");
    if (showToast) toast("Guardado localmente (error de red)");
  }
}

function setSyncStatus(type,text) {
  const el = document.getElementById("syncStatus");
  el.className = "sync-status "+type;
  el.innerHTML = "●&nbsp;"+text;
}

// ════════════════════════════════════════════════════════
// NAVEGACIÓN
// ════════════════════════════════════════════════════════
function initNav() {
  document.querySelectorAll("[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tab) {
  document.querySelectorAll("[data-tab]").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(`[data-tab="${tab}"]`).forEach(b => b.classList.add("active"));
  document.getElementById("tab-"+tab).classList.add("active");
}

// ════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════
function getTaskState(id){ return STATE.tareas[id]||{status:"pendiente",notas:""}; }
function getDesc(id,fb){ return (STATE.descripciones&&STATE.descripciones[id])||fb; }

function setTaskState(id,status,notas,desc) {
  const prev = getTaskState(id);
  STATE.tareas[id] = {status,notas,updatedAt:new Date().toISOString()};
  if (desc!==undefined) { if(!STATE.descripciones)STATE.descripciones={}; STATE.descripciones[id]=desc; }
  if (prev.status!==status) {
    const t = TODAS_LAS_TASKS.find(t=>t.id===id);
    addActividad(`"${(t?t.nombre:id).slice(0,50)}" → ${statusLabel(status)}`);
  }
}

function addActividad(texto){ STATE.actividad.unshift({texto,ts:new Date().toISOString()}); if(STATE.actividad.length>50)STATE.actividad=STATE.actividad.slice(0,50); }
function statusLabel(s){ return {pendiente:"Pendiente","en-curso":"En curso",completado:"Completado"}[s]||s; }
function phasePct(fid){ const t=TODAS_LAS_TASKS.filter(t=>t.faseId===fid); return t.length?Math.round(t.filter(t=>getTaskState(t.id).status==="completado").length/t.length*100):0; }
function globalPct(){ const t=TODAS_LAS_TASKS; return t.length?Math.round(t.filter(t=>getTaskState(t.id).status==="completado").length/t.length*100):0; }
function fmtDate(iso){ try{return new Date(iso).toLocaleDateString("es-AR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}catch(e){return"";} }
function dot(st){ return `<span class="sdot sdot--${st}"></span>`; }

// ════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════
function renderDashboard() {
  const fids=["f1","f2","f3","f4"];
  const fnames=["Gobernanza y Diagnóstico","Estrategia y Marco Normativo","Desarrollo de Pilotos","Evaluación y Cierre"];
  const fperiods=["Mar – Jun 2026","Jun – Ago 2026","Sep – Nov 2026","Dic 2026"];
  const isF = DASHBOARD_FASE_FILTER!==null;
  const afid = isF?fids[DASHBOARD_FASE_FILTER]:null;
  const pct = isF?phasePct(afid):globalPct();
  const circ=314, offset=circ-(circ*pct/100);
  const upcoming = TODOS_LOS_HITOS.filter(h=>{
    if(isF && h.fase!==`Fase ${DASHBOARD_FASE_FILTER+1}`) return false;
    return getTaskState(h.taskId).status!=="completado";
  }).slice(0,5);

  document.getElementById("tab-dashboard").innerHTML = `
  <div class="dashboard-layout">
    <div class="dash-hero-col">
      <div class="dash-card dash-card--hero">
        ${isF?`<button class="hero-back-btn" onclick="setDashFilter(null)">← Vista global</button>`:""}
        <div class="hero-label">${isF?`FASE ${DASHBOARD_FASE_FILTER+1} · ${fnames[DASHBOARD_FASE_FILTER].toUpperCase()}`:"PROGRESO GLOBAL"}</div>
        <div class="hero-pct">${pct}%</div>
        <div class="hero-sub">${isF?fperiods[DASHBOARD_FASE_FILTER]:"del plan operativo 2026"}</div>
        <div class="progress-track" style="margin:16px 0 24px;">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="phase-ring-wrap" style="margin:0 auto 24px;">
          <svg class="phase-ring" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" class="ring-bg"/>
            <circle cx="60" cy="60" r="50" class="ring-fill" stroke-dasharray="${circ}" stroke-dashoffset="${offset}"/>
          </svg>
          <div class="ring-label"><span>${pct}%</span><span>avance</span></div>
        </div>
        <div class="card-title" style="color:rgba(255,255,255,.4);margin-bottom:10px;">${isF?"Hitos pendientes":"Próximos hitos"}</div>
        ${upcoming.length?upcoming.map(h=>`
          <div class="hito-item hito-item--dark" onclick="openDetail('${h.taskId}')">
            <div class="hito-diamond"></div>
            <div class="hito-info">
              <div class="hito-item-name" style="color:#fff;">${h.nombre}</div>
              <div class="hito-item-date">${h.fecha}</div>
            </div>
            <span class="hito-item-phase">${h.fase}</span>
          </div>`).join(""):`<p class="empty-state" style="color:rgba(255,255,255,.35);">Sin hitos pendientes 🎉</p>`}
      </div>
    </div>
    <div class="dash-right-col">
      <div class="dash-phases-grid">
        ${fids.map((fid,i)=>{
          const fp=phasePct(fid),tasks=TODAS_LAS_TASKS.filter(t=>t.faseId===fid),done=tasks.filter(t=>getTaskState(t.id).status==="completado").length;
          return `<div class="dash-card phase-card ${i===DASHBOARD_FASE_FILTER?"phase-card--selected":""}" onclick="setDashFilter(${i===DASHBOARD_FASE_FILTER?"null":i})" style="cursor:pointer;">
            <div class="phase-card-header"><span class="phase-num">0${i+1}</span>
              <span class="phase-badge ${fp===100?"phase-badge--done":fp>0?"phase-badge--active":"phase-badge--pending"}">${fp===100?"Completado":fp>0?"En curso":"Pendiente"}</span>
            </div>
            <div class="phase-card-title">${fnames[i]}</div>
            <div class="phase-card-period">${fperiods[i]}</div>
            <div class="phase-progress-track"><div class="phase-progress-fill" style="width:${fp}%"></div></div>
            <div class="phase-card-stats"><span>${fp}%</span><span>${done}/${tasks.length} tareas</span></div>
          </div>`;
        }).join("")}
      </div>
      <div class="dash-card dash-card--activity" style="margin-top:14px;">
        <div class="card-title">Actividad reciente</div>
        ${STATE.actividad.length?STATE.actividad.slice(0,6).map(a=>`
          <div class="activity-item"><div class="activity-dot"></div>
            <div><div style="font-size:12px;">${a.texto}</div><div class="activity-time">${fmtDate(a.ts)}</div></div>
          </div>`).join(""):`<p class="empty-state">Sin actividad registrada aún.</p>`}
      </div>
    </div>
  </div>`;
}

function setDashFilter(idx){ DASHBOARD_FASE_FILTER=idx; renderDashboard(); }

// ════════════════════════════════════════════════════════
// GANTT — tabla HTML con edición inline
// ════════════════════════════════════════════════════════
function renderGantt() {
  const LW=260,WW=36,MW=56,NW=12,NM=7;
  const mBands=[{label:"MARZO",cols:3},{label:"ABRIL",cols:4},{label:"MAYO",cols:4},{label:"JUN",cols:1}];

  let html=`<div style="overflow-x:auto;font-family:'Poppins',sans-serif;">
  <table style="border-collapse:collapse;table-layout:fixed;width:${LW+NW*WW+NM*MW}px;">
  <colgroup><col style="width:${LW}px;">${Array(NW).fill(`<col style="width:${WW}px;">`).join("")}${Array(NM).fill(`<col style="width:${MW}px;">`).join("")}</colgroup>
  <thead>
    <tr style="background:#1A2E1A;">
      <th style="padding:8px 14px;font-size:10px;font-weight:600;color:rgba(255,255,255,.4);letter-spacing:.1em;text-transform:uppercase;text-align:left;border-right:1px solid rgba(255,255,255,.08);border-bottom:2px solid #C5E830;">PRODUCTO / FASE</th>
      ${mBands.map(m=>`<th colspan="${m.cols}" style="padding:8px 0;font-size:10px;font-weight:700;color:#C5E830;letter-spacing:.1em;text-transform:uppercase;text-align:center;border-right:1px solid rgba(255,255,255,.1);border-bottom:2px solid #C5E830;">${m.label}</th>`).join("")}
      ${MESES_POSTERIORES.map(m=>`<th style="padding:8px 0;font-size:10px;font-weight:600;color:rgba(255,255,255,.55);letter-spacing:.08em;text-transform:uppercase;text-align:center;border-right:1px solid rgba(255,255,255,.06);border-bottom:2px solid #C5E830;">${m.label}</th>`).join("")}
    </tr>
    <tr style="background:#3D6B20;">
      <th style="border-right:1px solid rgba(255,255,255,.1);border-bottom:1px solid rgba(255,255,255,.1);"></th>
      ${SEMANAS_F1.map(w=>`<th style="font-size:9px;font-weight:400;color:rgba(255,255,255,.6);padding:4px 0;text-align:center;border-right:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.1);">${w}</th>`).join("")}
      ${MESES_POSTERIORES.map(()=>`<th style="border-right:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.1);"></th>`).join("")}
    </tr>
  </thead>
  <tbody>`;

  // F1
  html += ganttFaseRow(FASES[0],NW,NM);
  PRODUCTOS_F1.forEach(prod=>{
    const st=getTaskState(prod.id).status;
    html += ganttProdRow(prod.id,prod.nombre,prod.t_start,prod.t_end,st,true,NW,NM);
    prod.subproductos.forEach(sub=>{ html += ganttSubRow(sub,NW,NM); });
    if(IS_EDITOR) html += ganttAddSubRow(prod.id,NW,NM);
  });
  html += ganttSepRow(NW,NM);

  // F2-F4
  [{fase:FASES[1],prods:PRODUTOS_F2_alias()},{fase:FASES[2],prods:PRODUTOS_F3_alias()},{fase:FASES[3],prods:PRODUTOS_F4_alias()}].forEach(({fase,prods})=>{
    html += ganttFaseRow(fase,NW,NM);
    prods.forEach(prod=>{ html += ganttLaterRow(prod,getTaskState(prod.id).status,NW,NM); });
    html += ganttSepRow(NW,NM);
  });

  html += `</tbody></table></div>`;
  document.getElementById("ganttContainer").innerHTML = html;
}

function PRODUTOS_F2_alias(){ return PRODUCTOS_F2; }
function PRODUTOS_F3_alias(){ return PRODUCTOS_F3; }
function PRODUTOS_F4_alias(){ return PRODUCTOS_F4; }

function ganttFaseRow(fase,NW,NM){
  const editAttr = IS_EDITOR ? `ondblclick="startInlineEdit(event,'${fase.id}','fase')"` : "";
  return `<tr style="background:#1A2E1A;">
    <td style="padding:9px 14px;font-size:10px;font-weight:700;color:#C5E830;letter-spacing:.1em;text-transform:uppercase;border-right:1px solid rgba(255,255,255,.08);" ${editAttr}>
      ${fase.num} · <span class="inline-label" data-id="${fase.id}">${fase.nombre}</span> · ${fase.periodo}
      ${IS_EDITOR?`<span class="inline-hint" style="color:rgba(255,255,255,.3);">✎</span>`:""}
    </td>
    ${Array(NW+NM).fill("").map((_,i)=>{
      const inF1=fase.tipo==="semanas"&&i<NW&&i>=fase.t_start&&i<=fase.t_end;
      const mIdx=i-NW; const inF234=fase.tipo==="meses"&&i>=NW&&mIdx>=fase.t_start&&mIdx<=fase.t_end;
      return `<td style="${(inF1||inF234)?"background:#3D6B20;":""}border-right:1px solid rgba(255,255,255,.05);"></td>`;
    }).join("")}
  </tr>
  <tr style="background:#1A2E1A;">
    <td colspan="${NW+NM+1}" style="padding:5px 16px 8px 22px;font-size:10px;color:rgba(255,255,255,.4);font-style:italic;">${fase.objetivo}</td>
  </tr>`;
}

function ganttProdRow(id,nombre,ts,te,st,isF1,NW,NM){
  const editAttr = IS_EDITOR ? `ondblclick="startInlineEdit(event,'${id}','prod')"` : "";
  return `<tr style="background:#fff;border-bottom:1px solid #E0E0E0;cursor:pointer;"
    onmouseover="this.style.background='#EAF0E3'" onmouseout="this.style.background='#fff'"
    onclick="openDetail('${id}')">
    <td style="padding:9px 12px 9px 14px;font-size:12px;font-weight:600;color:#1A1A1A;border-right:1px solid #E0E0E0;border-left:3px solid #2D5016;" ${editAttr}>
      ${dot(st)}<span class="inline-label" data-id="${id}">${nombre}</span>
      ${IS_EDITOR?`<span class="inline-hint" title="Doble click para editar">✎</span>`:""}
    </td>
    ${Array(NW+NM).fill("").map((_,i)=>{
      if(!isF1||i>=NW) return `<td style="border-right:1px solid rgba(224,224,224,.5);height:38px;"></td>`;
      if(i<ts||i>te) return `<td style="border-right:1px solid rgba(224,224,224,.5);height:38px;"></td>`;
      const bg=st==="completado"?"#2D5016":st==="en-curso"?"#3D6B20":"#2D5016";
      return `<td style="background:${bg};border-right:1px solid rgba(224,224,224,.5);height:38px;"></td>`;
    }).join("")}
  </tr>`;
}

function ganttSubRow(sub,NW,NM){
  const st=getTaskState(sub.id).status;
  const rowBg=sub.es_hito?"#EAF0E3":"#FAFAFA";
  const editAttr = IS_EDITOR ? `ondblclick="startInlineEdit(event,'${sub.id}','sub')"` : "";
  return `<tr style="background:${rowBg};border-bottom:1px solid #E0E0E0;cursor:pointer;"
    onmouseover="this.style.background='#EAF0E3'" onmouseout="this.style.background='${rowBg}'"
    onclick="openDetail('${sub.id}')">
    <td style="padding:7px 12px 7px 26px;font-size:11px;color:${sub.es_hito?"#2D5016":"#444"};font-weight:${sub.es_hito?600:300};border-right:1px solid #E0E0E0;" ${editAttr}>
      <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${st==="completado"?"#2D5016":st==="en-curso"?"#FFC107":"#CCC"};margin-right:7px;vertical-align:middle;"></span>
      ${sub.es_hito?"✓ ":""}<span class="inline-label" data-id="${sub.id}">${sub.nombre}</span>
      ${IS_EDITOR?`<span class="inline-hint" title="Doble click para editar">✎</span>`:""}
      ${IS_EDITOR?`<button class="del-sub-btn" onclick="event.stopPropagation();deleteSub('${sub.id}')" title="Eliminar">✕</button>`:""}
    </td>
    ${Array(NW+NM).fill("").map((_,i)=>{
      if(i>=NW) return `<td style="border-right:1px solid rgba(224,224,224,.4);height:32px;"></td>`;
      if(i<sub.t_start||i>sub.t_end) return `<td style="border-right:1px solid rgba(224,224,224,.4);height:32px;"></td>`;
      if(sub.es_hito) return `<td style="background:#C5E830;border-right:1px solid rgba(224,224,224,.4);height:32px;text-align:center;vertical-align:middle;"><div style="width:11px;height:11px;background:#2D5016;transform:rotate(45deg);display:inline-block;border:1.5px solid #1A2E1A;"></div></td>`;
      const bg=st==="completado"?"#2D5016":st==="en-curso"?"#3D6B20":"#E8ECF2";
      return `<td style="background:${bg};border-right:1px solid rgba(224,224,224,.4);height:32px;"></td>`;
    }).join("")}
  </tr>`;
}

function ganttAddSubRow(prodId,NW,NM){
  return `<tr style="background:#F8FBF4;border-bottom:1px solid #E0E0E0;">
    <td colspan="${NW+NM+1}" style="padding:5px 14px 5px 26px;">
      <button class="add-sub-btn" onclick="addSub('${prodId}')">+ Agregar subfase</button>
    </td>
  </tr>`;
}

function ganttLaterRow(prod,st,NW,NM){
  const editAttr = IS_EDITOR ? `ondblclick="startInlineEdit(event,'${prod.id}','later')"` : "";
  return `<tr style="background:#fff;border-bottom:1px solid #E0E0E0;cursor:pointer;"
    onmouseover="this.style.background='#EAF0E3'" onmouseout="this.style.background='#fff'"
    onclick="openDetail('${prod.id}')">
    <td style="padding:9px 12px 9px 14px;font-size:12px;font-weight:600;color:#1A1A1A;border-right:1px solid #E0E0E0;border-left:3px solid #2D5016;" ${editAttr}>
      ${dot(st)}<span class="inline-label" data-id="${prod.id}">${prod.nombre}</span>
      ${IS_EDITOR?`<span class="inline-hint">✎</span>`:""}
    </td>
    ${Array(NW+NM).fill("").map((_,i)=>{
      if(i<NW) return `<td style="border-right:1px solid rgba(224,224,224,.4);height:38px;"></td>`;
      const mIdx=i-NW;
      if(prod.t_hito===mIdx) return `<td style="background:#C5E830;border-right:1px solid rgba(224,224,224,.4);height:38px;text-align:center;vertical-align:middle;"><div style="width:12px;height:12px;background:#2D5016;transform:rotate(45deg);display:inline-block;"></div></td>`;
      if(mIdx>=prod.t_start&&mIdx<=prod.t_end){const bg=st==="completado"?"#2D5016":st==="en-curso"?"#3D6B20":"#2D5016";return `<td style="background:${bg};border-right:1px solid rgba(224,224,224,.4);height:38px;"></td>`;}
      return `<td style="border-right:1px solid rgba(224,224,224,.4);height:38px;"></td>`;
    }).join("")}
  </tr>`;
}

function ganttSepRow(NW,NM){ return `<tr style="background:#1A2E1A;height:6px;"><td colspan="${NW+NM+1}"></td></tr>`; }

// ── Inline edit ───────────────────────────────────────
function startInlineEdit(event,id,tipo){
  if(!IS_EDITOR) return;
  event.stopPropagation();
  const span = document.querySelector(`.inline-label[data-id="${id}"]`);
  if(!span) return;
  const current = span.textContent.trim();
  const input = document.createElement("input");
  input.type="text"; input.value=current; input.className="inline-edit-input";
  span.replaceWith(input);
  input.focus(); input.select();
  function commit(){
    const newVal = input.value.trim()||current;
    updateTaskName(id, newVal, tipo);
    renderGantt();
    renderFase1();
  }
  input.addEventListener("blur", commit);
  input.addEventListener("keydown", e=>{ if(e.key==="Enter")input.blur(); if(e.key==="Escape"){input.value=current;input.blur();} });
}

function updateTaskName(id, newName, tipo){
  if(tipo==="fase"){
    FASES.forEach(f=>{ if(f.id===id) f.nombre=newName; });
  } else if(tipo==="prod"||tipo==="sub"){
    PRODUCTOS_F1.forEach(p=>{
      if(p.id===id) p.nombre=newName;
      p.subproductos.forEach(s=>{ if(s.id===id) s.nombre=newName; });
    });
  } else {
    [...PRODUCTOS_F2,...PRODUCTOS_F3,...PRODUCTOS_F4].forEach(p=>{ if(p.id===id) p.nombre=newName; });
  }
  TODAS_LAS_TASKS = buildAllTasks();
  addActividad(`Renombrado: "${newName.slice(0,40)}"`);
  saveToGist(false);
}

// ── Agregar / eliminar subfase ────────────────────────
function addSub(prodId){
  if(!IS_EDITOR) return;
  const prod = PRODUCTOS_F1.find(p=>p.id===prodId);
  if(!prod) return;
  const id = genId("sub");
  prod.subproductos.push({id,nombre:"Nueva subfase",t_start:0,t_end:2,es_hito:false});
  TODAS_LAS_TASKS = buildAllTasks();
  saveToGist(false);
  renderGantt();
  renderFase1();
  // auto-open detail for the new sub
  setTimeout(()=>openDetail(id),100);
}

function deleteSub(subId){
  if(!IS_EDITOR) return;
  if(!confirm("¿Eliminar esta subfase?")) return;
  PRODUCTOS_F1.forEach(p=>{
    p.subproductos = p.subproductos.filter(s=>s.id!==subId);
  });
  delete STATE.tareas[subId];
  TODAS_LAS_TASKS = buildAllTasks();
  saveToGist(false);
  renderGantt();
  renderFase1();
  toast("Subfase eliminada");
}

// ════════════════════════════════════════════════════════
// FASE 1
// ════════════════════════════════════════════════════════
function renderFase1(){
  const container = document.getElementById("fase1Products");
  container.innerHTML = PRODUCTOS_F1.map(prod=>{
    const completedSubs=prod.subproductos.filter(s=>getTaskState(s.id).status==="completado").length;
    const totalSubs=prod.subproductos.length;
    const pct=totalSubs?Math.round(completedSubs/totalSubs*100):0;
    const desc=getDesc(prod.id,prod.desc);
    return `
    <div class="f1-product">
      <div class="f1-product-header" onclick="toggleF1Product('${prod.id}')">
        <div class="f1-product-num">${prod.num}</div>
        <div class="f1-product-info">
          <div class="f1-product-name">${prod.nombre}</div>
          <div class="f1-product-desc">${prod.hito.fecha}</div>
        </div>
        <div style="display:flex;align-items:center;gap:20px;">
          <div style="text-align:right;">
            <div style="font-size:10px;font-weight:700;color:#C5E830;text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px;">Avance</div>
            <div style="font-size:20px;font-weight:700;color:#C5E830;">${pct}%</div>
            <div style="font-size:10px;color:rgba(255,255,255,.4);">${completedSubs}/${totalSubs} tareas</div>
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
          <button class="edit-desc-btn" onclick="openDetail('${prod.id}')" title="Editar en panel lateral">✎</button>
        </div>
        <div style="padding:16px 22px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#4A5568;margin-bottom:12px;">Cronograma semanal</div>
          ${renderF1MiniGantt(prod)}
        </div>
        ${IS_EDITOR?`<div style="padding:0 22px 14px;"><button class="add-sub-btn" onclick="addSub('${prod.id}')">+ Agregar subfase</button></div>`:""}
      </div>
    </div>`;
  }).join("");
}

function renderF1MiniGantt(prod){
  const CW=42,LW=260,N=12;
  const bands=[{label:"MAR",s:0,span:3},{label:"ABR",s:3,span:4},{label:"MAY",s:7,span:4},{label:"JUN",s:11,span:1}];
  let html=`<div style="overflow-x:auto;"><table style="border-collapse:collapse;table-layout:fixed;width:${LW+N*CW}px;">
  <colgroup><col style="width:${LW}px;">${Array(N).fill(`<col style="width:${CW}px;">`).join("")}</colgroup>
  <thead>
    <tr style="background:#1A2E1A;">
      <th style="border-right:1px solid rgba(255,255,255,.1);padding:4px 8px;font-size:9px;color:rgba(255,255,255,.4);text-transform:uppercase;font-weight:600;letter-spacing:.08em;">Tarea</th>
      ${bands.map(b=>`<th colspan="${b.span}" style="font-size:9px;font-weight:700;color:#C5E830;text-align:center;padding:4px 0;border-right:1px solid rgba(255,255,255,.1);">${b.label}</th>`).join("")}
    </tr>
    <tr style="background:#3D6B20;">
      <th style="border-right:1px solid rgba(255,255,255,.1);"></th>
      ${SEMANAS_F1.map(w=>`<th style="font-size:8px;color:rgba(255,255,255,.6);text-align:center;padding:3px 0;border-right:1px solid rgba(255,255,255,.06);">${w}</th>`).join("")}
    </tr>
  </thead><tbody>`;

  prod.subproductos.forEach(sub=>{
    const st=getTaskState(sub.id).status;
    const rowBg=sub.es_hito?"#EAF0E3":"#fff";
    const sdotBg=st==="completado"?"#2D5016":st==="en-curso"?"#FFC107":"#CCC";
    html+=`<tr style="background:${rowBg};border-bottom:1px solid #E0E0E0;cursor:pointer;"
      onmouseover="this.style.background='#EAF0E3'" onmouseout="this.style.background='${rowBg}'"
      onclick="openDetail('${sub.id}')">
      <td style="padding:6px 10px 6px 12px;font-size:11px;color:${sub.es_hito?"#2D5016":"#444"};font-weight:${sub.es_hito?600:300};border-right:1px solid #E0E0E0;">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${sdotBg};margin-right:6px;vertical-align:middle;"></span>
        ${sub.es_hito?"✓ ":""}${sub.nombre}
        ${IS_EDITOR&&!sub.es_hito?`<button class="del-sub-btn" onclick="event.stopPropagation();deleteSub('${sub.id}')" title="Eliminar">✕</button>`:""}
      </td>
      ${Array(N).fill("").map((_,i)=>{
        if(i<sub.t_start||i>sub.t_end) return `<td style="border-right:1px solid rgba(224,224,224,.5);height:32px;"></td>`;
        if(sub.es_hito) return `<td style="background:#C5E830;border-right:1px solid rgba(224,224,224,.5);height:32px;text-align:center;vertical-align:middle;"><div style="width:10px;height:10px;background:#2D5016;transform:rotate(45deg);display:inline-block;"></div></td>`;
        const bg=st==="completado"?"#2D5016":st==="en-curso"?"#3D6B20":"#E8ECF2";
        return `<td style="background:${bg};border-right:1px solid rgba(224,224,224,.5);height:32px;"></td>`;
      }).join("")}
    </tr>`;
  });
  html+=`</tbody></table></div>`;
  return html;
}

function toggleF1Product(prodId){
  document.getElementById(`f1body-${prodId}`).classList.toggle("open");
  document.getElementById(`f1toggle-${prodId}`).classList.toggle("open");
}

// ════════════════════════════════════════════════════════
// HITOS
// ════════════════════════════════════════════════════════
function renderHitos(){
  const MESES=["Abril","Mayo","Agosto","Noviembre","Diciembre"];
  document.getElementById("hitoCalendar").innerHTML = MESES.map(mes=>{
    const hitosDelMes=TODOS_LOS_HITOS.filter(h=>h.mes===mes);
    return `<div class="hito-month-block">
      <div class="hito-month-name">${mes.toUpperCase()} 2026</div>
      ${hitosDelMes.length?`<div class="hito-month-items">${hitosDelMes.map(h=>{
        const st=getTaskState(h.taskId).status;
        return `<div class="hito-cal-item" onclick="openDetail('${h.taskId}')">
          <div class="hito-cal-date"><div class="hito-cal-date-week">${h.dia?"SEM.":"MES"}</div><div class="hito-cal-date-day">${h.dia||"—"}</div></div>
          <div class="hito-cal-divider"></div>
          <div class="hito-cal-info"><div class="hito-cal-name">${h.nombre}</div><div class="hito-cal-product">${h.fase} · ${h.producto}</div></div>
          <div class="hito-cal-status"><span class="status-pill ${st}">${statusLabel(st)}</span><span style="font-size:10px;color:#AAA;">${h.fecha}</span></div>
        </div>`;}).join("")}</div>`:`<div class="hito-month-empty">Sin hitos registrados.</div>`}
    </div>`;
  }).join("");
}

// ════════════════════════════════════════════════════════
// DETAIL PANEL — con selectores de semana/mes
// ════════════════════════════════════════════════════════
function initDetailPanel(){
  document.getElementById("detailClose").addEventListener("click",closeDetail);
  document.getElementById("detailOverlay").addEventListener("click",closeDetail);
  document.querySelectorAll(".status-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      if(!IS_EDITOR) return;
      document.querySelectorAll(".status-btn").forEach(b=>b.classList.remove("active","pendiente","en-curso","completado"));
      btn.classList.add("active",btn.dataset.status);
    });
  });
  document.getElementById("detailSave").addEventListener("click",saveDetail);
}

function openDetail(taskId){
  DETAIL_TASK_ID = taskId;
  let nombre=taskId, fase="", meta="", currentDesc="", ts=null, te=null, isF1Sub=false, prodId=null, isLater=false, currentEsHito=false;

  PRODUCTOS_F1.forEach(p=>{
    if(p.id===taskId){ nombre=p.nombre; fase=`Fase 1 · Producto ${p.num}`; meta=p.hito.fecha; currentDesc=getDesc(p.id,p.desc); ts=p.t_start; te=p.t_end; prodId=p.id; }
    p.subproductos.forEach(s=>{
      if(s.id===taskId){ nombre=s.nombre; fase=`Fase 1 · ${p.nombre}`; meta=s.fecha||""; currentDesc=getDesc(s.id,""); ts=s.t_start; te=s.t_end; prodId=p.id; isF1Sub=true; currentEsHito=s.es_hito; }
    });
  });
  [...PRODUCTOS_F2,...PRODUCTOS_F3,...PRODUCTOS_F4].forEach(p=>{
    if(p.id===taskId){ nombre=p.nombre; isLater=true;
      fase=p.id.startsWith("f2")?"Fase 2":p.id.startsWith("f3")?"Fase 3":"Fase 4";
      meta=p.hito?p.hito.fecha:""; currentDesc=getDesc(p.id,""); ts=p.t_start; te=p.t_end; }
  });

  const st=getTaskState(taskId);
  document.getElementById("detailPhaseTag").textContent=fase||"Proyecto 2026";
  document.getElementById("detailTitle").textContent=nombre;
  document.getElementById("detailMeta").textContent=meta;
  document.getElementById("detailNotes").value=st.notas||"";
  document.getElementById("detailNotes").disabled=!IS_EDITOR;
  document.getElementById("detailSave").disabled=!IS_EDITOR;
  const descEl=document.getElementById("detailDescText");
  if(descEl){ descEl.value=currentDesc; descEl.disabled=!IS_EDITOR; }
  document.getElementById("detailDescSection").style.display="block";

  // Hito toggle — only for F1 subproductos
  const hitoSection=document.getElementById("detailHitoSection");
  if(hitoSection){
    if(isF1Sub && IS_EDITOR){
      hitoSection.style.display="block";
      const hitoCheck=document.getElementById("detailEsHito");
      if(hitoCheck) hitoCheck.checked=currentEsHito;
    } else {
      hitoSection.style.display="none";
    }
  }

  document.querySelectorAll(".status-btn").forEach(btn=>{
    btn.classList.remove("active","pendiente","en-curso","completado");
    btn.disabled=!IS_EDITOR;
    if(btn.dataset.status===st.status) btn.classList.add("active",st.status);
  });

  // Range selectors
  const rangeEl=document.getElementById("detailRange");
  if(rangeEl && ts!==null && te!==null){
    const isWeek=!isLater;
    const mkOpts=(sel)=>(isWeek?SEMANAS_F1:MESES_POSTERIORES.map(m=>m.label)).map((w,i)=>`<option value="${i}" ${i===sel?"selected":""}>${isWeek?w:MESES_POSTERIORES[i].label}</option>`).join("");
    rangeEl.innerHTML = IS_EDITOR ? `
      <div class="detail-label">Período</div>
      <div class="range-row">
        <div class="range-field"><label>Inicio</label><select id="rangeStart" class="range-select">${mkOpts(ts)}</select></div>
        <div class="range-arrow">→</div>
        <div class="range-field"><label>Fin</label><select id="rangeEnd" class="range-select">${mkOpts(te)}</select></div>
      </div>` : `<div class="detail-label">Período</div><div class="range-display">${isWeek?SEMANAS_F1[ts]:MESES_POSTERIORES[ts].label} → ${isWeek?SEMANAS_F1[te]:MESES_POSTERIORES[te].label}</div>`;
  } else if(rangeEl){ rangeEl.innerHTML=""; }

  document.getElementById("detailPanel").classList.add("open");
  document.getElementById("detailOverlay").classList.add("open");
}

function closeDetail(){
  document.getElementById("detailPanel").classList.remove("open");
  document.getElementById("detailOverlay").classList.remove("open");
  DETAIL_TASK_ID=null;
}

function saveDetail(){
  if(!DETAIL_TASK_ID||!IS_EDITOR) return;
  const activeBtn=document.querySelector(".status-btn.active");
  const status=activeBtn?activeBtn.dataset.status:"pendiente";
  const notas=document.getElementById("detailNotes").value;
  const descEl=document.getElementById("detailDescText");
  const desc=descEl?descEl.value:undefined;

  // Save hito toggle if visible
  const hitoCheck=document.getElementById("detailEsHito");
  if(hitoCheck && document.getElementById("detailHitoSection").style.display!=="none"){
    const newEsHito=hitoCheck.checked;
    PRODUCTOS_F1.forEach(p=>{
      p.subproductos.forEach(s=>{ if(s.id===DETAIL_TASK_ID) s.es_hito=newEsHito; });
    });
  }

  // Save range
  const rsEl=document.getElementById("rangeStart"), reEl=document.getElementById("rangeEnd");
  if(rsEl&&reEl){
    const newStart=parseInt(rsEl.value), newEnd=parseInt(reEl.value);
    if(newEnd>=newStart) applyRangeChange(DETAIL_TASK_ID,newStart,newEnd);
    else { toast("El fin debe ser posterior al inicio"); return; }
  }

  setTaskState(DETAIL_TASK_ID,status,notas,desc);
  saveToGist();
  closeDetail();
  refreshAll();
  toast("✓ Cambios guardados");
}

function applyRangeChange(id,newStart,newEnd){
  PRODUCTOS_F1.forEach(p=>{
    if(p.id===id){ p.t_start=newStart; p.t_end=newEnd; }
    p.subproductos.forEach(s=>{ if(s.id===id){ s.t_start=newStart; s.t_end=newEnd; } });
  });
  [...PRODUCTOS_F2,...PRODUCTOS_F3,...PRODUCTOS_F4].forEach(p=>{
    if(p.id===id){ p.t_start=newStart; p.t_end=newEnd; }
  });
}

// ════════════════════════════════════════════════════════
// EDITOR TOGGLE
// ════════════════════════════════════════════════════════
function initEditorToggle(){
  document.getElementById("editorToggle").addEventListener("click",()=>{
    if(IS_EDITOR){
      IS_EDITOR=false;
      document.getElementById("editorToggle").textContent="Modo lectura";
      document.getElementById("editorToggle").classList.remove("active");
      toast("Modo lectura activado");
      refreshAll();
    } else {
      const pwd=prompt("Contraseña de editor:");
      if(pwd===STATE.config.editorPassword){
        IS_EDITOR=true;
        document.getElementById("editorToggle").textContent="● Editor";
        document.getElementById("editorToggle").classList.add("active");
        toast("✓ Modo editor activado");
        refreshAll();
      } else if(pwd!==null){ toast("Contraseña incorrecta"); }
    }
  });
}

// ════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════
function initConfig(){
  document.getElementById("gistId").value=STATE.config.gistId||"";
  document.getElementById("gistToken").value=STATE.config.gistToken||"";
  document.getElementById("saveGistConfig").addEventListener("click",()=>{
    STATE.config.gistId=document.getElementById("gistId").value.trim();
    STATE.config.gistToken=document.getElementById("gistToken").value.trim();
    saveConfigLocal(); setStatus("gistStatus","ok","✓ Configuración guardada"); toast("✓ Configuración guardada");
  });
  document.getElementById("testGist").addEventListener("click",async()=>{
    const id=document.getElementById("gistId").value.trim();
    const token=document.getElementById("gistToken").value.trim();
    if(!id){setStatus("gistStatus","err","Ingresá el ID del Gist");return;}
    setStatus("gistStatus","","Probando…");
    try{
      const res=await fetch(`https://api.github.com/gists/${id}`,{headers:token?{Authorization:`token ${token}`}:{}});
      setStatus("gistStatus",res.ok?"ok":"err",res.ok?"✓ Conexión exitosa":"Error: Gist no encontrado o token inválido");
    }catch(e){setStatus("gistStatus","err","Error de red");}
  });
  document.getElementById("unlockBtn").addEventListener("click",()=>{
    const pwd=document.getElementById("editorPassword").value;
    if(pwd===STATE.config.editorPassword){
      IS_EDITOR=true; document.getElementById("editorToggle").textContent="● Editor";
      document.getElementById("editorToggle").classList.add("active");
      setStatus("editorStatus","ok","✓ Modo editor activado"); toast("✓ Modo editor activado"); refreshAll();
    } else { setStatus("editorStatus","err","Contraseña incorrecta"); }
  });
  document.getElementById("exportBtn").addEventListener("click",()=>{
    saveCronogramaToState(STATE);
    const data=JSON.stringify({version:STATE.version,tareas:STATE.tareas,actividad:STATE.actividad,descripciones:STATE.descripciones||{},cronograma:STATE.cronograma},null,2);
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([data],{type:"application/json"}));
    a.download="ia-estado-2026.json"; a.click(); toast("✓ Estado exportado");
  });
  document.getElementById("importFile").addEventListener("change",e=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{ mergeState(JSON.parse(ev.target.result)); saveStateLocal(); refreshAll(); toast("✓ Estado importado"); }
      catch(err){ toast("Error: archivo JSON inválido"); }
    }; reader.readAsText(file);
  });
}

function setStatus(id,cls,msg){ const el=document.getElementById(id); el.className="config-status "+cls; el.textContent=msg; }

// ════════════════════════════════════════════════════════
// REFRESH / TOAST
// ════════════════════════════════════════════════════════
function refreshAll(){ renderDashboard(); renderGantt(); renderFase1(); renderHitos(); }
function toast(msg){ const el=document.getElementById("toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2800); }
