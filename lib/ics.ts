// lib/ics.ts
// lib/ics.ts
type IcsOpts = {
  title: string;
  start: Date;             // event start
  end?: Date;              // optional end (defaults +2h)
  description?: string;
  location?: string;
  url?: string;
  organizerName?: string;  // for invites
  organizerEmail?: string; // "mailto:" will be added
  uid?: string;            // if omitted we generate one
  method?: 'PUBLISH' | 'REQUEST'; // PUBLISH = add-to-calendar, REQUEST = meeting invite
  tzid?: 'UTC' | 'Asia/Dubai';    // default Asia/Dubai for you
  alarmMinutesBefore?: number;    // default 60
};

export function buildIcs({
  title,
  start,
  end,
  description = '',
  location = '',
  url,
  organizerName,
  organizerEmail,
  uid,
  method = 'PUBLISH',
  tzid = 'Asia/Dubai',
  alarmMinutesBefore = 60,
}: IcsOpts) {
  // helper: CRLF + 75-byte folding (simple but effective)
  const fold = (s: string) =>
    s.replace(/(.{1,73})(?=.)/g, (m, p1, offset) => (offset + p1.length < s.length ? p1 + '\r\n ' : p1));

  const dtstampUtc = toUtcBasic(new Date());
  const _uid = uid || `${Date.now()}-${Math.random().toString(36).slice(2)}@invitation-app`;

  const dtStart = tzid === 'UTC' ? `DTSTART:${toUtcBasic(start)}` : `DTSTART;TZID=${tzid}:${toLocalBasic(start, tzid)}`;
  const _end = end ?? new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const dtEnd = tzid === 'UTC' ? `DTEND:${toUtcBasic(_end)}` : `DTEND;TZID=${tzid}:${toLocalBasic(_end, tzid)}`;

  const lines: string[] = [];
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//Invitation App//EN');
  lines.push(`METHOD:${method}`); // PUBLISH (info) or REQUEST (invite)
  if (tzid === 'Asia/Dubai') lines.push(...VTIMEZONE_ASIA_DUBAI); // no DST, safe to embed

  lines.push('BEGIN:VEVENT');
  lines.push(`UID:${_uid}`);
  lines.push(`DTSTAMP:${dtstampUtc}`);
  lines.push(dtStart);
  lines.push(dtEnd);
  lines.push(`SUMMARY:${escapeIcs(title)}`);
  if (location) lines.push(`LOCATION:${escapeIcs(location)}`);
  if (description) lines.push(`DESCRIPTION:${escapeIcs(description)}`);
  if (url) lines.push(`URL:${escapeIcs(url)}`);
  lines.push('STATUS:CONFIRMED');
  if (organizerEmail) {
    const cn = organizerName ? `;CN=${escapeIcs(organizerName)}` : '';
    lines.push(`ORGANIZER${cn}:mailto:${organizerEmail}`);
  }
  if (alarmMinutesBefore > 0) {
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:${escapeIcs(title)}`);
    lines.push(`TRIGGER:-PT${Math.max(1, Math.floor(alarmMinutesBefore))}M`);
    lines.push('END:VALARM');
  }
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  // fold + CRLF
  return lines.map(fold).join('\r\n') + '\r\n';
}

// --- helpers ---
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function toUtcBasic(d: Date) {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) + 'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) + 'Z'
  );
}
function toLocalBasic(d: Date, tzid: 'Asia/Dubai' | 'UTC') {
  if (tzid === 'UTC') return toUtcBasic(d).replace(/Z$/, '');
  // Asia/Dubai = UTC+4 fixed (no DST)
  const local = new Date(d.getTime() + 4 * 60 * 60 * 1000);
  return (
    local.getUTCFullYear().toString() +
    pad(local.getUTCMonth() + 1) +
    pad(local.getUTCDate()) + 'T' +
    pad(local.getUTCHours()) +
    pad(local.getUTCMinutes()) +
    pad(local.getUTCSeconds())
  );
}

function escapeIcs(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// Minimal VTIMEZONE for Asia/Dubai (no DST)
const VTIMEZONE_ASIA_DUBAI = [
  'BEGIN:VTIMEZONE',
  'TZID:Asia/Dubai',
  'TZURL:http://tzurl.org/zoneinfo-outlook/Asia/Dubai',
  'X-LIC-LOCATION:Asia/Dubai',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0400',
  'TZOFFSETTO:+0400',
  'TZNAME:GST',
  'DTSTART:19700101T000000',
  'END:STANDARD',
  'END:VTIMEZONE',
];
