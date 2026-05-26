// Direction 3: "Stream" — mobile-first vertical scroll.
// Today on top (biggest), this week as a horizontal-scroll strip below, then the
// month digest. Demonstrates how the same workflow folds down to phone width.

function Direction3({ t }) {
  const [top3, setTop3] = React.useState(TODAY_TOP3);
  const [other, setOther] = React.useState(TODAY_OTHER);
  const [monthOther, setMonthOther] = React.useState(MONTHLY_OTHER);
  const [expandMonth, setExpandMonth] = React.useState(false);

  const toggleTop3 = (id) => setTop3((xs) => xs.map((x) => x.id === id ? { ...x, done: !x.done } : x));
  const toggleOther = (id) => setOther((xs) => xs.map((x) => x.id === id ? { ...x, done: !x.done } : x));
  const toggleMonth = (id) => setMonthOther((xs) => xs.map((x) => x.id === id ? { ...x, done: !x.done } : x));

  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      background: t.paperEdge,
      fontFamily: t.bodySans, color: t.ink,
      overflow: 'auto',
    }}>
      <D3StatusBar t={t} />
      <D3Today t={t} top3={top3} other={other} onToggleTop3={toggleTop3} onToggleOther={toggleOther} />
      <D3WeekStrip t={t} />
      <D3Month t={t} other={monthOther} onToggle={toggleMonth} expand={expandMonth} setExpand={setExpandMonth} />
      <D3Footer t={t} />
    </div>
  );
}

function D3StatusBar({ t }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 20px 0',
      fontFamily: t.bodySans, fontSize: 13, fontWeight: 600,
      color: t.ink, letterSpacing: 0.2,
    }}>
      <span>9:41</span>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor"><path d="M1 8h2v3H1zm4-2h2v5H5zm4-2h2v7H9zm4-3h2v10h-2z"/></svg>
        <svg width="14" height="11" viewBox="0 0 14 11" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 4a8 8 0 0112 0M3 6.5a5 5 0 018 0M7 9v.5"/></svg>
        <span style={{ fontSize: 12 }}>92%</span>
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Today: dominant top section
// ─────────────────────────────────────────────────────────────
function D3Today({ t, top3, other, onToggleTop3, onToggleOther }) {
  return (
    <div style={{
      position: 'relative', padding: '20px 20px 26px',
      background: t.paper,
      borderBottom: `8px solid ${t.paperEdge}`,
    }}>
      <PaperTexture opacity={t.mode === 'dark' ? 0.3 : 0.5} />

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{
            fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 2,
            color: t.inkFaint,
          }}>TODAY · 五</span>
          <span style={{ fontFamily: t.mono, fontSize: 10, color: t.inkFaint }}>2026-05-22</span>
        </div>
        <h1 style={{
          margin: 0, fontFamily: t.headSerif, fontSize: 44, fontWeight: 500,
          letterSpacing: -1.5, lineHeight: 0.95, color: t.ink, marginBottom: 6,
        }}>May 22</h1>
        <div style={{
          fontFamily: t.headSerif, fontSize: 19, fontWeight: 500,
          color: t.accentText, letterSpacing: -0.3, marginBottom: 16,
        }}>{TODAY_THEME}</div>

        <div style={{
          padding: 14, borderRadius: 4,
          background: t.accentSoft,
          border: `1px solid ${t.accent}`,
          marginBottom: 18,
        }}>
          <div style={{
            fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
            color: t.accentText, marginBottom: 10,
          }}>今天最重要的三件事</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {top3.map((task, i) => {
              const ref = monthRef(task.tag);
              return (
                <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    flex: '0 0 auto', width: 22, height: 22, borderRadius: 12,
                    background: t.paper, border: `1.5px solid ${t.accent}`, color: t.accentText,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: t.headSerif, fontSize: 13, fontWeight: 600,
                  }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 500, color: task.done ? t.inkFaint : t.ink,
                      lineHeight: 1.3, textDecoration: task.done ? 'line-through' : 'none',
                    }}>{task.title}</div>
                    {ref && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, fontSize: 11, color: t.inkSoft }}>
                        {ref.n && <PlannedRefChip t={t} n={ref.n} small />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ref.title}</span>
                      </div>
                    )}
                  </div>
                  <Checkbox checked={task.done} onClick={() => onToggleTop3(task.id)} t={t} size={20} accent />
                </div>
              );
            })}
          </div>
        </div>

        <D3SubSection t={t} title="其他計劃內" count={other.filter(o=>o.planned).length}>
          {other.filter((o) => o.planned).map((o) => (
            <D3Row key={o.id} t={t} item={o} onToggle={() => onToggleOther(o.id)} />
          ))}
        </D3SubSection>

        <D3SubSection t={t} title="今天臨時加的" count={other.filter(o=>!o.planned).length} accent>
          {other.filter((o) => !o.planned).map((o) => (
            <D3Row key={o.id} t={t} item={o} onToggle={() => onToggleOther(o.id)} unplanned />
          ))}
          <button style={{
            marginTop: 8, padding: '10px 12px', border: `1px dashed ${t.rule}`, background: 'transparent',
            color: t.inkFaint, fontFamily: t.bodySans, fontSize: 13, textAlign: 'left', cursor: 'pointer',
            borderRadius: 4, width: '100%',
          }}>＋ 加一件今天臨時冒出來的事</button>
        </D3SubSection>
      </div>
    </div>
  );
}

