import { CURRENCIES, localDate } from './core.js';
import { STORAGE_PREFIX, storageKey, parseEnvelope, validateData, parseWorkspaceBackup } from './schema.js';
export const BASE = new URL('../../', import.meta.url);
export const APPS = [
  { id: 'property-planner', key: 'property', name: 'Property Planner', short: 'Property', icon: 'home', category: 'Plan', color: 'teal', tagline: 'Find your place. Know your priorities.', description: 'Compare properties with weighted criteria, thoughtful notes, and a shortlist that makes sense.', features: ['Weighted comparisons', 'Personal shortlist', 'Visit planning'] },
  { id: 'calendar-auditor', key: 'calendar', name: 'Calendar Auditor', short: 'Calendar', icon: 'calendar', category: 'Organize', color: 'violet', tagline: 'Make room for what matters.', description: 'Turn an ICS calendar into a clear picture of your time, conflicts, and breathing room.', features: ['ICS import', 'Conflict detection', 'Time summaries'] },
  { id: 'stay-splitter', key: 'splitter', name: 'Stay Splitter', short: 'Expenses', icon: 'split', category: 'Organize', color: 'orange', tagline: 'Shared experiences. Fair shares.', description: 'Keep group expenses balanced, split costs your way, and settle up with fewer transfers.', features: ['Weighted shares', 'Exact settlements', 'Group reports'] },
  { id: 'trip-planner', key: 'trip', name: 'Trip Planner', short: 'Trips', icon: 'route', category: 'Plan', color: 'blue', tagline: 'Less logistics. More looking forward.', description: 'Shape a day-by-day itinerary with places, times, notes, and a budget you can actually follow.', features: ['Daily timelines', 'Budget overview', 'Calendar export'] },
  { id: 'local-guide', key: 'guide', name: 'Local Guide', short: 'Places', icon: 'pin', category: 'Explore', color: 'rose', tagline: 'Good places, kept close.', description: 'Build a personal collection of places worth remembering, then bring them into your next trip.', features: ['Personal collections', 'Ratings & favorites', 'Itinerary handoff'] }
];
const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h2m6 0h2m-10 3h2"/>',
  split: '<path d="M12 3v7m0 0L5 16m7-6 7 6M2 15l3 1 1 4m16-5-3 1-1 4"/><circle cx="12" cy="4" r="1"/>',
  route: '<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h9a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h9"/>',
  pin: '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  link: '<path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 10v7m0-11v1"/>',
  wave: '<path d="M2 8c4-8 8 8 12 0s8 8 10 0M2 16c4-8 8 8 12 0s8 8 10 0"/>'
};
export const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const href = (app = '', query = '') => new URL(`${app ? app + '/' : ''}${query}`, BASE).pathname + (query || '');
export const appURL = (app, query = '') => new URL(`${app ? app + '/' : ''}${query}`, BASE).href;
export const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const PREFIX = STORAGE_PREFIX;
const observed = new Map(), snapshots = new Map(), blocked = new Set();
function rollback(target,source) {
  if(Array.isArray(target)&&Array.isArray(source)){
    const old=new Map(target.filter(x=>x&&typeof x==='object'&&x.id).map(x=>[x.id,x]));
    target.splice(0,target.length,...source.map(value=>{
      if(value&&typeof value==='object'&&value.id&&old.has(value.id)){const item=old.get(value.id);rollback(item,value);return item;}
      return structuredClone(value);
    }));
  }else if(target&&source&&typeof target==='object'&&typeof source==='object'){
    for(const key of Object.keys(target))if(!Object.hasOwn(source,key))delete target[key];
    for(const [key,value] of Object.entries(source)){
      if(value&&typeof value==='object'&&target[key]&&Array.isArray(value)===Array.isArray(target[key]))rollback(target[key],value);
      else target[key]=structuredClone(value);
    }
  }
}
export const storageIssues = () => [...blocked];
export function read(key, fallback) {
  try {
    const raw=localStorage.getItem(storageKey(key));observed.set(key,raw);
    const data=raw?parseEnvelope(key,raw).data:structuredClone(fallback);
    snapshots.set(key,structuredClone(data));return data;
  } catch {
    if(!blocked.has(key))queueMicrotask(()=>toast(`Saved ${key} data could not be read. Nothing was deleted. Download a workspace backup on the hub before restoring a valid backup. Saving this workspace is blocked to protect the original data.`,true));
    blocked.add(key);snapshots.set(key,structuredClone(fallback));return structuredClone(fallback);
  }
}
export function write(key, data) {
  try {
    if(blocked.has(key))throw Error('Saving is blocked because this workspace contains unreadable data. Download a raw workspace backup on the hub, then restore a valid backup.');
    validateData(key,data);
    let previous;try{previous=localStorage.getItem(storageKey(key));}catch{throw Error('Changes were not saved. Browser storage is disabled. Allow site storage and try again.');}
    if(observed.has(key)&&previous!==observed.get(key))throw Error('Saved data changed in another tab. Your change was not applied. Reload this page before editing again.');
    const raw=JSON.stringify({version:1,updatedAt:new Date().toISOString(),data});
    try{localStorage.setItem(storageKey(key),raw);}catch{throw Error('Your changes could not be saved. Browser storage may be full or disabled. Export a backup and allow site storage before trying again.');}
    observed.set(key,raw);snapshots.set(key,structuredClone(data));
  }catch(error){if(snapshots.has(key))rollback(data,snapshots.get(key));throw error;}
  window.dispatchEvent(new CustomEvent('praia:save',{detail:key}));
}
export function restoreWorkspace(textValue) {
  const records=parseWorkspaceBackup(textValue),previous=new Map();
  // Read every existing value before touching any of them.
  for(const r of records)previous.set(r.storageKey,localStorage.getItem(r.storageKey));
  if(!confirm(`Restore ${records.length} saved application workspace(s)? This replaces their data in this browser. Other workspaces are unchanged. Download your current backup first.`))return false;
  try{for(const r of records)localStorage.setItem(r.storageKey,r.raw);}
  catch{
    let failed=false;for(const [key,raw] of previous)try{if(raw===null)localStorage.removeItem(key);else localStorage.setItem(key,raw);}catch{failed=true;}
    throw Error(failed?'Restore failed and browser storage prevented complete rollback. Keep both backups and free browser storage before continuing.':'Restore failed (browser storage full or disabled). Previous workspace data was restored.');
  }
  for(const r of records){blocked.delete(r.key);observed.set(r.key,r.raw);snapshots.set(r.key,structuredClone(parseEnvelope(r.key,r.raw).data));}
  toast(`Restored ${records.length} application workspace(s).`);return true;
}
export function rawWorkspace() {
  const result = { format: 'praia-digital-apps', version: 1, exportedAt: new Date().toISOString(), storage: {} };
  for (const app of APPS) { const key = `${PREFIX}${app.key}.v1`; try { result.storage[key] = localStorage.getItem(key); } catch { result.storage[key] = 'Storage unavailable'; } }
  return result;
}
export function toast(message, error = false) {
  const el = document.getElementById('toast'); if (!el) return;
  clearTimeout(el._timer); el.setAttribute('role', error ? 'alert' : 'status'); el.setAttribute('aria-live', error ? 'assertive' : 'polite'); el.className = `toast visible ${error ? 'error' : ''}`; el.textContent = message;
  el._timer = setTimeout(() => { el.classList.remove('visible'); }, error ? 18000 : 5500);
}
export const safe = fn => async event => { try { await fn(event); } catch (error) { toast(error.message || 'Something went wrong. Please try again.', true); } };
export function download(name, content, type = 'application/json') {
  const blob = new Blob([typeof content === 'string' ? content : JSON.stringify(content, null, 2)], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast(`${name} downloaded.`);
}
export const money = (amount, currency = 'EUR') => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount / 100);
export const prettyDate = date => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
export const time = value => new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
export const duration = minutes => {const rounded=Math.round(minutes);return `${Math.floor(rounded/60)}h ${rounded%60}m`;};
export const currencyOptions = value => CURRENCIES.map(c => `<option value="${c}" ${c === value ? 'selected' : ''}>${c}</option>`).join('');
export const field = (label, name, value = '', attrs = '') => `<div class="field"><label for="f-${esc(name)}">${esc(label)}</label><input id="f-${esc(name)}" name="${esc(name)}" value="${esc(value)}" ${attrs}></div>`;
export const area = (label, name, value = '', attrs = '') => `<div class="field full"><label for="f-${esc(name)}">${esc(label)}</label><textarea id="f-${esc(name)}" name="${esc(name)}" maxlength="4000" rows="3" ${attrs}>${esc(value)}</textarea></div>`;
export const select = (label, name, options, attrs = '') => `<div class="field"><label for="f-${esc(name)}">${esc(label)}</label><select id="f-${esc(name)}" name="${esc(name)}" ${attrs}>${options}</select></div>`;
export const options = (items, selected) => items.map(item => `<option value="${esc(item.id)}" ${item.id === selected ? 'selected' : ''}>${esc(item.name)}</option>`).join('');
export function editor(title, body, onSave, setup = () => {}) {
  document.getElementById('editor')?.remove();
  const previous = document.activeElement, dialog = document.createElement('dialog'); dialog.id = 'editor'; dialog.setAttribute('aria-labelledby', 'editor-title');
  dialog.innerHTML = `<form id="editor-form"><div class="dialog-heading"><div><span class="eyebrow">YOUR WORKSPACE</span><h2 id="editor-title">${esc(title)}</h2></div><button type="button" class="icon-btn" data-close aria-label="Close dialog">${icon('close')}</button></div><div class="form-grid">${body}</div><p class="form-error" role="alert" id="form-error"></p><div class="dialog-actions"><button type="button" class="button secondary" data-close>Cancel</button><button type="submit" class="button">${icon('check')} Save changes</button></div></form>`;
  document.body.append(dialog); const form = dialog.querySelector('form');
  dialog.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dialog.close()));
  form.addEventListener('submit', async event => {
    event.preventDefault(); const button = form.querySelector('[type=submit]'); button.disabled = true;
    try { if (await onSave(Object.fromEntries(new FormData(form)), form) !== false) dialog.close(); }
    catch (error) { form.querySelector('#form-error').textContent = error.message; }
    finally { button.disabled = false; }
  });
  dialog.addEventListener('keydown', event => {
    if(event.key !== 'Tab') return;
    const stops=[...dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(el=>el.getClientRects().length);
    const first=stops[0],last=stops.at(-1);
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
  });
  dialog.addEventListener('close', () => { dialog.remove(); if (previous?.isConnected) previous.focus(); else document.querySelector('h1')?.focus(); });
  dialog.showModal(); setup(form, dialog); (form.querySelector('input:not([type=hidden]),select,textarea') || form.querySelector('button')).focus(); return dialog;
}
export const empty = (name, title, description, action = '') => `<div class="empty"><span class="empty-icon">${icon(name)}</span><h3>${esc(title)}</h3><p>${esc(description)}</p>${action}</div>`;
export const stats = items => `<div class="stats">${items.map(s => `<div class="stat"><span class="stat-label">${esc(s.label)}</span><strong>${esc(s.value)}</strong><span>${esc(s.detail || '')}</span></div>`).join('')}</div>`;
export function related(current) {
  const ids = { 'property-planner': ['trip-planner', 'local-guide'], 'calendar-auditor': ['trip-planner', 'stay-splitter'], 'stay-splitter': ['trip-planner', 'property-planner'], 'trip-planner': ['local-guide', 'stay-splitter', 'calendar-auditor'], 'local-guide': ['trip-planner', 'property-planner'] }[current] || [];
  return `<section class="related" aria-labelledby="related-title"><div><span class="eyebrow">BETTER TOGETHER</span><h2 id="related-title">Keep the momentum going.</h2></div><div class="related-grid">${ids.map(id => { const a = APPS.find(x => x.id === id); return `<a href="${appURL(id)}" class="related-card"><span class="app-icon ${a.color}">${icon(a.icon)}</span><span><strong>${a.name}</strong><small>${a.tagline}</small></span>${icon('arrow')}</a>`; }).join('')}</div></section>`;
}
export function shell(current) {
  const app = APPS.find(a => a.id === current);
  document.body.dataset.app = current || 'hub';
  document.getElementById('site-header').innerHTML = `<div class="header-inner"><a class="brand" href="${BASE.href}" aria-label="Praia Digital Apps home"><span class="brand-mark">${icon('wave')}</span><span>praia<span class="brand-secondary">digital apps</span></span></a><button id="nav-toggle" class="icon-btn mobile-toggle" aria-expanded="false" aria-controls="primary-nav" aria-label="Open navigation">${icon('menu')}</button><nav id="primary-nav" aria-label="Main navigation"><a href="${BASE.href}" ${!app ? 'aria-current="page"' : ''}>Overview</a>${APPS.map(a => `<a href="${appURL(a.id)}" ${a.id === current ? 'aria-current="page"' : ''}>${icon(a.icon)}${a.short}</a>`).join('')}</nav><span class="local-indicator">${icon('shield')} Local-first</span></div>`;
  const toggle = document.getElementById('nav-toggle'), nav = document.getElementById('primary-nav');
  const closeNav = () => { toggle.setAttribute('aria-expanded', 'false'); nav.classList.remove('open'); toggle.setAttribute('aria-label', 'Open navigation'); };
  toggle.addEventListener('click', () => { const open = toggle.getAttribute('aria-expanded') !== 'true'; toggle.setAttribute('aria-expanded', String(open)); toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); nav.classList.toggle('open', open); if(open) requestAnimationFrame(()=>nav.querySelector('a')?.focus()); });
  nav.addEventListener('keydown', event => { if (event.key === 'Escape') { closeNav(); toggle.focus(); } });
  document.addEventListener('click', event => { if (!document.getElementById('site-header').contains(event.target)) closeNav(); });
  document.getElementById('site-footer').innerHTML = `<div class="footer-top"><div><a class="brand" href="${BASE.href}"><span class="brand-mark">${icon('wave')}</span><span>praia<span class="brand-secondary">digital apps</span></span></a><p>Thoughtful tools for places, plans,<br>and everything in between.</p></div><nav aria-label="Application directory"><strong>Your toolkit</strong>${APPS.map(a => `<a href="${appURL(a.id)}">${a.name}</a>`).join('')}</nav><div class="footer-note">${icon('shield')}<strong>Your browser. Your data.</strong><p>No account, tracking, or payment processing. Data stays on this browser and device. Export backups before clearing site data.</p></div></div><div class="footer-bottom"><span>Independent project inspired by Praia Digital. Not affiliated with praia.digital.</span><a href="https://github.com/michaelpaul03/praia-digital-apps" target="_blank" rel="noopener noreferrer">Source code ↗</a><a href="${new URL('LICENSE', BASE).href}">MIT license</a></div>`;
  if (app) {
    document.getElementById('main').innerHTML = `<div class="container"><a class="back-link" href="${BASE.href}">← All applications</a><header class="app-heading"><div class="app-title"><span class="app-icon large ${app.color}">${icon(app.icon)}</span><div><span class="eyebrow">${app.category.toUpperCase()} WITH INTENTION</span><h1 tabindex="-1">${app.name}</h1></div></div><p>${app.tagline} ${app.description}</p><span class="privacy-chip">${icon('shield')} Saved on this device · no account needed</span></header><div id="workspace" role="region" aria-label="${app.name} workspace"></div>${related(current)}</div>`;
  }
}
export const today = localDate;
