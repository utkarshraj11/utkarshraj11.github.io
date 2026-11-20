// What I'm up to, by Riverside local time. Edit the labels, frames and the hours in whatAmIDoing().
const TYPED = '$ git push';

export interface Status { label: string; ms: number; still: number; frames: string[] }

export const STATUS = {
  asleep: { label: 'asleep', ms: 520, still: 2, frames: ['z  ', 'zZ ', 'zZz', ' Zz', '  z', '   '] },
  coffee: { label: 'making coffee', ms: 380, still: 1, frames: ['c[_]   ', 'c[_] ~ ', 'c[_] ~~', 'c[_]  ~'] },
  working: {
    label: 'at the keyboard',
    ms: 170,
    still: 13,
    frames: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 10, 10].map((n, i) => (TYPED.slice(0, n) + (i > 8 && i % 2 ? ' ' : '▍')).padEnd(TYPED.length + 1)),
  },
  off: { label: 'off the clock', ms: 300, still: 2, frames: ['~    ', ' ~   ', '  ~  ', '   ~ ', '    ~', '   ~ ', '  ~  ', ' ~   '] },
} satisfies Record<string, Status>;

const whatAmIDoing = (hour: number, weekend: boolean): keyof typeof STATUS =>
  hour < 8 ? 'asleep' : hour < 9 ? 'coffee' : !weekend && hour < 19 ? 'working' : 'off';

const RIVERSIDE = 'America/Los_Angeles';
let timeFmt: Intl.DateTimeFormat | null = null;
let partsFmt: Intl.DateTimeFormat | null = null;
try {
  timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: RIVERSIDE, hour: 'numeric', minute: '2-digit' });
  partsFmt = new Intl.DateTimeFormat('en-US', { timeZone: RIVERSIDE, hour: 'numeric', hourCycle: 'h23', weekday: 'short' });
} catch { /* fall back to local time below */ }

export function readStatus(still: boolean) {
  const now = new Date();
  let hour = now.getHours(), weekend = now.getDay() % 6 === 0, time: string;
  if (timeFmt && partsFmt) {
    time = timeFmt.format(now);
    const parts = partsFmt.formatToParts(now);
    hour = +(parts.find(p => p.type === 'hour')?.value ?? hour);
    weekend = /Sat|Sun/.test(parts.find(p => p.type === 'weekday')?.value ?? '');
  } else {
    time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const s: Status = STATUS[whatAmIDoing(hour, weekend)];
  const frame = s.frames[still ? s.still : Math.floor(performance.now() / s.ms) % s.frames.length];
  return { clock: time + ' in Riverside, CA', label: s.label, frame };
}
