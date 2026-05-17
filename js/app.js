// ══════════════════════════════════════════════════════════════
//  WebHunter CRM Pro — app.js
//  Gmail + Google Calendar integración via Claude MCP
// ══════════════════════════════════════════════════════════════

// ── STATE ─────────────────────────────────────────────────────
let prospects = [];
let templates = [];
let activityLog = [];
let settings = {};
let editingProspectId = null;
let editingTemplateId = null;
let emailTargetId = null;
let notesTargetId = null;
let draggedId = null;
let searchResults  = [];
let searchNextToken = null;
let searchScanned  = 0;

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  setupNav();
  renderAll();
  updateDashDate();
  checkFollowupBadge();
  document.getElementById('search-type')?.addEventListener('keydown', e => { if (e.key === 'Enter') performSearch(); });
  document.getElementById('search-city')?.addEventListener('keydown', e => { if (e.key === 'Enter') performSearch(); });
});

function loadFromStorage() {
  try {
    prospects    = JSON.parse(localStorage.getItem('wh_prospects')   || 'null') || [];
    templates    = JSON.parse(localStorage.getItem('wh_templates')   || 'null') || JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
    activityLog  = JSON.parse(localStorage.getItem('wh_activity')    || 'null') || [];
    settings     = JSON.parse(localStorage.getItem('wh_settings')    || 'null') || {};
    if (!templates.length) templates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
  } catch (_) {
    templates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
  }
  applySettingsToForm();
}

function save() {
  try {
    localStorage.setItem('wh_prospects',  JSON.stringify(prospects));
    localStorage.setItem('wh_templates',  JSON.stringify(templates));
    localStorage.setItem('wh_activity',   JSON.stringify(activityLog.slice(0, 60)));
    localStorage.setItem('wh_settings',   JSON.stringify(settings));
  } catch (_) {}
}

function renderAll() {
  renderMetrics();
  renderKanban();
  renderProspectsList();
  renderFollowups();
  renderTemplatesGrid();
  renderDashFollowups();
  renderActivityFeed();
  renderPipelineMini();
  checkFollowupBadge();
}

// ── NAV ───────────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.sb-link').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
}

function switchView(view) {
  document.querySelectorAll('.sb-link').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  if (view === 'dashboard') { renderDashFollowups(); renderActivityFeed(); renderPipelineMini(); }
  if (view === 'search') checkSearchApiKey();
}

// ── METRICS ───────────────────────────────────────────────────
function renderMetrics() {
  const total       = prospects.length;
  const pending     = prospects.filter(p => p.stage === 'radar' || p.stage === 'contacted').length;
  const closed      = prospects.filter(p => p.stage === 'closed').length;
  const revenue     = prospects.filter(p => p.stage === 'closed').reduce((s, p) => s + (p.value || 0), 0);
  const contacted   = prospects.filter(p => p.stage !== 'radar').length;
  const conversion  = contacted > 0 ? Math.round((closed / contacted) * 100) : 0;
  const today       = todayStr();
  const followupsToday = prospects.filter(p => p.followupDate === today).length;

  setEl('m-total',        total);
  setEl('m-pending',      pending);
  setEl('m-closed',       closed);
  setEl('m-revenue',      revenue.toLocaleString('es-ES') + '€');
  setEl('m-conversion',   conversion + '%');
  setEl('m-followups-due',followupsToday);
}

function checkFollowupBadge() {
  const today   = todayStr();
  const overdue = prospects.filter(p => p.followupDate && p.followupDate <= today && p.stage !== 'closed' && p.stage !== 'lost').length;
  const badge   = document.getElementById('followup-badge');
  if (badge) { badge.textContent = overdue; badge.style.display = overdue > 0 ? '' : 'none'; }
}

