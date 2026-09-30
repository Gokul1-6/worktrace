const API = 'http://127.0.0.1:8000/api';
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

const state = { tasks: [], analysis: null, activeView: 'overview' };

function escapeHtml(value='') {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function statusClass(status='') { return 's-' + status.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/,''); }
function formatDate(v) { if (!v) return '—'; const d=new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleString([], {dateStyle:'medium', timeStyle:'short'}); }
function showNotice(message, type='info') { const n=$('#notice'); n.textContent=message; n.className=`notice ${type}`; clearTimeout(showNotice.timer); showNotice.timer=setTimeout(()=>n.className='notice hidden',4200); }

async function api(path, options={}) {
  const response = await fetch(API + path, options);
  let data = null;
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) throw new Error(data?.detail || `Request failed (${response.status})`);
  return data;
}

async function loadDemo() {
  state.tasks = await api('/tasks');
  await runAnalysis(false);
}
async function runAnalysis(show=true) {
  if (!state.tasks.length) return;
  $('#analysisState').textContent = '● ANALYZING';
  try {
    state.analysis = await api('/analyze', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tasks:state.tasks})});
    renderAll();
    if (show) showNotice('Analysis completed using the current task dataset.', 'success');
  } catch (e) { showNotice(e.message, 'error'); }
  finally { $('#analysisState').textContent = '● READY'; }
}

function renderAll() {
  if (!state.analysis) return;
  renderMetrics(); renderFindings(); renderTasks(); renderGraphPreview(); renderFullGraph(); renderEdges(); renderBlockers(); renderActions();
}
function renderMetrics() {
  const s=state.analysis.summary;
  $('#metrics').innerHTML = [
    ['TOTAL TASKS', s.total_tasks, ''], ['COMPLETED', s.completed, 'green'], ['BLOCKED / WAITING', s.blocked, s.blocked ? 'red':''],
    ['OVERDUE', s.overdue, s.overdue ? 'red':''], ['PROJECT HEALTH', s.health, s.health==='At Risk'?'red':'green']
  ].map(x=>`<div class="metric"><small>${x[0]}</small><strong class="${x[2]}">${escapeHtml(x[1])}</strong></div>`).join('');
  $('#taskCount').textContent = `${s.total_tasks} tasks loaded`;
}
function findingCard(x, compact=false) {
  return `<article class="finding ${compact?'compact':''}">
    <div class="finding-top"><div class="finding-title">${escapeHtml(x.task)} <span>· ${escapeHtml(x.owner)}</span></div><span class="badge ${x.risk.toLowerCase()}">${escapeHtml(x.risk.toUpperCase())} · ${x.score}</span></div>
    <p><b>Root cause:</b> ${escapeHtml(x.root_cause)}. ${escapeHtml(x.reasons.join('; '))}.</p>
    <div class="impact">DOWNSTREAM IMPACT <b>${x.downstream_count}</b> task${x.downstream_count===1?'':'s'}</div>
    <div class="action">NEXT ACTION — ${escapeHtml(x.recommended_action)}</div>
  </article>`;
}
function renderFindings() {
  const f=state.analysis.findings;
  $('#findings').innerHTML = f.length ? f.slice(0,5).map(x=>findingCard(x)).join('') : '<div class="empty">No high-risk findings detected in the current data.</div>';
}
function renderTasks() {
  $('#tasks').innerHTML = state.tasks.map(t=>`<tr>
    <td><b>${escapeHtml(t.id)}</b> · ${escapeHtml(t.title)}</td><td>${escapeHtml(t.owner)}</td>
    <td><span class="status ${statusClass(t.status)}">${escapeHtml(t.status)}</span></td><td>${escapeHtml(t.priority)}</td>
    <td>${formatDate(t.deadline)}</td><td>${escapeHtml(t.depends_on || '—')}</td>
  </tr>`).join('');
}
function nodeHtml(n, compact=false) {
  const active=['blocked','waiting','delayed','pending'].includes((n.status||'').toLowerCase());
  return `<div class="node ${active?'blocked':''}"><div><b>${escapeHtml(n.id)}</b><span> ${escapeHtml(n.label)}</span></div><span>${escapeHtml(n.status)}</span></div>`;
}
function renderGraphPreview() {
  const nodes=state.analysis.graph.nodes.slice(0,7);
  $('#graphPreview').innerHTML = nodes.length ? nodes.map((n,i)=>nodeHtml(n,true)+(i<nodes.length-1?'<div class="arrow">↓</div>':'')).join('') : '<div class="empty">No workflow data.</div>';
}
function renderFullGraph() {
  const {nodes,edges}=state.analysis.graph;
  const children={}; nodes.forEach(n=>children[n.id]=[]); edges.forEach(e=>{if(children[e.from]) children[e.from].push(e.to)});
  const incoming=new Set(edges.map(e=>e.to)); const roots=nodes.filter(n=>!incoming.has(n.id));
  const ordered=[]; const seen=new Set();
  function walk(id){ if(seen.has(id)) return; seen.add(id); const n=nodes.find(x=>x.id===id); if(n) ordered.push(n); (children[id]||[]).forEach(walk); }
  roots.forEach(r=>walk(r.id)); nodes.forEach(n=>walk(n.id));
  $('#fullGraph').innerHTML=ordered.map((n,i)=>nodeHtml(n)+(i<ordered.length-1?'<div class="arrow">↓</div>':'')).join('');
}
function renderEdges() {
  const map=Object.fromEntries(state.analysis.graph.nodes.map(n=>[n.id,n]));
  $('#edges').innerHTML = state.analysis.graph.edges.length ? state.analysis.graph.edges.map(e=>`<div class="edge"><span>${escapeHtml(map[e.from]?.title || e.from)}</span><b>→</b><span>${escapeHtml(map[e.to]?.title || e.to)}</span></div>`).join('') : '<div class="empty">No dependencies found in this dataset.</div>';
}
function renderBlockers() {
  const f=state.analysis.findings;
  $('#blockerCount').textContent=`${f.length} detected`;
  $('#blockerList').innerHTML=f.length ? f.map(x=>findingCard(x)).join('') : '<div class="panel empty">No blockers detected. The current workflow is clear.</div>';
}
function renderActions() {
  const f=state.analysis.findings;
  $('#actionList').innerHTML=f.length ? f.map((x,i)=>`<article class="action-card"><div class="action-number">${String(i+1).padStart(2,'0')}</div><div class="action-body"><div class="action-meta">${escapeHtml(x.risk)} PRIORITY · ${escapeHtml(x.owner)}</div><h3>${escapeHtml(x.recommended_action)}</h3><p>Triggered by <b>${escapeHtml(x.task)}</b>; affects ${x.downstream_count} downstream task${x.downstream_count===1?'':'s'}.</p><button class="copy-action" data-action="${escapeHtml(x.recommended_action)}">COPY ACTION</button></div></article>`).join('') : '<div class="panel empty">No actions required from the current analysis.</div>';
}

