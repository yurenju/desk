// Direction 1: "Paper Planner" — three-pane parchment desk.
// Month / Week / Today laid out side-by-side like an open spread.
// Warm paper texture, edged like real planner pages, with subtle
// chrome that gets out of the way.

function Direction1({ t, mode }) {
  const [todayTop3, setTodayTop3] = React.useState(TODAY_TOP3);
  const [todayOther, setTodayOther] = React.useState(TODAY_OTHER);
  const [monthly, setMonthly] = React.useState(MONTHLY_OTHER);
  const [monthlyTop3, setMonthlyTop3] = React.useState(MONTHLY_TOP3);

  const toggleTop3 = (id) => setTodayTop3((xs) => xs.map((x) => x.id === id ? { ...x, done: !x.done } : x));
  const toggleOther = (id) => setTodayOther((xs) => xs.map((x) => x.id === id ? { ...x, done: !x.done } : x));
  const toggleMonthly = (id) => setMonthly((xs) => xs.map((x) => x.id === id ? { ...x, done: !x.done, doneOn: !x.done ? TODAY.dateOf : undefined } : x));
  const toggleMonthlyTop3 = (id) => setMonthlyTop3((xs) => xs.map((x) => x.id === id ? { ...x, done: !x.done, doneOn: !x.done ? TODAY.dateOf : undefined } : x));

  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      background: t.paperEdge,
      fontFamily: t.bodySans,
      color: t.ink,
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <D1Header t={t} />
      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: '0.95fr 1.15fr 1.2fr',
        gap: 18, padding: '14px 22px 22px',
        minHeight: 0,
      }}>
        <D1MonthPane t={t} top3={monthlyTop3} other={monthly} onToggleTop3={toggleMonthlyTop3} onToggleOther={toggleMonthly} />
        <D1WeekPane t={t} />
        <D1TodayPane t={t} top3={todayTop3} other={todayOther} onToggleTop3={toggleTop3} onToggleOther={toggleOther} />
      </div>
    </div>
  );
}