// ── DASHBOARD ─────────────────────────────────────────────────
function updateDashDate() {
  const el = document.getElementById('dash-date');
  if (el) el.textContent = new Date().toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

function renderDashFollowups() {
  const el = document.getElementById('dash-followups-list');
  if (!el) return;
  const today = todayStr();
  const due = prospects
    .filter(p => p.followupDate && p.followupDate <= futureDays(7) && p.stage !== 'closed' && p.stage !== 'lost')
    .sort((a, b) => a.followupDate.localeCompare(b.followupDate))
    .slice(0, 5);

  if (!due.length) { el.innerHTML = '<div class="empty-state"><p>No hay seguimientos pendientes 🎉</p></div>'; return; }
  el.innerHTML = due.map(p => {
    const isOverdue = p.followupDate < today;
    const isToday   = p.followupDate === today;
    const color     = isOverdue ? '#DC2626' : isToday ? '#D97706' : '#059669';
    const label     = isOverdue ? 'Vencido' : isToday ? 'Hoy' : fmtDate(p.followupDate);
    return `<div class="followup-item ${isOverdue ? 'overdue' : isToday ? 'today' : 'upcoming'}" style="margin-bottom:6px">
      <div class="fi-date" style="color:${color}">${label}</div>
      <div><div class="fi-name">${p.name}</div><div class="fi-meta">${p.type} · ${p.city}</div></div>
      <div class="fi-actions">
        <button class="kc-btn primary" onclick="openEmailModal('${p.id}')">Email</button>
        <button class="kc-btn" onclick="openNotesModal('${p.id}')">Nota</button>
      </div>
    </div>`;
  }).join('');
}

function renderActivityFeed() {
  const el = document.getElementById('activity-feed');
  if (!el) return;
  const feed = activityLog.length ? activityLog : DEMO_ACTIVITY;
  el.innerHTML = feed.slice(0, 8).map(a => `
    <div class="activity-item">
      <div class="activity-dot" style="background:${a.dot || '#94A3B8'}"></div>
      <div class="activity-text">${a.text}</div>
      <div class="activity-time">${relativeTime(a.time)}</div>
    </div>`).join('');
}

function renderPipelineMini() {
  const el = document.getElementById('dash-pipeline-mini');
  if (!el) return;
  const stages = [
    { key:'radar',       label:'En radar',   color:'#94A3B8' },
    { key:'contacted',   label:'Contactado', color:'#3B82F6' },
    { key:'negotiating', label:'Negociando', color:'#F59E0B' },
    { key:'closed',      label:'Cerrado',    color:'#10B981' },
    { key:'lost',        label:'Perdido',    color:'#EF4444' },
  ];
  const max = Math.max(1, prospects.length);
  el.innerHTML = `<div class="pipeline-mini">${stages.map(s => {
    const count = prospects.filter(p => p.stage === s.key).length;
    const pct   = Math.round((count / max) * 100);
    return `<div class="pipeline-mini-row">
      <span class="pm-label">${s.label}</span>
      <div class="pm-bar-wrap"><div class="pm-bar" style="width:${pct}%;background:${s.color}"></div></div>
      <span class="pm-count">${count}</span>
    </div>`;
  }).join('')}</div>`;
}

// ── KANBAN ────────────────────────────────────────────────────
function renderKanban() {
  ['radar','contacted','negotiating','closed','lost'].forEach(stage => {
    const cards = document.getElementById('kcards-' + stage);
    const count = document.getElementById('kcount-' + stage);
    if (!cards) return;
    const ps = prospects.filter(p => p.stage === stage);
    if (count) count.textContent = ps.length;
    cards.innerHTML = ps.length
      ? ps.map(p => kanbanCard(p)).join('')
      : '<div style="border:1.5px dashed var(--border2);border-radius:8px;height:60px;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--text3)">Arrastra aquí</div>';
  });
}

function kanbanCard(p) {
  const stars     = '★'.repeat(Math.round(p.rating || 0)) + '☆'.repeat(5 - Math.round(p.rating || 0));
  const isOverdue = p.followupDate && p.followupDate < todayStr();
  return `<div class="kanban-card" draggable="true" ondragstart="dragStart(event,'${p.id}')" ondragend="dragEnd(event)">
    <div class="kc-name">${p.name}</div>
    <div class="kc-meta">${p.type} · ${p.city}${p.value ? ' · ' + p.value + '€' : ''}</div>
    <div class="kc-meta">${stars} ${(p.rating||0).toFixed(1)}</div>
    ${p.followupDate ? `<div class="kc-meta" style="color:${isOverdue ? '#DC2626':'#D97706'}">
      ${isOverdue ? '⚠ Vencido: ':'📅 '}${fmtDate(p.followupDate)}</div>` : ''}
    <div class="kc-actions">
      <button class="kc-btn primary" onclick="openEmailModal('${p.id}')">Email</button>
      <button class="kc-btn" onclick="openNotesModal('${p.id}')">Notas</button>
      <button class="kc-btn" onclick="openCopilotModal('${p.id}')" title="Qué hacer con este prospecto">¿Qué hago?</button>
      <button class="kc-btn" onclick="editProspect('${p.id}')">✏</button>
      <button class="kc-btn" style="margin-left:auto;color:#DC2626" onclick="deleteProspect('${p.id}')">✕</button>
    </div>
  </div>`;
}

function dragStart(e, id) { draggedId = id; e.target.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; }
function dragEnd(e)        { e.target.classList.remove('dragging'); draggedId = null; }

function dropCard(e, stage) {
  e.preventDefault();
  if (!draggedId) return;
  const p = prospects.find(x => x.id === draggedId);
  if (p && p.stage !== stage) {
    p.stage = stage; p.lastActivity = todayStr();
    addActivity(`<strong>${p.name}</strong> movido a <strong>${stageLabel(stage)}</strong>`, stage === 'closed' ? '#059669' : stage === 'lost' ? '#DC2626' : '#3B82F6');
    save(); renderAll();
    showToast(`${p.name} → ${stageLabel(stage)}`);
  }
}

// ── PROSPECTS LIST ────────────────────────────────────────────
function renderProspectsList(filtered) {
  const list   = filtered || prospects;
  const tbody  = document.getElementById('prospects-tbody');
  const countEl = document.getElementById('prospects-count');
  if (countEl) countEl.textContent = `${list.length} prospecto${list.length !== 1 ? 's' : ''}`;
  if (!tbody) return;
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><p>No hay prospectos. Añade el primero.</p></div></td></tr>`; return; }
  const today = todayStr();
  tbody.innerHTML = list.map(p => {
    const stars     = '★'.repeat(Math.round(p.rating || 0));
    const isOverdue = p.followupDate && p.followupDate < today && p.stage !== 'closed' && p.stage !== 'lost';
    return `<tr>
      <td><div style="font-weight:600;font-size:13px">${p.name}</div><div style="font-size:11px;color:var(--text2)">${p.type}</div></td>
      <td>${p.city||'—'}</td>
      <td><span class="tag" style="background:var(--surface2);color:var(--text2)">${p.type}</span></td>
      <td>${p.phone||'<span style="color:var(--text3)">—</span>'}</td>
      <td style="font-size:12px">${p.email||'<span style="color:var(--text3)">—</span>'}</td>
      <td><span class="stars">${stars}</span> <span style="font-size:12px">${(p.rating||0).toFixed(1)}</span></td>
      <td><span class="tag tag-${p.stage}">${stageLabel(p.stage)}</span></td>
      <td style="font-size:12px;color:${isOverdue ? '#DC2626':'inherit'}">${p.followupDate ? fmtDate(p.followupDate) : '—'}</td>
      <td><div style="display:flex;gap:4px">
        <button class="kc-btn primary" onclick="openEmailModal('${p.id}')">Email</button>
        <button class="kc-btn" onclick="openNotesModal('${p.id}')">Notas (${(p.notes||[]).length})</button>
        <button class="kc-btn" onclick="editProspect('${p.id}')">✏</button>
        <button class="kc-btn" style="color:#DC2626" onclick="deleteProspect('${p.id}')">✕</button>
      </div></td>
    </tr>`;
  }).join('');
}

function filterProspects() {
  const q     = (document.getElementById('prospect-search')?.value || '').toLowerCase();
  const stage = document.getElementById('prospect-stage-filter')?.value || '';
  renderProspectsList(prospects.filter(p => {
    const matchQ = !q || [p.name,p.city,p.type,p.phone,p.email].join(' ').toLowerCase().includes(q);
    return matchQ && (!stage || p.stage === stage);
  }));
}

// ── FOLLOWUPS ─────────────────────────────────────────────────
function renderFollowups() {
  const el = document.getElementById('followup-sections');
  if (!el) return;
  const today    = todayStr();
  const overdue  = prospects.filter(p => p.followupDate && p.followupDate < today && p.stage !== 'closed' && p.stage !== 'lost').sort((a,b) => a.followupDate.localeCompare(b.followupDate));
  const todayList = prospects.filter(p => p.followupDate === today && p.stage !== 'closed' && p.stage !== 'lost');
  const upcoming = prospects.filter(p => p.followupDate && p.followupDate > today && p.stage !== 'closed' && p.stage !== 'lost').sort((a,b) => a.followupDate.localeCompare(b.followupDate)).slice(0,20);

  const renderSec = (title, list, cls) => !list.length ? '' : `
    <div class="followup-section">
      <h3>${title} (${list.length})</h3>
      <div class="followup-list">${list.map(p => `
        <div class="followup-item ${cls}">
          <div class="fi-date">${fmtDate(p.followupDate)}</div>
          <div style="flex:1">
            <div class="fi-name">${p.name}</div>
            <div class="fi-meta">${p.type} · ${p.city} · <span class="tag tag-${p.stage}">${stageLabel(p.stage)}</span></div>
            ${p.notes?.length ? `<div style="font-size:11px;color:var(--text3);margin-top:3px">${p.notes[p.notes.length-1].text.substring(0,80)}…</div>` : ''}
          </div>
          <div class="fi-actions">
            <button class="kc-btn primary" onclick="openEmailModal('${p.id}')">Email</button>
            <button class="kc-btn" onclick="openNotesModal('${p.id}')">+ Nota</button>
            <button class="kc-btn" onclick="openCopilotModal('${p.id}')">¿Qué hago?</button>
            <button class="kc-btn" onclick="snoozeFollowup('${p.id}')">+7 días</button>
          </div>
        </div>`).join('')}
      </div>
    </div>`;

  const html = renderSec('⚠ Vencidos', overdue, 'overdue') + renderSec('📅 Hoy', todayList, 'today') + renderSec('🔜 Próximos', upcoming, 'upcoming');
  el.innerHTML = html || '<div class="empty-state" style="padding:4rem"><p>No hay seguimientos pendientes 🎉</p></div>';
}

function snoozeFollowup(id) {
  const p = prospects.find(x => x.id === id);
  if (!p) return;
  const d = new Date((p.followupDate || todayStr()) + 'T00:00:00');
  d.setDate(d.getDate() + 7);
  p.followupDate = d.toISOString().split('T')[0];
  save(); renderAll();
  showToast('Seguimiento aplazado 7 días');
}

// ── PROSPECT MODAL ────────────────────────────────────────────
function openAddModal() {
  editingProspectId = null;
  delete document.getElementById('modal-prospect').dataset.placeId;
  document.getElementById('prospect-modal-title').textContent = 'Nuevo prospecto';
  ['p-name','p-type','p-city','p-address','p-phone','p-email','p-notes'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  ['p-rating','p-reviews','p-value'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('p-stage').value   = 'radar';
  document.getElementById('p-followup').value = futureDays(7);
  document.getElementById('modal-prospect').classList.remove('hidden');
}

function editProspect(id) {
  const p = prospects.find(x => x.id === id);
  if (!p) return;
  editingProspectId = id;
  document.getElementById('prospect-modal-title').textContent = 'Editar: ' + p.name;
  setVal('p-name', p.name); setVal('p-type', p.type); setVal('p-city', p.city);
  setVal('p-address', p.address); setVal('p-phone', p.phone); setVal('p-email', p.email);
  setVal('p-rating', p.rating||''); setVal('p-reviews', p.reviews||'');
  setVal('p-stage', p.stage); setVal('p-value', p.value||'');
  setVal('p-followup', p.followupDate || futureDays(7)); setVal('p-notes','');
  document.getElementById('modal-prospect').classList.remove('hidden');
}

function saveProspect() {
  const name = getVal('p-name').trim();
  if (!name) { showToast('El nombre es obligatorio'); return; }
  const data = getProspectFormData();
  const placeId = document.getElementById('modal-prospect').dataset.placeId;
  if (placeId) { data.placeId = placeId; delete document.getElementById('modal-prospect').dataset.placeId; }
  if (editingProspectId) {
    const p = prospects.find(x => x.id === editingProspectId);
    if (p) { Object.assign(p, data); p.lastActivity = todayStr(); addActivity(`<strong>${p.name}</strong> actualizado`, '#D97706'); }
  } else {
    const newP = { id:genId(), createdAt:todayStr(), lastActivity:todayStr(), notes:[], ...data };
    prospects.unshift(newP);
    addActivity(`Nuevo prospecto: <strong>${newP.name}</strong>`, '#7C3AED');
  }
  save(); renderAll(); closeProspectModal();
  showToast(editingProspectId ? 'Prospecto actualizado' : 'Prospecto añadido ✓');
  if (placeId) renderSearchResults();
}

function getProspectFormData() {
  return {
    name:         getVal('p-name'),
    type:         getVal('p-type'),
    city:         getVal('p-city'),
    address:      getVal('p-address'),
    phone:        getVal('p-phone'),
    email:        getVal('p-email'),
    rating:       parseFloat(getVal('p-rating')) || 0,
    reviews:      parseInt(getVal('p-reviews'))  || 0,
    stage:        getVal('p-stage'),
    value:        parseInt(getVal('p-value'))    || parseInt(settings.price) || 299,
    followupDate: getVal('p-followup') || null,
  };
}

function closeProspectModal() { document.getElementById('modal-prospect').classList.add('hidden'); editingProspectId = null; }

function deleteProspect(id) {
  const p = prospects.find(x => x.id === id);
  if (!p || !confirm(`¿Eliminar "${p.name}"?`)) return;
  prospects = prospects.filter(x => x.id !== id);
  save(); renderAll();
  showToast('Prospecto eliminado');
}

// ── AI ENRICH ─────────────────────────────────────────────────
async function enrichWithAI() {
  const name = getVal('p-name').trim();
  if (!name) { showToast('Introduce el nombre primero'); return; }
  if (!settings.anthropicKey) { showToast('Añade tu API key de Anthropic en Ajustes'); return; }
  const btn = document.getElementById('btn-enrich');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-dark"></span> Analizando…';

  try {
    const prompt = `Eres un experto en ventas de servicios web a negocios locales. Analiza este prospecto y genera datos útiles.

Negocio: "${name}", Tipo: "${getVal('p-type')||'local'}", Ciudad: "${getVal('p-city')||'España'}"

Responde SOLO JSON, sin texto extra:
{"pain_points":["...","...","..."],"opportunity":"...","suggested_features":["...","...","..."],"estimated_value":499,"first_message_hook":"...","objections":["...","..."],"best_contact_time":"..."}`;

    const res  = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': settings.anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:800, messages:[{ role:'user', content:prompt }] })
    });
    const data = await res.json();
    const text = data.content?.find(c => c.type==='text')?.text || '';
    const info = JSON.parse(text.replace(/```json|```/g,'').trim());

    if (info.estimated_value && !getVal('p-value')) setVal('p-value', info.estimated_value);
    document.getElementById('p-notes').value =
      `[IA] ${info.opportunity}\n\nGancho: ${info.first_message_hook}\n\nFuncionalidades sugeridas: ${info.suggested_features?.join(', ')}\n\nObjeciones esperadas: ${info.objections?.join(' / ')}\n\nMejor momento: ${info.best_contact_time}`;
    showToast('Enriquecido con IA ✓');
  } catch (e) {
    showToast('Error al conectar con IA');
  }
  btn.disabled = false;
  btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Enriquecer con IA';
}

// ══════════════════════════════════════════════════════════════
//  EMAIL MODAL — crea borrador real en Gmail via Claude API MCP
// ══════════════════════════════════════════════════════════════
function openEmailModal(id) {
  emailTargetId = id;
  const p = prospects.find(x => x.id === id);
  if (!p) return;
  document.getElementById('email-modal-title').textContent = 'Email a ' + p.name;
  document.getElementById('e-to').value = p.email || '';

  const sel = document.getElementById('e-template-select');
  sel.innerHTML = '<option value="">— Seleccionar plantilla —</option>' +
    templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

  if (templates.length) { sel.value = templates[0].id; applyTemplate(); }
  document.getElementById('btn-send-wapp').style.display = p.phone ? 'inline-flex' : 'none';
  document.getElementById('modal-email').classList.remove('hidden');
}

function applyTemplate() {
  const id  = document.getElementById('e-template-select').value;
  const p   = prospects.find(x => x.id === emailTargetId);
  if (!id || !p) return;
  const tpl = templates.find(t => t.id === id);
  if (!tpl) return;
  document.getElementById('e-subject').value = fillTemplate(tpl.subject, p);
  document.getElementById('e-body').value    = fillTemplate(tpl.body, p);
}

function fillTemplate(text, p) {
  const price = settings.price || 299;
  return (text||'')
    .replace(/{nombre}/g,    p.name)
    .replace(/{tipo}/g,      p.type    || '')
    .replace(/{ciudad}/g,    p.city    || '')
    .replace(/{valoracion}/g,(p.rating ||0).toFixed(1))
    .replace(/{resenas}/g,   p.reviews || 0)
    .replace(/{agencia}/g,   settings.agency || 'nuestra agencia')
    .replace(/{precio}/g,    price)
    .replace(/{precio_desc}/g, Math.round(price * 0.8));
}

// ── Envío real via Claude API → Gmail MCP ─────────────────────
async function sendEmail() {
  const to      = document.getElementById('e-to').value.trim();
  const subject = document.getElementById('e-subject').value.trim();
  const body    = document.getElementById('e-body').value.trim();

  if (!subject || !body) { showToast('Asunto y cuerpo son obligatorios'); return; }

  const btn = document.querySelector('#modal-email .btn-primary');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creando borrador…';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': settings.anthropicKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'mcp-client-2025-04-04' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        tools: [],
        mcp_servers: [
          { type: 'url', url: 'https://gmail.mcp.claude.com/mcp', name: 'gmail-mcp' }
        ],
        messages: [{
          role: 'user',
          content: `Crea un borrador de email en Gmail usando la herramienta gmail_create_draft con estos datos exactos:
- to: "${to || ''}"
- subject: "${subject}"
- body: "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"
- contentType: "text/plain"

Después de crearlo, responde SOLO con este JSON:
{"ok": true, "draftId": "<el id del borrador>", "message": "Borrador creado correctamente"}`
        }]
      })
    });

    const data     = await response.json();
    const textBlock = data.content?.find(c => c.type === 'text');
    let   success  = false;

    if (textBlock) {
      try {
        const parsed = JSON.parse(textBlock.text.replace(/```json|```/g,'').trim());
        if (parsed.ok) success = true;
      } catch (_) {
        // if text contains confirmation keywords, treat as success
        success = textBlock.text.toLowerCase().includes('borrador') || textBlock.text.toLowerCase().includes('draft');
      }
    }

    // also check for mcp_tool_result blocks
    const toolResults = data.content?.filter(c => c.type === 'mcp_tool_result') || [];
    if (toolResults.length > 0) success = true;

    if (success) {
      const p = prospects.find(x => x.id === emailTargetId);
      if (p) {
        if (p.stage === 'radar') p.stage = 'contacted';
        p.lastActivity = todayStr();
        addActivity(`📧 Borrador Gmail creado para <strong>${p.name}</strong>`, '#2563EB');
        save(); renderAll();
      }
      closeEmailModal();
      showToast('✅ Borrador creado en tu Gmail — revisa Borradores');
    } else {
      // Fallback to mailto if MCP fails
      fallbackMailto(to, subject, body);
    }
  } catch (err) {
    console.error('Gmail MCP error:', err);
    fallbackMailto(to, subject, body);
  }

  btn.disabled = false;
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Enviar email';
}

function fallbackMailto(to, subject, body) {
  window.open(`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  showToast('Abierto en cliente de email (mailto)');
  closeEmailModal();
}

function sendWhatsApp() {
  const p = prospects.find(x => x.id === emailTargetId);
  if (!p || !p.phone) return;
  const body = document.getElementById('e-body').value;
  const num  = p.phone.replace(/\s+/g,'').replace('+','');
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(body)}`, '_blank');
  addActivity(`💬 WhatsApp enviado a <strong>${p.name}</strong>`, '#25D366');
  save(); renderActivityFeed();
}

function closeEmailModal() { document.getElementById('modal-email').classList.add('hidden'); emailTargetId = null; }

// ── Agente Redactor — genera email personalizado con IA ────────
async function generateEmailWithAI() {
  const p = prospects.find(x => x.id === emailTargetId);
  if (!p) return;
  if (!settings.anthropicKey) { showToast('Añade tu API key de Anthropic en Ajustes'); return; }

  const btn = document.getElementById('btn-ai-generate');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-dark"></span> Generando…';

  const currentBody  = document.getElementById('e-body').value.trim();
  const tplContext   = currentBody ? `\n\nReferencia de tono y estructura:\n${currentBody}` : '';
  const notesContext = p.notes?.length
    ? `\n\nHistorial de contacto previo:\n${p.notes.slice(-3).map(n => n.text).join('\n')}`
    : '';

  const prompt = `Eres un experto en ventas de servicios web a pequeños negocios locales en España.
Escribe un email de primer contacto para vender una página web profesional a este negocio.

Datos del negocio:
- Nombre: ${p.name}
- Tipo: ${p.type || 'negocio local'}
- Ciudad: ${p.city || 'España'}
- Valoración Google: ${p.rating ? p.rating.toFixed(1) + '/5 (' + (p.reviews||0) + ' reseñas)' : 'sin datos'}
- No tiene página web${tplContext}${notesContext}

Reglas:
- Sona personal y humano, NO spam masivo
- Menciona algo concreto del negocio (su tipo, ciudad, reseñas si las hay)
- Cuerpo máximo 130 palabras
- CTA claro al final (responder al email o llamar)
- Firma de: ${settings.agency || 'nuestra agencia'}${settings.phone ? ' · ' + settings.phone : ''}

Responde SOLO con JSON (sin markdown):
{"subject": "...", "body": "..."}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': settings.anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 600, messages: [{ role: 'user', content: prompt }] })
    });
    const data   = await res.json();
    const text   = data.content?.find(c => c.type === 'text')?.text || '';
    const result = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (result.subject) document.getElementById('e-subject').value = result.subject;
    if (result.body)    document.getElementById('e-body').value    = result.body;
    showToast('Email generado con IA ✓');
  } catch (e) {
    showToast('Error al generar con IA — revisa tu API key');
  }

  btn.disabled = false;
  btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Generar con IA';
}

