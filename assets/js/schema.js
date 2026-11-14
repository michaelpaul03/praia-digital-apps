/* Browser-storage and backup boundaries. Reject corrupt input before any write. */
import { CURRENCIES, DAY, isoDate, dateRange } from './core.js';
export const STORAGE_PREFIX = 'praia.case684.';
export const STORE_KEYS = ['property','calendar','splitter','trip','guide'];
export const storageKey = key => `${STORAGE_PREFIX}${key}.v1`;
const MAX_MONEY = 9999999999;
const fail = message => { throw Error(message); };
const record = (v,label) => {if(!v||typeof v!=='object'||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)fail(`${label} must be an object.`);if(Object.keys(v).some(k=>['__proto__','constructor','prototype'].includes(k)))fail(`${label} contains a reserved key.`);return true;};
const text = (v,label,max=4000,required=false) => typeof v === 'string' && v.length <= max && (!required || v.trim().length > 0) || fail(`${label} must be ${required?'nonempty text':'text'} of at most ${max} characters.`);
const num = (v,label,min=0,max=MAX_MONEY,integer=false) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max && (!integer || Number.isSafeInteger(v)) || fail(`${label} is outside the supported numeric range.`);
const bool = (v,label) => typeof v === 'boolean' || fail(`${label} must be true or false.`);
const array = (v,label,max) => Array.isArray(v) && v.length <= max || fail(`${label} must be a list of at most ${max} items.`);
const date = (v,label) => isoDate(v) || fail(`${label} must be a real YYYY-MM-DD date.`);
const currency = v => CURRENCIES.includes(v) || fail('Choose a supported two-decimal currency.');
function entities(values,label,max,safeIds=true) {
  array(values,label,max);const ids=new Set();
  for(const value of values){record(value,label);text(value.id,`${label} ID`,4096,true);if(safeIds&&!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value.id))fail(`${label} ID contains unsupported characters.`);if(['__proto__','constructor','prototype'].includes(value.id))fail('Reserved item ID.');if(ids.has(value.id))fail(`${label} IDs must be unique.`);ids.add(value.id);}return ids;
}
export function validateData(key,data) {
  record(data,'Saved data');
  if(key==='property'){
    entities(data.criteria,'Criteria',12);if(!data.criteria.length)fail('At least one criterion is required.');
    data.criteria.forEach(c=>{text(c.name,'Criterion name',50,true);num(c.weight,'Criterion weight',0,1000);});
    if(new Set(data.criteria.map(c=>c.name.toLowerCase())).size!==data.criteria.length)fail('Criterion names must be unique.');
    if(!data.criteria.some(c=>c.weight>0))fail('At least one criterion weight must be positive.');
    entities(data.properties,'Properties',1000).size;
    data.properties.forEach(p=>{text(p.name,'Property name',100,true);text(p.location,'Property location',160,true);num(p.price,'Property price',0,MAX_MONEY,true);currency(p.currency);if(p.size!=='')num(p.size,'Floor area',0,10000000);text(p.description,'Property description');text(p.notes,'Property notes');bool(p.favorite,'Property favorite');record(p.ratings,'Ratings');Object.values(p.ratings).forEach(r=>num(r,'Rating',0,10));});
  }else if(key==='trip'){
    entities(data.trips,'Trips',200);text(data.active,'Active trip ID',4096);
    data.trips.forEach(t=>{text(t.name,'Trip name',100,true);text(t.destination,'Destination',160,true);dateRange(t.start,t.end);currency(t.currency);text(t.notes,'Trip notes');entities(t.activities,'Activities',5000);t.activities.forEach(a=>{text(a.title,'Activity title',140,true);date(a.date,'Activity date');if(a.date<t.start||a.date>t.end)fail('An activity falls outside its trip dates.');if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(a.time))fail('Activity start time is invalid.');num(a.duration,'Activity duration',1,1440,true);num(a.cost,'Activity cost',0,MAX_MONEY,true);text(a.location,'Activity location',240);text(a.notes,'Activity notes');if(a.source!==undefined)text(a.source,'Activity source',4096);});});
  }else if(key==='guide'){
    entities(data.places,'Places',2000);const categories=['Restaurants','Attractions','Shopping','Services','Entertainment','Outdoors','Other'];
    data.places.forEach(p=>{text(p.name,'Place name',120,true);if(!categories.includes(p.category))fail('Unknown place category.');text(p.location,'Place area',160,true);text(p.address,'Place address',240);text(p.website,'Website',600);if(p.website){let url;try{url=new URL(p.website);}catch{fail('Invalid place website.');}if(!['http:','https:'].includes(url.protocol))fail('Place websites must use http or https.');}num(p.rating,'Place rating',0,5,true);bool(p.favorite,'Place favorite');array(p.collections,'Collections',20);p.collections.forEach(c=>text(c,'Collection name',100,true));text(p.info,'Useful information');text(p.notes,'Place notes');});
  }else if(key==='splitter'){
    entities(data.groups,'Groups',200);text(data.active,'Active group ID',4096);
    data.groups.forEach(g=>{text(g.name,'Group name',120,true);currency(g.currency);const people=entities(g.people,'Participants',12);if(people.size<2)fail('A group needs at least two participants.');g.people.forEach(p=>text(p.name,'Participant name',60,true));if(new Set(g.people.map(p=>p.name.toLowerCase())).size!==people.size)fail('Participant names must be unique.');entities(g.expenses,'Expenses',5000);g.expenses.forEach(e=>{text(e.title,'Expense title',160,true);num(e.amount,'Expense amount',1,MAX_MONEY,true);date(e.date,'Expense date');if(!people.has(e.payer))fail('Unknown expense payer.');if(!['equal','weighted'].includes(e.mode))fail('Unknown split method.');record(e.weights,'Expense shares');Object.entries(e.weights).forEach(([id,w])=>{num(w,'Share weight',0,10000);if(w>0&&!people.has(id))fail('Expense shares refer to an unknown participant.');});if(!g.people.some(p=>(e.weights[p.id]||0)>0))fail('An expense must have positive shares.');if(e.source!==undefined)text(e.source,'Expense source',4096);});});
  }else if(key==='calendar'){
    entities(data.events,'Calendar events',10000,false);array(data.warnings,'Import notes',10000);data.warnings.forEach(w=>text(w,'Import note',10000));text(data.fileName,'Calendar filename',1000);text(data.importedAt,'Import timestamp',100);
    data.events.forEach(e=>{text(e.title,'Event title',4000,true);text(e.location,'Event location');text(e.notes,'Event notes');num(e.start,'Event start',-2208988800000,253402300799999);num(e.end,'Event end',e.start,Math.min(e.start+3660*DAY,253402300799999));bool(e.allDay,'All-day flag');bool(e.transparent,'Availability flag');text(e.timezone,'Event timezone',200,true);text(e.source,'Event source',4200,true);if(e.uid!==undefined)text(e.uid,'Event UID',4000,true);});
  }else fail('Unknown workspace type.');
  return data;
}
export function parseEnvelope(key,raw) {
  const envelope=JSON.parse(raw);record(envelope,'Storage record');if(envelope.version!==1)fail('Unsupported storage version.');text(envelope.updatedAt,'Last-saved timestamp',100,true);if(!Number.isFinite(Date.parse(envelope.updatedAt)))fail('Invalid last-saved timestamp.');validateData(key,envelope.data);return envelope;
}
export function parseWorkspaceBackup(textValue) {
  if(typeof textValue!=='string'||new TextEncoder().encode(textValue).length>10*1024*1024)fail('Choose a workspace backup smaller than 10 MB.');
  let backup;try{backup=JSON.parse(textValue);}catch{fail('The backup is not valid JSON.');}
  record(backup,'Backup');if(backup.format!=='praia-digital-apps'||backup.version!==1)fail('Choose a version 1 Praia Digital Apps workspace backup.');record(backup.storage,'Backup storage');
  const known=Object.fromEntries(STORE_KEYS.map(k=>[storageKey(k),k])),result=[];
  for(const [fullKey,raw] of Object.entries(backup.storage)){
    if(!Object.hasOwn(known,fullKey))fail('The backup contains an unrecognized storage key.');
    if(raw===null)continue;if(typeof raw!=='string')fail('A saved workspace record is not a string.');
    parseEnvelope(known[fullKey],raw);result.push({key:known[fullKey],storageKey:fullKey,raw});
  }
  if(!result.length)fail('This backup contains no saved application data.');return result;
}