function D1Header({ t }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 24,
      padding: '20px 26px 6px',
      borderBottom: `1px solid ${t.ruleFaint}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <DeskLogo t={t} size={22} />
        <span style={{ fontFamily: t.mono, fontSize: 11, color: t.inkFaint, letterSpacing: 0.5 }}>desk.yurenju.me</span>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, fontFamily: t.bodySans, fontSize: 13, color: t.inkSoft }}>
        <span style={{ fontFamily: t.headSerif, fontSize: 15, color: t.ink }}>
          Friday, May 22 · 第 21 週
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: t.accent }} />
          連線中
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Month pane
// ─────────────────────────────────────────────────────────────
function D1MonthPane({ t, top3, other, onToggleTop3, onToggleOther }) {
  const plannedTotal = top3.length + other.filter((o) => o.planned).length;
  const plannedDone = top3.filter((o) => o.done).length + other.filter((o) => o.planned && o.done).length;
  const unplanned = other.filter((o) => !o.planned);

  return (
    <D1Page t={t} eyebrow="MONTH" title="May 2026"
      meta={<span>{plannedDone}/{plannedTotal} 計劃內任務 · {unplanned.length} 件計劃外</span>}>
      <div style={{ fontFamily: t.headSerif, fontSize: 14, color: t.inkSoft, marginBottom: 10 }}>
        本月最重要的三件事
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
        {top3.map((m) => (
          <D1HeroCard key={m.id} t={t} m={m} onToggle={onToggleTop3 ? () => onToggleTop3(m.id) : undefined} />
        ))}
      </div>

      <D1Divider t={t} label="其他計劃內" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8, marginBottom: 18 }}>
        {other.filter((o) => o.planned).map((o) => (
          <D1MonthRow key={o.id} t={t} item={o} onToggle={() => onToggleOther(o.id)} />
        ))}
      </div>

      <D1Divider t={t} label="計劃外" accent />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
        {unplanned.map((o) => (
          <D1MonthRow key={o.id} t={t} item={o} onToggle={() => onToggleOther(o.id)} unplanned />
        ))}
        <button style={{
          marginTop: 4, padding: '6px 8px', border: 'none', background: 'transparent',
          color: t.inkFaint, fontFamily: t.bodySans, fontSize: 12, textAlign: 'left', cursor: 'pointer',
          borderRadius: 4,
        }}>＋ 新增任務（會自動標為計劃外）</button>
      </div>
    </D1Page>
  );
}

function D1HeroCard({ t, m, onToggle }) {
  const done = !!m.done;
  return (
    <div style={{
      position: 'relative',
      padding: '12px 14px 14px 50px',
      background: t.paper,
      border: `1px solid ${done ? t.ruleFaint : t.rule}`,
      borderRadius: 3,
      boxShadow: done ? 'none' : `0 1px 0 ${t.rule}`,
    }}>
      <div style={{
        position: 'absolute', left: 12, top: 12,
        width: 28, height: 28, borderRadius: 16,
        background: done ? t.paperEdge : t.accent,
        color: done ? t.inkFaint : t.paper,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: t.headSerif, fontSize: done ? 14 : 17, fontWeight: 600,
        boxShadow: done ? 'none' : `0 1px 0 oklch(0 0 0 / 0.1)`,
      }}>{done ? '✓' : m.n}</div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 600,
            color: done ? t.inkFaint : t.ink,
            lineHeight: 1.3, marginBottom: 2,
            textDecoration: done ? 'line-through' : 'none',
            textDecorationColor: t.inkFaint,
          }}>{m.title}</div>
          <div style={{ fontSize: 11.5, color: t.inkFaint }}>
            {m.sub}
            {done && m.doneOn && (
              <span style={{ fontFamily: t.mono, fontSize: 10.5, marginLeft: 8 }}>· 完成 5/{m.doneOn}</span>
            )}
          </div>
        </div>
        {onToggle && (
          <div style={{ marginTop: 1 }}>
            <Checkbox checked={done} onClick={onToggle} t={t} size={17} accent />
          </div>
        )}
      </div>
    </div>
  );
}

function D1MonthRow({ t, item, onToggle, onTogglePlanned, unplanned }) {
  return (
    <div className="tr" style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '5px 4px',
    }}>
      <Checkbox checked={item.done} onClick={onToggle} t={t} size={15} />
      <span style={{
        flex: 1, fontSize: 13, color: item.done ? t.inkFaint : t.ink,
        textDecoration: item.done ? 'line-through' : 'none',
        textDecorationColor: t.inkFaint,
      }}>
        {item.title}
        {item.sub && <span style={{ color: t.inkFaint, marginLeft: 8, fontSize: 11, textDecoration: 'none' }}>· {item.sub}</span>}
        {item.done && item.doneOn && (
          <span style={{
            color: t.inkFaint, marginLeft: 8, fontSize: 10.5, fontFamily: t.mono,
            textDecoration: 'none',
          }}>✓ 5/{item.doneOn}</span>
        )}
      </span>
      {unplanned && <UnplannedChip t={t} small />}
      {onTogglePlanned && <RowMenu t={t} planned={!unplanned} onTogglePlanned={onTogglePlanned} />}
    </div>
  );
}

// (ContribDays removed — day-dot grid was too noisy. Top 3 completion is now
// shown via a checkbox + check state on the card, monthly other items via
// the doneOn date suffix.)

// ─────────────────────────────────────────────────────────────
// Week pane
// ─────────────────────────────────────────────────────────────
function D1WeekPane({ t }) {
  return (
    <D1Page t={t} eyebrow="WEEK" title="第 21 週" meta={<span>5/18 — 5/24 · 5 個主題排定</span>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {WEEK_DAYS.map((day) => <D1WeekRow key={day.i} t={t} day={day} />)}
      </div>
    </D1Page>
  );
}

function D1WeekRow({ t, day }) {
  const isToday = day.today;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '46px 1fr',
      gap: 12, padding: '7px 8px 8px',
      background: isToday ? t.accentSoft : 'transparent',
      borderRadius: 4,
      border: isToday ? `1px solid ${t.accent}` : `1px solid transparent`,
      position: 'relative',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
        paddingTop: 1,
      }}>
        <div style={{
          fontFamily: t.headSerif, fontSize: 22, fontWeight: 500, color: isToday ? t.accentText : t.ink,
          letterSpacing: -0.5, lineHeight: 1,
        }}>{day.d}</div>
        <div style={{ fontFamily: t.bodySans, fontSize: 10, color: isToday ? t.accentText : t.inkFaint, marginTop: 2, fontWeight: 600, letterSpacing: 0.5 }}>{day.wf.toUpperCase()}</div>
      </div>
      <div>
        {isToday && <div style={{ fontFamily: t.mono, fontSize: 10, color: t.accentText, fontWeight: 600, marginBottom: 4 }}>今天</div>}
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {day.top3.map((tt, i) => (
            <li key={i} style={{
              fontSize: 12.5, color: day.done ? t.inkFaint : (isToday ? t.ink : t.inkSoft),
              padding: '2px 0', display: 'flex', gap: 6, lineHeight: 1.35,
            }}>
              <span style={{ fontFamily: t.mono, fontSize: 10, color: t.inkFaint, width: 12 }}>{i + 1}.</span>
              <span style={{
                textDecoration: day.done ? 'line-through' : 'none',
                textDecorationColor: t.inkFaint,
              }}>{tt}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Today pane
// ─────────────────────────────────────────────────────────────
function D1TodayPane({ t, top3, other, onToggleTop3, onToggleOther }) {
  return (
    <D1Page t={t} eyebrow="TODAY · 五" title="May 22" meta={<span style={{ fontFamily: t.headSerif, }}>{TODAY_THEME}</span>}>
      <div style={{
        marginBottom: 18, padding: '14px 16px',
        background: t.accentSoft, border: `1px solid ${t.accent}`,
        borderRadius: 3, position: 'relative',
      }}>
        <div style={{ fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: t.accentText, marginBottom: 8 }}>
          今天的三件事
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {top3.map((task, i) => {
            const ref = monthRef(task.tag);
            return (
              <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{
                  flex: '0 0 auto', width: 22, height: 22, borderRadius: 12,
                  background: t.paper, color: t.accentText,
                  border: `1.5px solid ${t.accent}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: t.headSerif, fontWeight: 600, fontSize: 13,
                }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 500, color: task.done ? t.inkFaint : t.ink,
                    lineHeight: 1.35, marginBottom: 2,
                    textDecoration: task.done ? 'line-through' : 'none',
                  }}>{task.title}</div>
                  {ref && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: t.inkSoft }}>
                      {ref.n && <PlannedRefChip t={t} n={ref.n} small />}
                      <span>{ref.title}</span>
                    </div>
                  )}
                </div>
                <Checkbox checked={task.done} onClick={() => onToggleTop3(task.id)} t={t} size={18} accent />
              </div>
            );
          })}
        </div>
      </div>

      <D1Divider t={t} label="其他計劃內" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8, marginBottom: 18 }}>
        {other.filter((o) => o.planned).map((o) => (
          <D1TodayRow key={o.id} t={t} item={o} onToggle={() => onToggleOther(o.id)} />
        ))}
      </div>

      <D1Divider t={t} label="今天臨時加的" accent />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
        {other.filter((o) => !o.planned).map((o) => (
          <D1TodayRow key={o.id} t={t} item={o} onToggle={() => onToggleOther(o.id)} unplanned />
        ))}
        <button style={{
          marginTop: 4, padding: '6px 8px', border: 'none', background: 'transparent',
          color: t.inkFaint, fontFamily: t.bodySans, fontSize: 12, textAlign: 'left', cursor: 'pointer',
          borderRadius: 4,
        }}>＋ 加一件今天的事</button>
      </div>
    </D1Page>
  );
}