// ══════════════════════════════════════════════════════════════
//  NOTES MODAL + Google Calendar sync
// ══════════════════════════════════════════════════════════════
function openNotesModal(id) {
  notesTargetId = id;
  const p = prospects.find(x => x.id === id);
  if (!p) return;
  document.getElementById('notes-modal-title').textContent = 'Notas — ' + p.name;
  document.getElementById('new-note-text').value     = '';
  document.getElementById('new-followup-date').value = futureDays(7);
  renderNotesLog(p);
  document.getElementById('modal-notes').classList.remove('hidden');
}

function renderNotesLog(p) {
  const el = document.getElementById('notes-log');
  if (!p.notes?.length) { el.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--text3);font-size:13px">Sin notas todavía</div>'; return; }
  el.innerHTML = p.notes.slice().reverse().map(n => `
    <div class="note-item">
      <div class="note-date">${fmtDate(n.date)}</div>
      <div class="note-text">${n.text}</div>
    </div>`).join('');
}

async function saveNote() {
  const text     = document.getElementById('new-note-text').value.trim();
  if (!text) { showToast('Escribe una nota'); return; }
  const p        = prospects.find(x => x.id === notesTargetId);
  if (!p) return;
  if (!p.notes) p.notes = [];
  p.notes.push({ date: todayStr(), text });

  const followupDate = document.getElementById('new-followup-date').value;
  const hadFollowup  = p.followupDate;
  if (followupDate) p.followupDate = followupDate;
  p.lastActivity = todayStr();

  addActivity(`📝 Nota añadida en <strong>${p.name}</strong>`, '#D97706');
  save(); renderAll(); renderNotesLog(p);
  document.getElementById('new-note-text').value = '';
  showToast('Nota guardada ✓');

  // Sync seguimiento a Google Calendar si hay fecha nueva
  if (followupDate && followupDate !== hadFollowup) {
    syncFollowupToCalendar(p, followupDate);
  }
}