function D3Row({ t, item, onToggle, unplanned }) {
  const ref = monthRef(item.tag);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }}>
      <Checkbox checked={item.done} onClick={onToggle} t={t} size={17} />
      <span style={{
        flex: 1, fontSize: 14, color: item.done ? t.inkFaint : t.ink,
        textDecoration: item.done ? 'line-through' : 'none',
        display: 'flex', alignItems: 'center', gap: 6, minWidth: 0,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
        {ref && ref.n && <PlannedRefChip t={t} n={ref.n} small />}
      </span>
      {unplanned && <UnplannedChip t={t} small />}
    </div>
  );
}

function D3SubSection({ t, title, count, accent, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{
          fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
          color: accent ? t.flag : t.inkFaint, textTransform: 'uppercase',
        }}>{title}</span>
        <span style={{
          fontFamily: t.mono, fontSize: 10, color: accent ? t.flag : t.inkFaint,
        }}>{count}</span>
        <div style={{ flex: 1, height: 1, background: accent ? t.flagSoft : t.ruleFaint }} />
      </div>
      <div>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Week strip: horizontal scroll
// ─────────────────────────────────────────────────────────────
function D3WeekStrip({ t }) {
  return (
    <div style={{
      padding: '22px 0 22px 20px',
      background: t.paperAlt,
      borderBottom: `8px solid ${t.paperEdge}`,
      position: 'relative',
    }}>
      <PaperTexture opacity={t.mode === 'dark' ? 0.25 : 0.4} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4, paddingRight: 20 }}>
          <span style={{
            fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 2,
            color: t.inkFaint,
          }}>WEEK 21</span>
          <span style={{ flex: 1, height: 1, background: t.ruleFaint }} />
          <span style={{ fontFamily: t.mono, fontSize: 10, color: t.inkFaint }}>5/18 – 5/24</span>
        </div>
        <h2 style={{
          margin: '0 0 14px', fontFamily: t.headSerif, fontSize: 22, fontWeight: 500,
          letterSpacing: -0.4, color: t.ink,
        }}>本週每日主題</h2>

        <div style={{
          display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, paddingRight: 20,
          scrollSnapType: 'x mandatory',
        }}>
          {WEEK_DAYS.map((day) => <D3DayCard key={day.i} t={t} day={day} />)}
        </div>
      </div>
    </div>
  );
}

