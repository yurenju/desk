// Shared data, theme, and primitives for all three directions.
// Reflects the user's workflow:
//   - Monthly: 3 big tasks + others. New tasks added mid-month carry an "unplanned" tag.
//   - Weekly: each day gets a theme + 3 priorities.
//   - Daily: theme + 3 things + all planned tasks.

// ────────────────────────────────────────────────────────────
// THEME — warm paper planner. Light is parchment-cream, dark is deep walnut.
// Accents share lightness/chroma; only hue varies (clay / sage / ink-blue).
// ────────────────────────────────────────────────────────────
// Accents share lightness/chroma; only hue varies. Hex is the value persisted
// via TweakColor; L/C/H are what the OKLCH theme builder consumes so each
// accent can carry its own depth (a deep forest vs. a pale sage need
// different L/C, not just hue).
const ACCENT_OPTIONS = [
  { name: 'sage',     hex: '#6FA77F', L: 0.66, C: 0.09, H: 150 }, // soft sage
  { name: 'forest',   hex: '#3F8754', L: 0.55, C: 0.13, H: 150 }, // deep forest
  { name: 'moss',     hex: '#5C9352', L: 0.60, C: 0.13, H: 135 }, // moss
  { name: 'olive',    hex: '#849A4D', L: 0.64, C: 0.11, H: 115 }, // olive yellow-green
  { name: 'eucalypt', hex: '#5DA192', L: 0.65, C: 0.08, H: 180 }, // eucalypt blue-green
  { name: 'pine',     hex: '#3D7A6B', L: 0.50, C: 0.08, H: 175 }, // pine teal
  // warm fallback if you ever want to step away from greens
  { name: 'clay',     hex: '#C56B47', L: 0.62, C: 0.13, H:  28 },
];

function buildTheme(mode, accentHex) {
  const opt = ACCENT_OPTIONS.find((o) => (o.hex || '').toLowerCase() === String(accentHex || '').toLowerCase())
    || ACCENT_OPTIONS[0];
  const { L, C, H } = opt;
  const dark = mode === 'dark';
  return {
    mode,
    accent: `oklch(${L} ${C} ${H})`,
    accentSoft: dark
      ? `oklch(0.30 ${Math.min(0.08, C * 0.7).toFixed(3)} ${H})`
      : `oklch(0.93 ${Math.min(0.05, C * 0.45).toFixed(3)} ${H})`,
    accentText: dark
      ? `oklch(0.82 ${Math.min(0.10, C * 0.85).toFixed(3)} ${H})`
      : `oklch(${Math.max(0.34, L - 0.18).toFixed(3)} ${C} ${H})`,
    // Unplanned chip is intentionally hot — always warm red-orange regardless of accent.
    flag: dark ? 'oklch(0.70 0.16 35)' : 'oklch(0.58 0.18 32)',
    flagSoft: dark ? 'oklch(0.32 0.10 35)' : 'oklch(0.93 0.08 35)',
    // Paper-warm neutrals
    paper:    dark ? 'oklch(0.20 0.012 60)'  : 'oklch(0.965 0.018 78)',
    paperAlt: dark ? 'oklch(0.235 0.013 60)' : 'oklch(0.935 0.022 78)',
    paperEdge:dark ? 'oklch(0.27 0.013 60)'  : 'oklch(0.895 0.026 78)',
    ink:      dark ? 'oklch(0.92 0.02 78)'   : 'oklch(0.24 0.018 50)',
    inkSoft:  dark ? 'oklch(0.74 0.015 70)'  : 'oklch(0.46 0.018 55)',
    inkFaint: dark ? 'oklch(0.55 0.012 70)'  : 'oklch(0.62 0.018 60)',
    rule:     dark ? 'oklch(0.34 0.013 60)'  : 'oklch(0.85 0.025 75)',
    ruleFaint:dark ? 'oklch(0.28 0.013 60)'  : 'oklch(0.90 0.020 75)',
    // Carryover: a dusty amber kept clearly distinct from the (green) accent
    // and the (red-orange) flag. Used for "從上週期延續" UI so the eye doesn't
    // confuse "needs review" with "important right now".
    carryBg:   dark ? 'oklch(0.28 0.025 75)' : 'oklch(0.94 0.035 80)',
    carryBg2:  dark ? 'oklch(0.32 0.030 75)' : 'oklch(0.90 0.045 80)',
    carryEdge: dark ? 'oklch(0.42 0.045 75)' : 'oklch(0.78 0.060 75)',
    carryText: dark ? 'oklch(0.80 0.060 75)' : 'oklch(0.42 0.070 70)',
    headSerif: '"Newsreader", "Noto Serif TC", "Source Serif 4", Georgia, serif',
    bodySans:  '"Geist", "Noto Sans TC", "Inter", -apple-system, system-ui, sans-serif',
    mono:      '"Geist Mono", "JetBrains Mono", ui-monospace, monospace',
    hand:      '"Caveat", "Comic Sans MS", cursive',
  };
}