// ── Sync seguimiento → Google Calendar via Claude MCP ─────────
async function syncFollowupToCalendar(p, dateStr) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': settings.anthropicKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'mcp-client-2025-04-04' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        mcp_servers: [
          { type: 'url', url: 'https://gcal.mcp.claude.com/mcp', name: 'gcal-mcp' }
        ],
        messages: [{
          role: 'user',
          content: `Crea un evento en Google Calendar (calendarId: "primary") con estos datos:
- summary: "📞 Seguimiento: ${p.name}"
- description: "Seguimiento WebHunter CRM\\nNegocio: ${p.name}\\nTipo: ${p.type}\\nCiudad: ${p.city}\\nEtapa: ${stageLabel(p.stage)}\\nTeléfono: ${p.phone||'—'}\\nEmail: ${p.email||'—'}"
- start: { date: "${dateStr}" }
- end: { date: "${dateStr}" }
- colorId: "5"
- reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 540 }] }

Responde solo "ok" cuando lo hayas creado.`
        }]
      })
    });

    const data = await response.json();
    const hasResult = data.content?.some(c => c.type === 'mcp_tool_result' || (c.type === 'text' && c.text.toLowerCase().includes('ok')));
    if (hasResult) {
      showToast(`📅 Seguimiento sincronizado con Google Calendar`);
      addActivity(`📅 Seguimiento de <strong>${p.name}</strong> añadido al calendario (${fmtDate(dateStr)})`, '#059669');
      save(); renderActivityFeed();
    }
  } catch (e) {
    // Calendar sync is non-critical — fail silently
    console.warn('Calendar sync failed:', e);
  }
}