function D3DayCard({ t, day }) {
  const isToday = day.today;
  return (
    <div style={{
      flex: '0 0 auto', width: 180,
      padding: '12px 13px 14px',
      borderRadius: 4,
      background: isToday ? t.accentSoft : t.paper,
      border: `1px solid ${isToday ? t.accent : t.rule}`,
      scrollSnapAlign: 'start',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{
          fontFamily: t.headSerif, fontSize: 26, fontWeight: 500, letterSpacing: -0.5,
          color: isToday ? t.accentText : (day.done ? t.inkFaint : t.ink),
          lineHeight: 1,
        }}>{day.d}</span>
        <span style={{
          fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
          color: isToday ? t.accentText : t.inkFaint,
        }}>{day.wf.toUpperCase()}{isToday ? ' · 今天' : ''}</span>
      </div>
      <div style={{
        fontFamily: t.headSerif, fontSize: 14, fontWeight: 500,
        color: day.done ? t.inkFaint : (isToday ? t.accentText : t.ink),
        textDecoration: day.done ? 'line-through' : 'none',
        lineHeight: 1.25, marginBottom: 10,
        minHeight: 36,
      }}>{day.theme}</div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {day.top3.map((tt, i) => (
          <li key={i} style={{
            display: 'flex', alignItems: 'baseline', gap: 6,
            fontSize: 12, color: day.done ? t.inkFaint : t.inkSoft,
            padding: '2px 0', lineHeight: 1.3,
            textDecoration: day.done ? 'line-through' : 'none',
            textDecorationColor: t.inkFaint,
          }}>
            <span style={{ fontFamily: t.mono, fontSize: 9, color: t.inkFaint }}>{i + 1}.</span>
            <span>{tt}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Month digest
// ─────────────────────────────────────────────────────────────
function D3Month({ t, other, onToggle, expand, setExpand }) {
  const plannedDone = other.filter((o) => o.planned && o.done).length;
  const plannedTotal = MONTHLY_TOP3.length + other.filter((o) => o.planned).length;
  const unplanned = other.filter((o) => !o.planned);

  return (
    <div style={{
      padding: '22px 20px 26px',
      background: t.paper,
      position: 'relative',
    }}>
      <PaperTexture opacity={t.mode === 'dark' ? 0.3 : 0.5} />

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
          <span style={{
            fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 2,
            color: t.inkFaint,
          }}>MONTH</span>
          <span style={{ flex: 1, height: 1, background: t.ruleFaint }} />
          <span style={{ fontFamily: t.mono, fontSize: 10, color: t.inkFaint }}>{plannedDone}/{plannedTotal} ✓</span>
        </div>
        <h2 style={{
          margin: '0 0 14px', fontFamily: t.headSerif, fontSize: 32, fontWeight: 500,
          letterSpacing: -0.8, color: t.ink,
        }}>May 2026</h2>

        <div style={{ fontFamily: t.headSerif, fontSize: 14, color: t.inkSoft, marginBottom: 10 }}>
          本月最重要的三件事
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
          {MONTHLY_TOP3.map((m) => (
            <div key={m.id} style={{
              position: 'relative', padding: '12px 14px 13px 50px',
              background: t.paperAlt,
              border: `1px solid ${t.rule}`, borderRadius: 3,
            }}>
              <div style={{
                position: 'absolute', left: 12, top: 12,
                width: 28, height: 28, borderRadius: 16,
                background: t.accent, color: t.paper,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: t.headSerif, fontSize: 17, fontWeight: 600,
              }}>{m.n}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.ink, lineHeight: 1.3, marginBottom: 2 }}>{m.title}</div>
              <div style={{ fontSize: 11.5, color: t.inkSoft }}>{m.sub}</div>
            </div>
          ))}
        </div>

        <D3SubSection t={t} title="其他計劃內" count={other.filter(o=>o.planned).length}>
          {(expand ? other.filter(o => o.planned) : other.filter(o => o.planned).slice(0, 3)).map((o) => (
            <D3Row key={o.id} t={t} item={o} onToggle={() => onToggle(o.id)} />
          ))}
          {!expand && other.filter(o => o.planned).length > 3 && (
            <button onClick={() => setExpand(true)} style={{
              padding: '6px 4px', background: 'transparent', border: 'none',
              color: t.inkSoft, fontFamily: t.bodySans, fontSize: 12, cursor: 'pointer',
              textAlign: 'left',
            }}>展開全部 {other.filter(o => o.planned).length} 項 →</button>
          )}
        </D3SubSection>

        <D3SubSection t={t} title="計劃外" count={unplanned.length} accent>
          {unplanned.map((o) => (
            <D3Row key={o.id} t={t} item={o} onToggle={() => onToggle(o.id)} unplanned />
          ))}
        </D3SubSection>
      </div>
    </div>
  );
}

function D3Footer({ t }) {
  return (
    <div style={{
      padding: '20px 20px 32px', textAlign: 'center',
      fontFamily: t.headSerif, fontSize: 13,
      color: t.inkFaint,
    }}>
      明天的主題：<span style={{ color: t.inkSoft }}>家庭日</span>
    </div>
  );
}

Object.assign(window, { Direction3 });