// ────────────────────────────────────────────────────────────
// MOCK DATA — May 2026, week of 5/18–5/24, today is Fri 5/22.
// ────────────────────────────────────────────────────────────
const MONTH_LABEL = 'May 2026';
const TODAY = { date: 5, dateOf: 22, weekday: '五', weekdayFull: 'Friday', iso: '2026-05-22' };

const MONTHLY_TOP3 = [
  { id: 'm1', n: 1, title: '推出 desk.yurenju.me MVP', sub: 'todo · 日曆 · mail 三合一', done: false, progress: 0.65 },
  { id: 'm2', n: 2, title: '完成個人簡歷網站改版', sub: '新 portfolio + 寫作分類', done: false, progress: 0.40 },
  { id: 'm3', n: 3, title: '寫完 WSPC 整合技術筆記', sub: '含 custom fields 範例', done: false, progress: 0.20 },
];

const MONTHLY_OTHER = [
  // doneOn: which day in May the item was checked off. Surfaced as a "· 5/18"
  // suffix in the monthly row so the day a finished task got done is visible
  // in the month digest.
  { id: 'm4', title: '整理 2026 Q2 OKR', done: true, planned: true, doneOn: 5 },
  { id: 'm5', title: '讀完《Deep Work》最後三章', done: false, planned: true },
  { id: 'm6', title: '規劃 7 月家庭旅行行程', done: false, planned: true },
  { id: 'm7', title: '部落格更新 2 篇', done: false, planned: true, progress: 0.5, sub: '1 / 2' },
  { id: 'm8', title: '健身：每週 3 次', done: false, planned: true, sub: '本月 9 / 12 次' },
  { id: 'm9', title: '修復 yurenju.me 部署 bug',  done: true,  planned: false, doneOn: 19 },
  { id: 'm10', title: '回覆 Acme 客戶整合詢問',   done: false, planned: false },
  { id: 'm11', title: '幫 J 看履歷',              done: false, planned: false },
];

const WEEK_LABEL = '第 21 週 · 5/18 – 5/24';
const WEEK_DAYS = [
  { i:0, d:18, w:'一', wf:'Mon', theme:'WSPC API 串接',          top3:['打通 todo CRUD','釐清 custom fields','寫 e2e smoke'], done:true },
  { i:1, d:19, w:'二', wf:'Tue', theme:'UI 設計與切版',          top3:['月/週/日骨架','warm theme tokens','rough mobile'], done:true },
  { i:2, d:20, w:'三', wf:'Wed', theme:'Email 整合 spike',        top3:['調查 IMAP gateway','收件人列表 UX','成本評估'], done:true },
  { i:3, d:21, w:'四', wf:'Thu', theme:'部落格寫作日',           top3:['草稿：BFF 架構','編輯：WSPC 心得','排版＋發布 1 篇'], done:true },
  { i:4, d:22, w:'五', wf:'Fri', theme:'內部 demo + retro',       top3:['todo MVP demo','寫週報＋月中檢視','retro：整理本週學習'], done:false, today:true },
  { i:5, d:23, w:'六', wf:'Sat', theme:'家庭日',                  top3:['公園野餐','陪 K 練琴','晚餐 cook 一道新菜'], done:false },
  { i:6, d:24, w:'日', wf:'Sun', theme:'規劃下週',                top3:['週計畫','本週回顧','靜心讀書 1 hr'], done:false },
];

const TODAY_THEME = '內部 demo + retro';
const TODAY_TOP3 = [
  { id: 't1', title: '完成 desk.yurenju.me todo MVP demo',   tag: 'm1', done: false },
  { id: 't2', title: '寫週報 + 5 月中檢視',                  tag: null, done: false },
  { id: 't3', title: 'retro：整理本週學習＋下週主題',         tag: null, done: false },
];

const TODAY_OTHER = [
  { id: 't4', title: '1 hr 健身',                             planned: true,  done: true,  tag: 'm8' },
  { id: 't5', title: '收件匣 → inbox zero',                   planned: true,  done: false },
  { id: 't6', title: '讀 WSPC custom fields 文件',            planned: true,  done: false, tag: 'm3' },
  { id: 't7', title: '回覆 Acme 客戶整合詢問',                planned: false, done: false },
  { id: 't8', title: '預約下週牙醫',                          planned: false, done: false },
];