function closeNotesModal() { document.getElementById('modal-notes').classList.add('hidden'); notesTargetId = null; }

// ── TEMPLATES ─────────────────────────────────────────────────
function renderTemplatesGrid() {
  const el = document.getElementById('templates-grid');
  if (!el) return;
  if (!templates.length) { el.innerHTML = '<div class="empty-state"><p>No hay plantillas.</p></div>'; return; }
  el.innerHTML = templates.map(t => `
    <div class="template-card">
      <div class="tc-name">${t.name}</div>
      <div class="tc-subject">${t.subject}</div>
      <div class="tc-preview">${t.body}</div>
      <div class="tc-actions">
        <button class="btn-outline" style="font-size:11px;padding:4px 10px" onclick="editTemplate('${t.id}')">Editar</button>
        <button class="btn-outline" style="font-size:11px;padding:4px 10px;color:var(--red);border-color:#FCA5A5" onclick="deleteTemplate('${t.id}')">Eliminar</button>
      </div>
    </div>`).join('');
}

function openNewTemplate() {
  editingTemplateId = null;
  document.getElementById('tpl-modal-title').textContent = 'Nueva plantilla';
  setVal('tpl-name',''); setVal('tpl-subject','Propuesta web para {nombre}');
  setVal('tpl-body','Estimado/a propietario/a de {nombre},\n\n');
  document.getElementById('modal-template').classList.remove('hidden');
}