function setView(view) {
  if (!['overview','graph','blockers','actions'].includes(view)) return;
  state.activeView=view;
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active-view', v.id === 'view-' + view));
  window.scrollTo(0,0);
}
window.WorkTraceNav = setView;

$('#nav').addEventListener('click', e=>{ const b=e.target.closest('[data-view]'); if(b) setView(b.dataset.view); });
document.addEventListener('click', e=>{
  const link=e.target.closest('[data-view-link]'); if(link) setView(link.dataset.viewLink);
  const copy=e.target.closest('.copy-action');
  if(copy){ navigator.clipboard?.writeText(copy.dataset.action).then(()=>showNotice('Action copied to clipboard.','success')).catch(()=>showNotice('Copy failed; select the action manually.','error')); }
});
$('#analyze').addEventListener('click',()=>runAnalysis(true));
$('#reset').addEventListener('click', async()=>{ try { await loadDemo(); setView('overview'); showNotice('Demo dataset restored.','success'); } catch(e){showNotice(e.message,'error');} });
$('#file').addEventListener('change', async e=>{
  const file=e.target.files[0]; if(!file) return;
  try {
    const csv=await file.text();
    // Keep the imported rows locally so every dashboard view has the full task data.
    const rows=parseCsv(csv);
    state.tasks=rows;
    state.analysis=await api('/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tasks:rows})});
    renderAll(); setView('overview'); showNotice(`${rows.length} tasks imported and analyzed.`,'success');
  } catch(e){ showNotice(`CSV import failed: ${e.message}`,'error'); }
  e.target.value='';
});

function parseCsv(text){
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());
  if(lines.length<2) throw new Error('CSV must contain a header and at least one task.');
  const parseLine=line=>{ const out=[]; let cur='', quote=false; for(let i=0;i<line.length;i++){ const c=line[i]; if(c==='"'){ if(quote&&line[i+1]==='"'){cur+='"';i++;} else quote=!quote; } else if(c===','&&!quote){out.push(cur.trim());cur='';} else cur+=c; } out.push(cur.trim()); return out; };
  const headers=parseLine(lines[0]).map(x=>x.toLowerCase());
  const required=['id','title','owner','status','priority','deadline','depends_on','last_update','description'];
  const missing=required.filter(h=>!headers.includes(h)); if(missing.length) throw new Error(`Missing CSV columns: ${missing.join(', ')}`);
  return lines.slice(1).map(line=>{const vals=parseLine(line); const row={}; headers.forEach((h,i)=>row[h]=vals[i]??''); return row;});
}

loadDemo().catch(e=>{ showNotice(`Backend is not running. Start the backend first: ${e.message}`,'error'); });