// ────────────────────────────────────────────────────────────
// CARRYOVER — what spilled over from the previous day / week / month.
// These power the "從昨天/上週/上月延續" UI shown at cycle boundaries.
// Each item carries enough context for the user to decide: move forward,
// reschedule, or drop.
// ────────────────────────────────────────────────────────────
const YESTERDAY = { d: 21, w: '四', wf: 'Thu', theme: '部落格寫作日' };
const YESTERDAY_LEFTOVER = [
  { id: 'y1', title: '編輯：WSPC 心得',         fromTop3: true,  was: '昨天的第 2 件事' },
  { id: 'y2', title: '排版 ＋ 發布 1 篇文章',   fromTop3: true,  was: '昨天的第 3 件事' },
  { id: 'y3', title: '整理桌面與檔案',          fromTop3: false, was: '昨天計劃內' },
];

const LAST_WEEK = { label: '第 20 週 · 5/11 – 5/17' };
const LAST_WEEK_LEFTOVER = [
  { id: 'lw1', title: '寫 newsletter 4 月號草稿',  planned: true,  fromDay: '週四' },
  { id: 'lw2', title: '回覆 ABC 客戶的報價問題',   planned: false, fromDay: '週五（計劃外）' },
];

const LAST_MONTH = { label: 'April 2026' };
const LAST_MONTH_LEFTOVER = [
  { id: 'lm1', title: '更新個人簡歷 PDF',          planned: true,  was: '上月計劃內' },
  { id: 'lm2', title: '寫 2026 Q1 年度回顧',       planned: true,  was: '上月計劃內' },
];

// ────────────────────────────────────────────────────────────
// Shared primitives
// ────────────────────────────────────────────────────────────

// One-time CSS for task row hover affordance (chips/menu reveal on hover).
if (typeof document !== 'undefined' && !document.getElementById('desk-row-styles')) {
  const s = document.createElement('style');
  s.id = 'desk-row-styles';
  s.textContent = [
    '.tr{position:relative}',
    '.tr .tr-actions{opacity:0;transition:opacity .15s}',
    '.tr:hover .tr-actions,.tr.tr-menu-open .tr-actions{opacity:1}',
    '.desk-menu-btn:hover{background:var(--desk-hover, rgba(0,0,0,0.05))}',
  ].join('\n');
  document.head.appendChild(s);
}

// DeskLogo — small ring-bound notebook mark + wordmark in headSerif.
// Sized via `size` (target wordmark height in px). Two simple shapes only.
// DeskLogo — ruled-paper notebook mark. The notebook itself is always cream
// (a real notebook doesn't turn dark in dark mode), with the iconic red margin
// line and three binder holes. Colors are hardcoded so the mark stays
// recognisable across themes and accents.
function DeskLogo({ t, size = 22, color, showWord = true, compact = false }) {
  const c = color || t.ink;
  const markSize = Math.round(size * 1.05);
  const PAPER = '#FBF5E6';
  const EDGE  = 'rgba(45, 36, 24, 0.28)';
  const HOLE  = 'rgba(45, 36, 24, 0.38)';
  const MARGIN = '#C5483A';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: compact ? 6 : 9, lineHeight: 1 }}>
      <svg width={markSize} height={markSize} viewBox="0 0 24 24" aria-hidden style={{ flex: '0 0 auto' }}>
        {/* cream paper body */}
        <rect x="4.5" y="3" width="15" height="18" rx="1.6" fill={PAPER} stroke={EDGE} strokeWidth="1" />
        {/* classic red margin line */}
        <line x1="9.2" y1="3.8" x2="9.2" y2="20.2" stroke={MARGIN} strokeWidth="0.7" />
        {/* 3 binder holes along the left edge */}
        <circle cx="6.4" cy="7"   r="0.85" fill={HOLE} />
        <circle cx="6.4" cy="12"  r="0.85" fill={HOLE} />
        <circle cx="6.4" cy="17"  r="0.85" fill={HOLE} />
      </svg>
      {showWord && (
        <span style={{
          fontFamily: t.headSerif, fontSize: size * 1.18,
          fontWeight: 500, letterSpacing: -0.6,
          color: c, lineHeight: 1,
        }}>desk</span>
      )}
    </span>
  );
}