function editTemplate(id) {
  const t = templates.find(x => x.id === id);
  if (!t) return;
  editingTemplateId = id;
  document.getElementById('tpl-modal-title').textContent = 'Editar: ' + t.name;
  setVal('tpl-name', t.name); setVal('tpl-subject', t.subject); setVal('tpl-body', t.body);
  document.getElementById('modal-template').classList.remove('hidden');
}

function saveTemplate() {
  const name = getVal('tpl-name').trim();
  if (!name) { showToast('El nombre es obligatorio'); return; }
  if (editingTemplateId) {
    const t = templates.find(x => x.id === editingTemplateId);
    if (t) { t.name = name; t.subject = getVal('tpl-subject'); t.body = getVal('tpl-body'); }
  } else {
    templates.push({ id:genId(), name, subject:getVal('tpl-subject'), body:getVal('tpl-body') });
  }
  save(); renderTemplatesGrid(); closeTemplateModal();
  showToast('Plantilla guardada ✓');
}

function deleteTemplate(id) {
  if (!confirm('¿Eliminar esta plantilla?')) return;
  templates = templates.filter(x => x.id !== id);
  save(); renderTemplatesGrid();
  showToast('Plantilla eliminada');
}

function closeTemplateModal() { document.getElementById('modal-template').classList.add('hidden'); editingTemplateId = null; }

// ── SETTINGS ──────────────────────────────────────────────────
function applySettingsToForm() {
  setVal('cfg-agency',    settings.agency    || '');
  setVal('cfg-email',     settings.email     || '');
  setVal('cfg-phone',     settings.phone     || '');
  setVal('cfg-web',       settings.web       || '');
  setVal('cfg-price',     settings.price     || 299);
  setVal('cfg-maps-key',  settings.mapsKey   || '');
  setVal('cfg-anthropic-key', settings.anthropicKey || '');
  setVal('cfg-gmail-client', settings.gmailClient || '');
  setVal('cfg-email-mode',   settings.emailMode   || 'gmail-mcp');
}

function saveSettings() {
  settings = {
    agency:        getVal('cfg-agency'),
    email:         getVal('cfg-email'),
    phone:         getVal('cfg-phone'),
    web:           getVal('cfg-web'),
    price:         parseInt(getVal('cfg-price')) || 299,
    mapsKey:       getVal('cfg-maps-key'),
    anthropicKey:  getVal('cfg-anthropic-key'),
    gmailClient:   getVal('cfg-gmail-client'),
    emailMode:     getVal('cfg-email-mode'),
  };
  save();
  showToast('Ajustes guardados ✓');
}

// ── DATA MANAGEMENT ───────────────────────────────────────────
function loadDemoData() {
  if (prospects.length && !confirm('¿Añadir datos de demo a la lista actual?')) return;
  const demo = JSON.parse(JSON.stringify(DEMO_PROSPECTS)).map(p => ({ ...p, id: genId() }));
  prospects = [...demo, ...prospects];
  activityLog = [...DEMO_ACTIVITY, ...activityLog];
  save(); renderAll();
  showToast('Datos demo cargados ✓');
}