function D1TodayRow({ t, item, onToggle, onTogglePlanned, unplanned }) {
  const ref = monthRef(item.tag);
  return (
    <div className="tr" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', minWidth: 0 }}>
      <Checkbox checked={item.done} onClick={onToggle} t={t} size={15} />
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: 13, color: item.done ? t.inkFaint : t.ink,
        textDecoration: item.done ? 'line-through' : 'none', textDecorationColor: t.inkFaint,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{item.title}</span>
        {ref && ref.n && <PlannedRefChip t={t} n={ref.n} small />}
      </span>
      {unplanned && <UnplannedChip t={t} small />}
      {onTogglePlanned && <RowMenu t={t} planned={!unplanned} onTogglePlanned={onTogglePlanned} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Page chrome shared by the three panes
// ─────────────────────────────────────────────────────────────
function D1Page({ t, eyebrow, title, meta, children }) {
  return (
    <div style={{
      position: 'relative',
      background: t.paper,
      border: `1px solid ${t.rule}`,
      borderRadius: 3,
      boxShadow: `0 1px 0 ${t.paperEdge}, 0 6px 16px oklch(0 0 0 / 0.04)`,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <PaperTexture opacity={t.mode === 'dark' ? 0.3 : 0.5} />
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: `1px solid ${t.ruleFaint}`,
        position: 'relative',
      }}>
        <div style={{
          fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, color: t.inkFaint,
          letterSpacing: 2, marginBottom: 4,
        }}>{eyebrow}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h2 style={{
            margin: 0, fontFamily: t.headSerif, fontSize: 28, fontWeight: 500,
            color: t.ink, letterSpacing: -0.8, lineHeight: 1,
          }}>{title}</h2>
          <div style={{ flex: 1 }} />
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: t.inkSoft }}>{meta}</div>
      </div>
      <div style={{
        flex: 1, overflow: 'auto', padding: '14px 20px 20px',
        position: 'relative',
      }}>{children}</div>
    </div>
  );
}

function D1Divider({ t, label, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
        color: accent ? t.flag : t.inkFaint,
        textTransform: 'uppercase',
      }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: accent ? t.flagSoft : t.ruleFaint }} />
    </div>
  );
}

Object.assign(window, { Direction1, D1HeroCard, D1MonthRow, D1Divider, D1WeekRow, D1TodayRow, D1Page });