function PaperTexture({ opacity = 0.5 }) {
  // Subtle SVG fibre noise for paper feel. Inline so it works offline.
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.07 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`;
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', opacity,
      backgroundImage: `url("data:image/svg+xml;utf8,${svg.replace(/#/g, '%23')}")`,
      mixBlendMode: 'multiply',
    }} />
  );
}

function Checkbox({ checked, onClick, t, size = 18, accent = false, hand = true }) {
  return (
    <button onClick={onClick} aria-pressed={checked}
      style={{
        flex: '0 0 auto',
        width: size, height: size, padding: 0,
        border: `1.5px solid ${checked ? (accent ? t.accent : t.inkSoft) : t.inkSoft}`,
        background: checked ? (accent ? t.accent : t.inkSoft) : 'transparent',
        borderRadius: size <= 16 ? 4 : 5, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: t.paper, transition: 'all .15s',
      }}>
      {checked && (hand ? (
        <span style={{ fontFamily: t.hand, fontSize: size * 1.1, lineHeight: 1, color: t.paper, transform: 'translate(0,-1px) rotate(-8deg)' }}>✓</span>
      ) : (
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 5l2.5 2.5L8.5 2.5"/></svg>
      ))}
    </button>
  );
}

function Chip({ children, t, color, soft, small }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: small ? '1px 6px' : '2px 8px',
      borderRadius: 999,
      fontSize: small ? 10 : 11,
      fontWeight: 600,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
      fontFamily: t.bodySans,
      color, background: soft, whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

function UnplannedChip({ t, small }) {
  return <Chip t={t} color={t.flag} soft={t.flagSoft} small={small}>＋ 計劃外</Chip>;
}

function PlannedRefChip({ t, n, small }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: small ? 14 : 16, height: small ? 14 : 16,
      borderRadius: 4, fontFamily: t.mono, fontSize: small ? 9 : 10, fontWeight: 600,
      background: t.accentSoft, color: t.accentText,
    }}>{n}</span>
  );
}

// Hairline progress bar
function ProgressBar({ t, value, color }) {
  return (
    <div style={{ height: 3, borderRadius: 2, background: t.rule, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.round(value * 100)}%`, background: color || t.accent, transition: 'width .3s' }} />
    </div>
  );
}

// RowMenu — small hover-revealed kebab on the right of a task row.
// Click opens a tiny popover with row actions. The parent row must have
// className "tr" (defined in the injected stylesheet above) so the
// .tr-actions reveal CSS applies.
function RowMenu({ t, planned, onTogglePlanned, onDelete }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const off = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', off, true);
    return () => document.removeEventListener('pointerdown', off, true);
  }, [open]);
  // Stamp parent row's className when menu is open so the kebab stays
  // visible after pointer leaves (matches .tr.tr-menu-open in stylesheet).
  React.useEffect(() => {
    const el = ref.current && ref.current.closest('.tr');
    if (!el) return;
    el.classList.toggle('tr-menu-open', open);
    return () => el.classList.remove('tr-menu-open');
  }, [open]);
  return (
    <div ref={ref} className="tr-actions" style={{ position: 'relative', flex: '0 0 auto' }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} aria-label="任務動作"
        style={{
          width: 22, height: 22, padding: 0,
          border: 'none', background: 'transparent',
          color: t.inkSoft, cursor: 'pointer', borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = t.paperEdge)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
          <circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/><circle cx="11" cy="7" r="1.2"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          minWidth: 160, padding: 4,
          background: t.paper, border: `1px solid ${t.rule}`,
          borderRadius: 6, boxShadow: '0 8px 24px oklch(0 0 0 / 0.12)',
          zIndex: 20,
        }}>
          <button onClick={() => { setOpen(false); onTogglePlanned(); }} style={menuBtnStyle(t)}>
            {planned ? '改為計劃外' : '改為計劃內'}
            <span style={{ marginLeft: 'auto', fontFamily: t.mono, fontSize: 10, color: t.inkFaint }}>
              {planned ? '→' : '←'}
            </span>
          </button>
          {onDelete && (
            <>
              <hr style={{ border: 0, borderTop: `1px solid ${t.ruleFaint}`, margin: '4px 2px' }} />
              <button onClick={() => { setOpen(false); onDelete(); }} style={{ ...menuBtnStyle(t), color: t.flag }}>
                刪除
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function menuBtnStyle(t) {
  return {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '7px 10px',
    border: 0, background: 'transparent',
    fontFamily: t.bodySans, fontSize: 12.5, fontWeight: 500,
    color: t.ink, textAlign: 'left', cursor: 'pointer',
    borderRadius: 4, transition: 'background .12s',
  };
}

// Find the monthly task referenced by a daily task's tag
function monthRef(tag) {
  if (!tag) return null;
  const top = MONTHLY_TOP3.find((m) => m.id === tag);
  if (top) return { n: top.n, title: top.title };
  const oth = MONTHLY_OTHER.find((m) => m.id === tag);
  return oth ? { n: null, title: oth.title } : null;
}

Object.assign(window, {
  ACCENT_OPTIONS, buildTheme, MONTH_LABEL, TODAY,
  MONTHLY_TOP3, MONTHLY_OTHER, WEEK_LABEL, WEEK_DAYS,
  TODAY_THEME, TODAY_TOP3, TODAY_OTHER,
  YESTERDAY, YESTERDAY_LEFTOVER,
  LAST_WEEK, LAST_WEEK_LEFTOVER, LAST_MONTH, LAST_MONTH_LEFTOVER,
  PaperTexture, Checkbox, Chip, UnplannedChip, PlannedRefChip, ProgressBar, monthRef,
  DeskLogo, RowMenu,
});