function exportCSV() {
  if (!prospects.length) { showToast('No hay prospectos'); return; }
  const header = ['Nombre','Tipo','Ciudad','Dirección','Teléfono','Email','Valoración','Reseñas','Etapa','Valor €','Seguimiento','Creado'];
  const rows   = prospects.map(p => [
    `"${p.name}"`, p.type, p.city, `"${p.address||''}"`, p.phone||'', p.email||'',
    (p.rating||0).toFixed(1), p.reviews||0, stageLabel(p.stage), p.value||'', p.followupDate||'', p.createdAt||''
  ].join(','));
  const blob = new Blob(['\uFEFF' + [header.join(','), ...rows].join('\n')], { type:'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href=url; a.download='webhunter_crm.csv'; a.click();
  URL.revokeObjectURL(url);
  showToast(`${prospects.length} prospectos exportados`);
}

function exportJSON() {
  const data = { prospects, templates, settings, activityLog, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href=url; a.download='webhunter_backup.json'; a.click();
  URL.revokeObjectURL(url);
  showToast('Backup exportado ✓');
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.prospects)   prospects   = data.prospects;
      if (data.templates)   templates   = data.templates;
      if (data.settings)  { settings    = data.settings; applySettingsToForm(); }
      if (data.activityLog) activityLog = data.activityLog;
      save(); renderAll();
      showToast('Datos importados ✓');
    } catch (_) { showToast('Error: JSON no válido'); }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (!confirm('¿Borrar TODOS los datos?')) return;
  prospects = []; templates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
  activityLog = []; settings = {};
  localStorage.clear(); save(); renderAll(); applySettingsToForm();
  showToast('Datos borrados');
}

// ══════════════════════════════════════════════════════════════
//  BUSCAR LOCALES — Google Places API (New)
// ══════════════════════════════════════════════════════════════
function checkSearchApiKey() {
  const el = document.getElementById('search-no-key');
  if (el) el.classList.toggle('hidden', !!settings.mapsKey);
}

async function performSearch(loadMore = false) {
  const type = getVal('search-type').trim();
  const city = getVal('search-city').trim();
  if (!type || !city) { showToast('Introduce tipo de negocio y ciudad'); return; }
  if (!settings.mapsKey) { checkSearchApiKey(); return; }

  if (!loadMore) {
    searchResults  = [];
    searchNextToken = null;
    searchScanned  = 0;
    document.getElementById('search-stats').classList.add('hidden');
    document.getElementById('search-results').innerHTML = '';
  }

  const btn         = document.getElementById('btn-search');
  const loadMoreBtn = document.getElementById('btn-load-more');
  const activeBtn   = loadMore ? loadMoreBtn : btn;
  if (activeBtn) { activeBtn.disabled = true; activeBtn.innerHTML = '<span class="spinner"></span> Buscando…'; }

  try {
    const body = { textQuery: `${type} en ${city}`, languageCode: 'es', maxResultCount: 20 };
    if (loadMore && searchNextToken) body.pageToken = searchNextToken;

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-Goog-Api-Key':  settings.mapsKey,
        'X-Goog-FieldMask': 'nextPageToken,places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.websiteUri,places.internationalPhoneNumber,places.primaryTypeDisplayName,places.googleMapsUri'
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (data.error) {
      showToast('Error Google Places: ' + (data.error.message || data.error.status || 'revisa tu API key'));
      return;
    }

    const places = data.places || [];
    searchNextToken = data.nextPageToken || null;
    searchScanned  += places.length;
    const noWeb     = places.filter(p => !p.websiteUri);
    searchResults   = loadMore ? [...searchResults, ...noWeb] : noWeb;

    renderSearchResults();
    document.getElementById('search-stats').classList.remove('hidden');

    if (!places.length && !loadMore) showToast('Sin resultados para esa búsqueda');
  } catch (err) {
    showToast('Error de conexión con Google Places');
    console.error(err);
  }

  if (btn)         { btn.disabled = false;         btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Buscar'; }
  if (loadMoreBtn) { loadMoreBtn.disabled = false;  loadMoreBtn.innerHTML = 'Cargar más resultados →'; }
}

function renderSearchResults() {
  const el          = document.getElementById('search-results');
  const statsText   = document.getElementById('search-stats-text');
  const loadMoreBtn = document.getElementById('btn-load-more');
  if (!el) return;

  const noWebCount = searchResults.length;
  if (statsText) {
    statsText.innerHTML = `<strong>${searchScanned}</strong> negocios analizados · <strong style="color:var(--red)">${noWebCount}</strong> sin página web`;
  }
  if (loadMoreBtn) loadMoreBtn.style.display = searchNextToken ? 'inline-flex' : 'none';

  if (!noWebCount) {
    el.innerHTML = '<div class="empty-state" style="padding:3rem"><p>No se encontraron negocios sin web. Prueba con otro tipo o ciudad.</p></div>';
    return;
  }

  const addedIds = new Set(prospects.filter(p => p.placeId).map(p => p.placeId));

  const sorted = [...searchResults].sort((a, b) => scorePlace(b) - scorePlace(a));

  el.innerHTML = `<div class="search-results-grid">${sorted.map((place, idx) => {
    const isAdded  = addedIds.has(place.id);
    const name     = place.displayName?.text || '—';
    const type     = place.primaryTypeDisplayName?.text || '';
    const address  = place.formattedAddress || '';
    const phone    = place.internationalPhoneNumber || '';
    const rating   = place.rating;
    const reviews  = place.userRatingCount || 0;
    const mapsUrl  = place.googleMapsUri || '';
    const stars    = rating ? '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating)) : '';
    const score    = scorePlace(place);
    const scoreClr = score >= 8 ? '#059669' : score >= 5 ? '#D97706' : '#94A3B8';
    const realIdx  = searchResults.indexOf(place);

    return `<div class="search-card${isAdded ? ' search-card-added' : ''}">
      <div class="sc-header">
        <div class="sc-name">${name}</div>
        <div style="display:flex;gap:5px;align-items:center">
          <span style="font-size:11px;font-weight:700;color:${scoreClr};background:${scoreClr}18;padding:2px 7px;border-radius:20px">${score}/10</span>
          <span class="${isAdded ? 'sc-added-badge' : 'sc-noweb-badge'}">${isAdded ? 'Añadido ✓' : 'Sin web'}</span>
        </div>
      </div>
      ${type    ? `<div class="sc-type">${type}</div>` : ''}
      ${address ? `<div class="sc-meta">📍 ${address}</div>` : ''}
      ${phone   ? `<div class="sc-meta">📞 ${phone}</div>` : ''}
      ${rating  ? `<div class="sc-rating"><span class="stars">${stars}</span> <strong>${rating.toFixed(1)}</strong> <span style="color:var(--text3)">(${reviews} reseñas)</span></div>` : ''}
      <div class="sc-actions">
        ${isAdded
          ? `<button class="btn-outline" disabled style="opacity:.5;flex:1">Ya añadido</button>`
          : `<button class="btn-primary" style="flex:1" onclick="addFromSearch(${realIdx})">+ Añadir prospecto</button>`
        }
        ${mapsUrl ? `<a class="btn-outline" href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="flex-shrink:0">Maps ↗</a>` : ''}
      </div>
    </div>`;
  }).join('')}</div>`;

}

function addFromSearch(idx) {
  const place = searchResults[idx];
  if (!place) return;
  openAddModal();
  setVal('p-name',    place.displayName?.text || '');
  setVal('p-type',    place.primaryTypeDisplayName?.text || '');
  setVal('p-city',    getVal('search-city'));
  setVal('p-address', place.formattedAddress || '');
  setVal('p-phone',   place.internationalPhoneNumber || '');
  setVal('p-rating',  place.rating ? place.rating.toFixed(1) : '');
  setVal('p-reviews', place.userRatingCount || '');
  document.getElementById('modal-prospect').dataset.placeId = place.id;
}

// ── ACTIVITY ──────────────────────────────────────────────────
function addActivity(text, dot = '#94A3B8') {
  activityLog.unshift({ text, time: todayStr(), dot });
  if (activityLog.length > 60) activityLog.pop();
}

// ── UTILS ─────────────────────────────────────────────────────
const setEl  = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
const getVal = (id)       => document.getElementById(id)?.value || '';

const stageLabel = s => ({ radar:'En radar', contacted:'Contactado', negotiating:'Negociando', closed:'Cerrado ✓', lost:'Perdido' }[s] || s);

function fmtDate(str) {
  if (!str) return '—';
  try { return new Date(str + 'T00:00:00').toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' }); }
  catch { return str; }
}

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr + 'T00:00:00')) / 86400000);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'ayer';
  if (diff < 7)   return `hace ${diff} días`;
  return fmtDate(dateStr);
}


