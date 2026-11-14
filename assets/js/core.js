/* Pure domain functions. No DOM, network, or storage dependencies. */
export const DAY = 86400000;
export const CURRENCIES = ['EUR', 'USD', 'GBP', 'BRL', 'CAD', 'AUD', 'INR', 'MXN', 'CHF', 'ZAR'];
export function isoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === value;
}
export function addDays(value, amount) {
  if (!isoDate(value) || !Number.isInteger(amount)) throw Error('Enter a valid calendar date.');
  const d = new Date(`${value}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
export function dateRange(start, end, limit = 366) {
  if (!isoDate(start) || !isoDate(end) || end < start) throw Error('The end date must be on or after the start date.');
  const count = Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1;
  if (count > limit) throw Error(`Choose a date range of ${limit} days or fewer.`);
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}
export function localDate(value = Date.now()) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function cents(value) {
  const s = String(value).trim();
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(s)) throw Error('Enter a positive amount with no more than two decimal places (maximum 99,999,999.99).');
  const [whole, fraction = ''] = s.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export function allocate(total, weights) {
  if (!Number.isSafeInteger(total) || total < 0 || !weights.length || weights.some(w => !Number.isFinite(w) || w < 0 || w > 10000)) throw Error('Shares must be numbers between 0 and 10,000.');
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) throw Error('At least one participant must have a positive share.');
  const raw = weights.map(w => total * w / sum), result = raw.map(Math.floor);
  let left = total - result.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => ({ i, remainder: v - result[i] })).sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (let i = 0; i < left; i++) result[order[i % order.length].i]++;
  return result;
}
export function balances(group) {
  const result = Object.fromEntries(group.people.map(p => [p.id, 0]));
  for (const expense of group.expenses) {
    if (!(expense.payer in result)) throw Error('An expense has an unknown payer.');
    const shares = allocate(expense.amount, group.people.map(p => Number(expense.weights[p.id] || 0)));
    result[expense.payer] += expense.amount;
    group.people.forEach((p, i) => result[p.id] -= shares[i]);
  }
  return result;
}
/* Exact minimum transfers: maximize the number of disjoint zero-sum subsets.
   With a maximum of 12 nonzero balances, the subset DP is bounded (3^12). */
export function settlements(balanceMap) {
  const entries = Object.entries(balanceMap).filter(([, n]) => n !== 0);
  if (entries.length > 12 || entries.some(([, n]) => !Number.isSafeInteger(n))) throw Error('Exact settlements support up to 12 participants with integer-cent balances.');
  if (entries.reduce((s, [, n]) => s + n, 0) !== 0) throw Error('Balances must sum to zero.');
  const n = entries.length, full = (1 << n) - 1;
  const sums = new Float64Array(1 << n), memo = new Map([[0, { count: 0, parts: [] }]]);
  for (let mask = 1; mask <= full; mask++) {
    const bit = mask & -mask, index = Math.log2(bit);
    sums[mask] = sums[mask ^ bit] + entries[index][1];
  }
  function best(mask) {
    if (memo.has(mask)) return memo.get(mask);
    const first = mask & -mask; let answer = { count: -1, parts: [] };
    for (let sub = mask; sub; sub = (sub - 1) & mask) {
      if (!(sub & first) || sums[sub] !== 0) continue;
      const rest = best(mask ^ sub);
      if (rest.count + 1 > answer.count) answer = { count: rest.count + 1, parts: [sub, ...rest.parts] };
    }
    memo.set(mask, answer); return answer;
  }
  const transfers = [];
  for (const mask of best(full).parts) {
    const debt = [], credit = [];
    entries.forEach(([id, value], i) => { if (mask & (1 << i)) (value < 0 ? debt : credit).push({ id, amount: Math.abs(value) }); });
    let d = 0, c = 0;
    while (d < debt.length && c < credit.length) {
      const amount = Math.min(debt[d].amount, credit[c].amount);
      transfers.push({ from: debt[d].id, to: credit[c].id, amount });
      debt[d].amount -= amount; credit[c].amount -= amount;
      if (!debt[d].amount) d++; if (!credit[c].amount) c++;
    }
  }
  return transfers;
}
export function score(property, criteria) {
  const total = criteria.reduce((s, c) => s + Math.max(0, Number(c.weight) || 0), 0);
  if (!total) return 0;
  return criteria.reduce((s, c) => s + Math.min(10, Math.max(0, Number(property.ratings[c.id]) || 0)) * Math.max(0, Number(c.weight) || 0), 0) / total * 10;
}
export function csv(rows) {
  return '\ufeff' + rows.map(row => row.map(value => {
    let text = String(value ?? '');
    if (typeof value !== 'number' && /^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
}
const weekdays = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const unescapeICS = text => String(text || '').replace(/\\([nN,;\\])/g, (_, c) => c === 'n' || c === 'N' ? '\n' : c);
const escapeICS = text => String(text || '').replaceAll('\\', '\\\\').replace(/\r?\n/g, '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,');
function partsInZone(time, tz) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(time));
  return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}
function wallTime(parts, tz) {
  const [year, month, day, hour = 0, minute = 0, second = 0] = parts;
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  if (tz === 'UTC') return guess;
  if (!tz) {
    const date = new Date(year, month - 1, day, hour, minute, second);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) throw Error('A local event time does not exist because of daylight saving time.');
    return +date;
  }
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch { throw Error(`Unsupported timezone: ${tz}. Export the calendar with IANA timezones or UTC.`); }
  const candidates = new Set();
  for (const sample of [guess - DAY, guess, guess + DAY]) {
    const p = partsInZone(sample, tz);
    const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - sample;
    const candidate = guess - offset, q = partsInZone(candidate, tz);
    if ([q.year, q.month, q.day, q.hour, q.minute, q.second].every((v, i) => v === [year, month, day, hour, minute, second][i])) candidates.add(candidate);
  }
  if (!candidates.size) throw Error(`A local event time does not exist in ${tz} because of daylight saving time.`);
  return Math.min(...candidates);
}
export function parseICSDate(value, params = {}) {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value);
  if (!match) throw Error(`Invalid ICS date: ${value}.`);
  const p = match.slice(1, 7).map(v => Number(v || 0)), [year, month, day, hour, minute, second] = p;
  if (year < 1900 || !isoDate(`${match[1]}-${match[2]}-${match[3]}`) || hour > 23 || minute > 59 || second > 59) throw Error(`Invalid ICS date: ${value}.`);
  const allDay = !match[4];
  if (params.VALUE === 'DATE' && !allDay) throw Error('A VALUE=DATE field must contain a date, not a time.');
  const tz = match[7] ? 'UTC' : (params.TZID || '');
  return { ms: wallTime(p, tz), parts: p, tz, allDay };
}
function parseDuration(text) {
  const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(text || '');
  if (!m || !m.slice(1).some(Boolean)) throw Error('Invalid or unsupported event duration.');
  return ((Number(m[1] || 0) * 7 + Number(m[2] || 0)) * 86400 + Number(m[3] || 0) * 3600 + Number(m[4] || 0) * 60 + Number(m[5] || 0)) * 1000;
}
function recurrenceDates(start, ruleText, warnings, title, horizonDays) {
  const rules = {};
  for (const pair of ruleText.split(';')) {
    const [k, v] = pair.split('=');
    if (!k || !v || k in rules) throw Error('Malformed recurrence rule.');
    rules[k] = v;
  }
  const allowed = ['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTHDAY', 'BYMONTH', 'WKST'];
  if (Object.keys(rules).some(k => !allowed.includes(k)) || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(rules.FREQ)) throw Error('Unsupported recurrence rule (supported: daily, weekly, monthly, yearly; numeric BYDAY ordinals are not supported).');
  if (rules.BYDAY && rules.BYDAY.split(',').some(x => !weekdays.includes(x))) throw Error('Ordinal or invalid BYDAY recurrence is not supported.');
  const every = Number(rules.INTERVAL || 1), count = Number(rules.COUNT || Infinity);
  if (!Number.isInteger(every) || every < 1 || (rules.COUNT && (!Number.isInteger(count) || count < 1)) || (rules.COUNT && rules.UNTIL)) throw Error('Invalid recurrence interval, count, or end condition.');
  const until = rules.UNTIL ? parseICSDate(rules.UNTIL, rules.UNTIL.endsWith('Z') ? {} : { TZID: start.tz }).ms : Infinity;
  const byDay = rules.BYDAY?.split(','), byMonth = rules.BYMONTH?.split(',').map(Number), byMD = rules.BYMONTHDAY?.split(',').map(Number);
  if (byMonth?.some(n => !Number.isInteger(n) || n < 1 || n > 12) || byMD?.some(n => !Number.isInteger(n) || n === 0 || Math.abs(n) > 31)) throw Error('Invalid recurrence month or month day.');
  const weekStart = weekdays.indexOf(rules.WKST || 'MO');
  if (weekStart < 0) throw Error('Invalid recurrence week start.');
  const first = new Date(Date.UTC(...[start.parts[0], start.parts[1] - 1, start.parts[2]]));
  const firstWeek = +first - ((first.getUTCDay() - weekStart + 7) % 7) * DAY;
  const out = [start.ms]; let generated = 1, truncated = false;
  for (let day = 1; day <= horizonDays && generated < count; day++) {
    const date = new Date(+first + day * DAY), y = date.getUTCFullYear(), m = date.getUTCMonth() + 1, d = date.getUTCDate(), wd = date.getUTCDay();
    const monthDiff = (y - start.parts[0]) * 12 + m - start.parts[1];
    const weekDiff = Math.floor((+date - ((wd - weekStart + 7) % 7) * DAY - firstWeek) / (7 * DAY));
    let matches = rules.FREQ === 'DAILY' ? day % every === 0 : rules.FREQ === 'WEEKLY' ? weekDiff % every === 0 && (byDay ? true : wd === first.getUTCDay()) : rules.FREQ === 'MONTHLY' ? monthDiff % every === 0 : (y - start.parts[0]) % every === 0 && (byMonth ? true : m === start.parts[1]);
    if (byMonth && !byMonth.includes(m)) matches = false;
    if (byDay && !byDay.includes(weekdays[wd])) matches = false;
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (byMD && !byMD.some(n => (n > 0 ? n : daysInMonth + n + 1) === d)) matches = false;
    if (['MONTHLY', 'YEARLY'].includes(rules.FREQ) && !byMD && !byDay && d !== start.parts[2]) matches = false;
    // Resolve a wall time only on an actual recurrence day. A DST gap on
    // an unrelated day must not invalidate an entire weekly series.
    if (matches) {
      let ms;
      try { ms = wallTime([y, m, d, ...start.parts.slice(3)], start.tz); }
      catch (error) {
        if (error.message.includes('does not exist')) {
          warnings.push(`“${title}”: skipped a recurrence in a daylight-saving gap.`);
          continue;
        }
        throw error;
      }
      if (ms > until) break;
      out.push(ms); generated++;
    }
    if (day === horizonDays && generated < count && +date < until) truncated = true;
  }
  if (truncated) warnings.push(`“${title}”: recurrence was limited to ${horizonDays} days after its start. Later occurrences were not analyzed.`);
  return out.filter(n => n <= until);
}
export function parseICS(text, options = {}) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > 2 * 1024 * 1024) throw Error('Choose an ICS file smaller than 2 MB.');
  text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');
  if (!/^\s*BEGIN:VCALENDAR\s*\n/.test(text) || !/\nEND:VCALENDAR\s*$/.test(text) || text.includes('\0')) throw Error('This is not a complete iCalendar (.ics) file. It must contain BEGIN:VCALENDAR and END:VCALENDAR.');
  const raw = [], warnings = []; let event = null, alarm = 0;
  for (const line of text.split('\n')) {
    if (line === 'BEGIN:VEVENT') { if (event) throw Error('Nested or incomplete VEVENT records.'); event = {}; continue; }
    if (line === 'END:VEVENT') { if (!event || alarm) throw Error('An event contains an unclosed component.'); raw.push(event); event = null; continue; }
    if (!event) continue;
    if (line.startsWith('BEGIN:')) { alarm++; continue; }
    if (line.startsWith('END:')) { alarm--; if (alarm < 0) throw Error('Invalid nested event component.'); continue; }
    if (alarm) continue;
    let colon = -1, quoted = false;
    for (let i = 0; i < line.length; i++) { if (line[i] === '"') quoted = !quoted; if (line[i] === ':' && !quoted) { colon = i; break; } }
    if (colon < 0) { if (line.trim()) warnings.push('Ignored an event property with no colon.'); continue; }
    const [name, ...paramsRaw] = line.slice(0, colon).split(/;(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/), params = {};
    for (const pair of paramsRaw) { const i = pair.indexOf('='); if (i > 0) params[pair.slice(0, i).toUpperCase()] = pair.slice(i + 1).replace(/^"|"$/g, ''); }
    (event[name.toUpperCase()] ||= []).push({ value: line.slice(colon + 1), params });
  }
  if (event) throw Error('An event is missing END:VEVENT.');
  if (!raw.length) throw Error('No VEVENT records were found in this calendar.');
  if (raw.length > 5000) throw Error('This file contains too many events. Export a smaller calendar (maximum 5,000 records).');
  const cancelledSeries = new Set(raw.filter(r=>r.STATUS?.[0]?.value==='CANCELLED'&&!r['RECURRENCE-ID']).map(r=>r.UID?.[0]?.value).filter(Boolean));
  const parsed = [];
  raw.forEach((r, index) => {
    const get = key => r[key]?.[0]?.value;
    const title = unescapeICS(get('SUMMARY') || 'Untitled event'), uid = get('UID') || `record-${index}-${get('DTSTART')}`;
    try {
      if(cancelledSeries.has(uid))return;
      const rid = r['RECURRENCE-ID']?.[0], cancelled = get('STATUS') === 'CANCELLED';
      if (cancelled && rid) { parsed.push({ uid, recurrenceId: parseICSDate(rid.value, rid.params).ms, cancelled: true }); return; }
      if (cancelled) return;
      if (!r.DTSTART) throw Error('Missing DTSTART.');
      const start = parseICSDate(r.DTSTART[0].value, r.DTSTART[0].params);
      const endField = r.DTEND?.[0]; let end;
      if(endField && get('DURATION')) throw Error('An event cannot contain both DTEND and DURATION.');
      if (endField) {
        const parsedEnd = parseICSDate(endField.value, endField.params);
        if (parsedEnd.allDay !== start.allDay) throw Error('DTSTART and DTEND must use the same date type.');
        end = parsedEnd.ms;
      } else if (get('DURATION')) end = start.ms + parseDuration(get('DURATION'));
      else if (start.allDay) {
        const next = addDays(`${start.parts[0]}-${String(start.parts[1]).padStart(2, '0')}-${String(start.parts[2]).padStart(2, '0')}`, 1);
        const [y, m, d] = next.split('-').map(Number); end = wallTime([y, m, d, 0, 0, 0], start.tz);
      } else end = start.ms;
      if (end < start.ms) throw Error('DTEND precedes DTSTART.');
      const duration = end - start.ms;
      let allDaySpan=0;
      if(start.allDay){
        if(endField){const p=parseICSDate(endField.value,endField.params).parts;allDaySpan=Math.round((Date.UTC(p[0],p[1]-1,p[2])-Date.UTC(start.parts[0],start.parts[1]-1,start.parts[2]))/DAY);}
        else {if(get('DURATION')&&(/T/.test(get('DURATION'))||duration%DAY))throw Error('All-day durations must use whole days or weeks.');allDaySpan=get('DURATION')?duration/DAY:1;}
        if(allDaySpan<1)throw Error('An all-day event must last at least one day.');
      }
      const occurrenceEnd=ms=>{
        if(!start.allDay)return ms+duration;
        const p=start.tz?partsInZone(ms,start.tz):{year:new Date(ms).getFullYear(),month:new Date(ms).getMonth()+1,day:new Date(ms).getDate()};
        const next=addDays(`${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`,allDaySpan);
        return wallTime([...next.split('-').map(Number),0,0,0],start.tz);
      };
      let starts = [start.ms];
      if (get('RRULE')) starts = recurrenceDates(start, get('RRULE'), warnings, title, options.horizonDays || 730);
      for (const extra of r.RDATE || []) for (const value of extra.value.split(',')) starts.push(parseICSDate(value, extra.params).ms);
      const excluded = new Set((r.EXDATE || []).flatMap(x => x.value.split(',').map(value => parseICSDate(value, x.params).ms)));
      const recurrenceId = rid ? parseICSDate(rid.value, rid.params).ms : null;
      for (const ms of new Set(starts)) if (!excluded.has(ms)) parsed.push({ id: `ics:${uid}:${ms}`, uid, title, location: unescapeICS(get('LOCATION')), notes: unescapeICS(get('DESCRIPTION')), start: ms, end: occurrenceEnd(ms), allDay: start.allDay, transparent: get('TRANSP') === 'TRANSPARENT', timezone: start.tz || 'Local / floating', recurrenceId, source: 'ics' });
    } catch (error) { warnings.push(`Skipped “${title}”: ${error.message}`); }
    if(parsed.length>5000) throw Error('Recurrence expansion exceeds 5,000 events. Export a smaller date range.');
  });
  const overrides = new Map(parsed.filter(e => e.recurrenceId != null).map(e => [`${e.uid}:${e.recurrenceId}`, e]));
  const unique = new Map();
  for (const e of parsed) {
    if (e.cancelled) continue;
    if (e.recurrenceId == null && overrides.has(`${e.uid}:${e.start}`)) continue;
    unique.set(`${e.uid}:${e.start}`, e);
  }
  const events = [...unique.values()].sort((a, b) => a.start - b.start || a.end - b.end);
  if (events.length > 5000) throw Error('Recurrence expansion exceeds 5,000 events. Export a smaller date range.');
  if (!events.length) throw Error(`No usable events were imported. ${warnings[0] || 'The calendar may contain only cancelled events.'}`);
  return { events, warnings: [...new Set(warnings)] };
}
function union(intervals) {
  const sorted = intervals.filter(x => x[1] > x[0]).sort((a, b) => a[0] - b[0]), out = [];
  for (const [s, e] of sorted) { const last = out.at(-1); if (last && s <= last[1]) last[1] = Math.max(last[1], e); else out.push([s, e]); }
  return out;
}
function midnight(key) { return +new Date(`${key}T00:00:00`); }
function overlapCount(events,lo,hi) {
  const heap=[];let count=0;
  const pop=()=>{const tail=heap.pop();if(!heap.length)return;heap[0]=tail;let i=0;while(true){let child=2*i+1;if(child>=heap.length)break;if(child+1<heap.length&&heap[child+1]<heap[child])child++;if(heap[i]<=heap[child])break;[heap[i],heap[child]]=[heap[child],heap[i]];i=child;}};
  for(const event of events){
    if(event.start>=hi)break;const start=Math.max(event.start,lo),end=Math.min(event.end,hi);if(end<=start)continue;
    while(heap.length&&heap[0]<=start)pop();count+=heap.length;
    heap.push(end);let i=heap.length-1;while(i>0){const parent=(i-1)>>1;if(heap[parent]<=heap[i])break;[heap[parent],heap[i]]=[heap[i],heap[parent]];i=parent;}
  }
  return count;
}
export function analyze(events, { from = '', to = '', mode = 'daily' } = {}) {
  if ((from && !isoDate(from)) || (to && !isoDate(to)) || (from && to && to < from)) throw Error('Choose valid dates, with the end on or after the start.');
  const lo = from ? midnight(from) : -Infinity, hi = to ? midnight(addDays(to, 1)) : Infinity;
  const selected = events.filter(e => e.end > lo && e.start < hi || e.start === e.end && e.start >= lo && e.start < hi).sort((a, b) => a.start - b.start);
  const busy = selected.filter(e => !e.transparent && e.end > e.start), conflicts = [];
  let conflictCount=0;const conflictLimit=10000;
  for (let i = 0; i < busy.length; i++) for (let j = i + 1; j < busy.length && busy[j].start < busy[i].end; j++) {
    const start = Math.max(busy[i].start, busy[j].start, lo), end = Math.min(busy[i].end, busy[j].end, hi);
    if (end > start) {conflictCount++;if(conflicts.length<conflictLimit)conflicts.push({ a: busy[i].id, b: busy[j].id, start, end, minutes: (end - start) / 60000 });}
  }
  const days = new Map();
  for (const event of selected) {
    const s = Math.max(event.start, lo), e = Math.min(event.end, hi);
    let key = localDate(s), last = localDate(Math.max(s, e - 1)), guard = 0;
    while (key <= last && guard++ < 3660) {
      if (!days.has(key)) days.set(key, { date: key, ids: new Set(), intervals: [] });
      const row = days.get(key); row.ids.add(event.id);
      if (!event.transparent) row.intervals.push([Math.max(s, midnight(key)), Math.min(e, midnight(addDays(key, 1)))]);
      key = addDays(key, 1);
    }
  }
  const summaries = new Map(), gaps = [];
  for (const day of [...days.values()].sort((a, b) => a.date.localeCompare(b.date))) {
    let key = day.date;
    if (mode === 'monthly') key = key.slice(0, 7);
    if (mode === 'weekly') { const wd = new Date(`${key}T12:00:00Z`).getUTCDay(); key = addDays(key, -((wd + 6) % 7)); }
    if (!summaries.has(key)) summaries.set(key, { period: key, ids: new Set(), busyMinutes: 0, conflicts: new Set() });
    const row = summaries.get(key), merged = union(day.intervals);
    day.ids.forEach(id => row.ids.add(id)); row.busyMinutes += merged.reduce((s, [a, b]) => s + (b - a) / 60000, 0);

    const workStart = +new Date(`${day.date}T09:00:00`), workEnd = +new Date(`${day.date}T18:00:00`);
    let cursor = Math.max(workStart, lo);
    for (const [a, b] of merged) { const start = Math.max(a, workStart, lo), end = Math.min(b, workEnd, hi); if (end <= start) continue; if (start > cursor) gaps.push({ date: day.date, start: cursor, end: start, minutes: (start - cursor) / 60000 }); cursor = Math.max(cursor, end); }
    const finalEnd = Math.min(workEnd, hi); if (cursor < finalEnd) gaps.push({ date: day.date, start: cursor, end: finalEnd, minutes: (finalEnd - cursor) / 60000 });
  }
  const intervals = union(busy.map(e => [Math.max(e.start, lo), Math.min(e.end, hi)]));
  const analysisWarnings=conflictCount>conflictLimit?[`There are ${conflictCount} conflict pairs. Detailed conflict rows are limited to ${conflictLimit}; all events and exact summary counts remain available. Narrow the date range for a smaller report.`]:[];
  return { selected, conflicts, conflictCount, analysisWarnings, gaps, busyMinutes: intervals.reduce((s, [a, b]) => s + (b - a) / 60000, 0), summaries: [...summaries.values()].map(r => ({ period: r.period, eventCount: r.ids.size, busyMinutes: r.busyMinutes, conflicts: overlapCount(busy,Math.max(lo,midnight(mode==='monthly'?r.period+'-01':r.period)),Math.min(hi,mode==='monthly'?+new Date(Number(r.period.slice(0,4)),Number(r.period.slice(5,7)),1):midnight(addDays(r.period,mode==='weekly'?7:1)))) })) };
}
export function tripEvents(trip) {
  return trip.activities.map(a => {
    const start = +new Date(`${a.date}T${a.time}:00`);
    return { id: `trip:${trip.id}:${a.id}`, uid: `${a.id}@praia-digital-apps`, title: `${trip.name} · ${a.title}`, location: a.location || trip.destination, notes: a.notes || '', start, end: start + a.duration * 60000, allDay: false, transparent: false, timezone: 'Local / floating', source: `trip:${trip.id}` };
  });
}
export function makeICS(events) {
  const stamp = date => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Praia Digital Apps//Case 684//EN', 'CALSCALE:GREGORIAN'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${escapeICS(e.uid || e.id)}`, `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end)}`, `SUMMARY:${escapeICS(e.title)}`, `LOCATION:${escapeICS(e.location)}`, `DESCRIPTION:${escapeICS(e.notes)}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(line => {
    let chunks = [], current = '', bytes = 0;
    for (const character of line) { const size = new TextEncoder().encode(character).length; if (bytes + size > 73) { chunks.push(current); current = ' '; bytes = 1; } current += character; bytes += size; }
    chunks.push(current); return chunks.join('\r\n');
  }).join('\r\n') + '\r\n';
}