// ── TOAST ─────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.add('hidden'), 3000);
}

// ── CALIFICADOR DE PROSPECTOS ─────────────────────────────────
function scorePlace(place) {
  let s = 4;
  const rating  = place.rating || 0;
  const reviews = place.userRatingCount || 0;
  if (rating >= 4.5)             s += 2;
  else if (rating >= 4.0)        s += 1;
  else if (rating > 0 && rating < 3.5) s -= 1;
  if (reviews >= 100)            s += 2;
  else if (reviews >= 30)        s += 1;
  if (place.internationalPhoneNumber)  s += 1;
  return Math.max(1, Math.min(10, s));
}

// ── COPILOTO DE SEGUIMIENTO ───────────────────────────────────
async function openCopilotModal(prospectId) {
  const p = prospects.find(x => x.id === prospectId);
  if (!p) return;
  if (!settings.anthropicKey) { showToast('Añade tu API key de Anthropic en Ajustes'); return; }

  document.getElementById('copilot-modal-name').textContent = p.name;
  document.getElementById('copilot-advice').innerHTML =
    '<div style="text-align:center;padding:20px"><span class="spinner-dark"></span><p style="margin-top:8px;color:var(--text2);font-size:13px">Analizando situación…</p></div>';
  document.getElementById('modal-copilot').classList.remove('hidden');

  const today = todayStr();
  const daysSince = p.lastActivity
    ? Math.floor((Date.now() - new Date(p.lastActivity + 'T00:00:00')) / 86400000)
    : null;
  const notesCtx = p.notes?.length
    ? p.notes.slice(-3).map(n => `- ${n.text}`).join('\n')
    : 'Sin notas previas.';

  const prompt = `Eres un consultor de ventas experto en vender webs a negocios locales en España.

Prospecto: ${p.name} (${p.type || 'negocio local'}, ${p.city || 'España'})
Etapa: ${stageLabel(p.stage)}
Google: ${p.rating ? p.rating.toFixed(1) + '/5 · ' + (p.reviews || 0) + ' reseñas' : 'sin valoración'}
${p.phone ? 'Tel: ' + p.phone : 'Sin teléfono'}
${p.email ? 'Email: ' + p.email : 'Sin email'}
${daysSince !== null ? 'Días sin actividad: ' + daysSince : ''}
${p.followupDate && p.followupDate < today ? '⚠ Seguimiento vencido desde ' + p.followupDate : p.followupDate === today ? '📅 Seguimiento programado para HOY' : p.followupDate ? 'Próximo seguimiento: ' + p.followupDate : 'Sin seguimiento programado'}
Notas:
${notesCtx}

Dame UNA recomendación concreta de qué hacer HOY. Sé específico: qué canal usar, qué decir, por qué ahora. Máximo 4 frases.`;

  try {
    const res  = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': settings.anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 300, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json();
    const text = data.content?.find(c => c.type === 'text')?.text || 'No se pudo generar recomendación.';
    document.getElementById('copilot-advice').innerHTML =
      `<p style="line-height:1.75;color:var(--text1);font-size:14px;margin:0">${text.replace(/\n/g, '<br>')}</p>`;
  } catch {
    document.getElementById('copilot-advice').innerHTML =
      '<p style="color:var(--red);font-size:13px">Error al conectar con la IA.</p>';
  }
}

function closeCopilotModal() { document.getElementById('modal-copilot').classList.add('hidden'); }

// ── PRIORIZADOR DIARIO ────────────────────────────────────────
async function generateDailyPlan() {
  if (!settings.anthropicKey) { showToast('Añade tu API key de Anthropic en Ajustes'); return; }

  const btn = document.getElementById('btn-daily-plan');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-dark"></span>';

  const today  = todayStr();
  const active = prospects.filter(p => p.stage !== 'closed' && p.stage !== 'lost');

  if (!active.length) {
    document.getElementById('daily-plan-content').innerHTML =
      '<p style="color:var(--text3);font-size:12px;margin:0">No hay prospectos activos todavía.</p>';
    btn.disabled = false;
    btn.innerHTML = '↻ Actualizar';
    return;
  }

  const overdueCount = active.filter(p => p.followupDate && p.followupDate <= today).length;
  const summary = active.slice(0, 12).map(p => {
    const flag = p.followupDate < today ? '[VENCIDO]' : p.followupDate === today ? '[HOY]' : '';
    const lastNote = p.notes?.length ? ' — ' + p.notes[p.notes.length - 1].text.substring(0, 50) : '';
    return `- ${p.name} · ${stageLabel(p.stage)}${flag ? ' ' + flag : ''}${lastNote}`;
  }).join('\n');

  const prompt = `Eres un coach de ventas. Tengo ${active.length} prospectos activos, ${overdueCount} con seguimiento vencido o para hoy.

${summary}

Dame exactamente 5 acciones para HOY, ordenadas por prioridad. Formato: una por línea, empieza con emoji de acción, luego nombre del prospecto si aplica, luego qué hacer. Sin explicaciones largas, directo al grano.`;

  try {
    const res  = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': settings.anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 350, messages: [{ role: 'user', content: prompt }] })
    });
    const data  = await res.json();
    const text  = data.content?.find(c => c.type === 'text')?.text || '';
    const lines = text.split('\n').filter(l => l.trim());
    document.getElementById('daily-plan-content').innerHTML = lines.map(l =>
      `<div style="padding:7px 0;border-bottom:1px solid var(--border1);font-size:12px;line-height:1.5;color:var(--text1)">${l}</div>`
    ).join('');
  } catch {
    document.getElementById('daily-plan-content').innerHTML =
      '<p style="color:var(--red);font-size:12px;margin:0">Error al conectar con la IA.</p>';
  }

  btn.disabled = false;
  btn.innerHTML = '↻ Actualizar';
}

// ── MODAL CLOSE ───────────────────────────────────────────────
['modal-prospect','modal-email','modal-notes','modal-template','modal-copilot'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', e => { if (e.target.id === id) document.getElementById(id).classList.add('hidden'); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') ['modal-prospect','modal-email','modal-notes','modal-template','modal-copilot'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
});
