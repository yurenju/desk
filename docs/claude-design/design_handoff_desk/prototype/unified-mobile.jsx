// Mobile unified app — same workflow, single column.
// Top tab toggles 規劃 / 今天 just like desktop. Carryover banners/sections
// are placed at each appropriate boundary.

function UnifiedMobileApp({ t, initialMode = 'today' }) {
  const [mode, setMode] = React.useState(initialMode);
  return (
    <div style={{
      width: '100%', height: '100%',
      background: t.paper, color: t.ink, fontFamily: t.bodySans,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <MNav t={t} mode={mode} setMode={setMode} />
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {mode === 'today' ? <MTodayView t={t} /> : <MPlanView t={t} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Nav
// ─────────────────────────────────────────────────────────────
function MNav({ t, mode, setMode }) {
  return (
    <div style={{
      padding: '10px 16px 12px',
      borderBottom: `1px solid ${t.rule}`,
      background: t.paper,
      position: 'relative', zIndex: 2,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <DeskLogo t={t} size={20} compact />
        <span style={{ fontFamily: t.headSerif, fontSize: 13, color: t.inkSoft }}>· Friday, May 22</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: t.mono, fontSize: 10, color: t.inkFaint }}>W21 · 22/31</span>
      </div>
      <div role="tablist" style={{
        display: 'flex', background: t.paperAlt,
        borderRadius: 999, padding: 3, border: `1px solid ${t.rule}`,
      }}>
        {['plan', 'today'].map((m) => {
          const on = mode === m;
          return (
            <button key={m} onClick={() => setMode(m)}
              role="tab" aria-selected={on}
              style={{
                flex: 1, padding: '7px 16px', border: 'none', borderRadius: 999,
                background: on ? t.accent : 'transparent',
                color: on ? '#fff' : t.inkSoft,
                cursor: 'pointer', fontFamily: t.bodySans, fontWeight: 600,
                fontSize: 13, letterSpacing: 0.4, transition: 'all .15s',
              }}>
              {m === 'plan' ? '規劃' : '今天'}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Mobile carryover — compact single-column variant
// ─────────────────────────────────────────────────────────────
function MCarryover({ t, items, eyebrow, label, getMeta }) {
  const [open, setOpen] = React.useState(false);
  const [resolved, setResolved] = React.useState({});
  const remaining = items.filter((i) => !resolved[i.id]);
  if (!remaining.length) return null;
  return (
    <div style={{
      borderRadius: 4, overflow: 'hidden',
      background: t.carryBg, border: `1px dashed ${t.carryEdge}`,
      margin: '0 0 14px',
    }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '10px 12px', border: 'none', background: 'transparent',
        cursor: 'pointer', textAlign: 'left', color: 'inherit', fontFamily: 'inherit',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: 11,
          background: t.carryEdge, color: t.paper, fontSize: 11, fontWeight: 700,
        }}>↩</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: t.bodySans, fontSize: 9.5, fontWeight: 700, letterSpacing: 1.2,
            color: t.carryText, marginBottom: 1,
          }}>{eyebrow} · {remaining.length} 件待處理</div>
          <div style={{
            fontSize: 12.5, fontWeight: 500, color: t.ink,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{label}</div>
        </div>
        <span style={{ fontFamily: t.mono, fontSize: 9, color: t.carryText }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '4px 12px 10px', background: t.paper, borderTop: `1px dashed ${t.carryEdge}` }}>
          {remaining.map((it) => {
            const meta = getMeta ? getMeta(it) : (it.was || it.fromDay || '');
            return (
              <div key={it.id} style={{
                padding: '7px 0',
                borderBottom: `1px dashed ${t.ruleFaint}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, color: t.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</span>
                  {meta && <span style={{ fontFamily: t.mono, fontSize: 9, color: t.inkFaint }}>{meta}</span>}
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {it.fromTop3 && (
                    <MTinyBtn t={t} onClick={() => setResolved((r) => ({ ...r, [it.id]: 'top3' }))} accent>↑ 三件事</MTinyBtn>
                  )}
                  <MTinyBtn t={t} onClick={() => setResolved((r) => ({ ...r, [it.id]: 'planned' }))}>→ 計劃內</MTinyBtn>
                  <MTinyBtn t={t} onClick={() => setResolved((r) => ({ ...r, [it.id]: 'drop' }))} ghost>略過</MTinyBtn>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MTinyBtn({ t, onClick, children, accent, ghost }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 9px',
      fontFamily: t.bodySans, fontSize: 11, fontWeight: 600,
      border: `1px solid ${ghost ? 'transparent' : (accent ? t.accent : t.rule)}`,
      background: ghost ? 'transparent' : (accent ? t.accent : t.paper),
      color: ghost ? t.inkSoft : (accent ? '#fff' : t.ink),
      borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: 0.3,
    }}>{children}</button>
  );
}

// ─────────────────────────────────────────────────────────────
// Reused pieces
// ─────────────────────────────────────────────────────────────
function MSectionLabel({ t, children, count, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{
        fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
        color: accent ? t.flag : t.inkFaint, textTransform: 'uppercase',
      }}>{children}</span>
      {count != null && <span style={{ fontFamily: t.mono, fontSize: 10, color: accent ? t.flag : t.inkFaint }}>{count}</span>}
      <div style={{ flex: 1, height: 1, background: accent ? t.flagSoft : t.ruleFaint }} />
    </div>
  );
}

function MRow({ t, item, onToggle, onTogglePlanned, unplanned, size = 16 }) {
  const ref = monthRef(item.tag);
  return (
    <div className="tr" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 4px', minWidth: 0 }}>
      <Checkbox checked={item.done} onClick={onToggle} t={t} size={size} />
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: 14, color: item.done ? t.inkFaint : t.ink,
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
// TODAY VIEW (mobile)
// ─────────────────────────────────────────────────────────────
function MTodayView({ t }) {
  const [top3, setTop3] = React.useState(TODAY_TOP3);
  const [other, setOther] = React.useState(TODAY_OTHER);
  const toggleTop3 = (id) => setTop3((xs) => xs.map((x) => x.id === id ? { ...x, done: !x.done } : x));
  const toggleOther = (id) => setOther((xs) => xs.map((x) => x.id === id ? { ...x, done: !x.done } : x));
  const togglePlanned = (id) => setOther((xs) => xs.map((x) => x.id === id ? { ...x, planned: !x.planned } : x));
  return (
    <div style={{ padding: '14px 16px 32px', background: t.paper, position: 'relative' }}>
      <PaperTexture opacity={t.mode === 'dark' ? 0.25 : 0.4} />
      <div style={{ position: 'relative' }}>

        <MCarryover t={t} items={YESTERDAY_LEFTOVER}
          eyebrow="從昨天延續"
          label={`5/${YESTERDAY.d}（${YESTERDAY.w}）有 ${YESTERDAY_LEFTOVER.length} 件沒做完`}
          getMeta={(it) => it.was}
        />

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 2, color: t.inkFaint }}>FRIDAY · 五</span>
          <span style={{ fontFamily: t.mono, fontSize: 10, color: t.inkFaint }}>2026-05-22</span>
        </div>
        <h1 style={{ margin: '0 0 18px', fontFamily: t.headSerif, fontSize: 48, fontWeight: 500, letterSpacing: -1.5, lineHeight: 0.95 }}>May 22</h1>

        {/* Top 3 */}
        <div style={{
          padding: 14, borderRadius: 4,
          background: t.accentSoft, border: `1px solid ${t.accent}`,
          marginBottom: 18,
        }}>
          <div style={{ fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: t.accentText, marginBottom: 10 }}>
            今天最重要的三件事
          </div>
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
                      lineHeight: 1.35,
                      textDecoration: task.done ? 'line-through' : 'none',
                    }}>{task.title}</div>
                    {ref && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, fontSize: 11, color: t.inkSoft }}>
                        {ref.n && <PlannedRefChip t={t} n={ref.n} small />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ref.title}</span>
                      </div>
                    )}
                  </div>
                  <Checkbox checked={task.done} onClick={() => toggleTop3(task.id)} t={t} size={20} accent />
                </div>
              );
            })}
          </div>
        </div>

        <MSectionLabel t={t} count={other.filter(o=>o.planned).length}>其他計劃內</MSectionLabel>
        <div style={{ marginBottom: 18 }}>
          {other.filter((o) => o.planned).map((o) => (
            <MRow key={o.id} t={t} item={o} onToggle={() => toggleOther(o.id)} onTogglePlanned={() => togglePlanned(o.id)} />
          ))}
        </div>

        <MSectionLabel t={t} count={other.filter(o=>!o.planned).length} accent>今天臨時加的</MSectionLabel>
        <div>
          {other.filter((o) => !o.planned).map((o) => (
            <MRow key={o.id} t={t} item={o} onToggle={() => toggleOther(o.id)} onTogglePlanned={() => togglePlanned(o.id)} unplanned />
          ))}
          <button style={{
            marginTop: 8, padding: '10px 12px', border: `1px dashed ${t.rule}`, background: 'transparent',
            color: t.inkFaint, fontFamily: t.bodySans, fontSize: 13, textAlign: 'left', cursor: 'pointer',
            borderRadius: 4, width: '100%',
          }}>＋ 加一件今天臨時冒出來的事</button>
        </div>

        {/* Week peek */}
        <div style={{ marginTop: 26, padding: '14px 0 0', borderTop: `1px solid ${t.ruleFaint}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <span style={{ fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 2, color: t.inkFaint }}>本週</span>
            <span style={{ fontFamily: t.headSerif, fontSize: 16, fontWeight: 500, letterSpacing: -0.3 }}>第 21 週 · 5/18 – 5/24</span>
          </div>
          <div style={{
            display: 'flex', gap: 8, overflowX: 'auto',
            margin: '0 -16px', padding: '0 16px 8px',
            scrollSnapType: 'x mandatory',
          }}>
            {WEEK_DAYS.map((d) => <MDayChip key={d.i} t={t} d={d} />)}
          </div>
        </div>

        {/* Month peek */}
        <div style={{ marginTop: 22, padding: '14px 0 0', borderTop: `1px solid ${t.ruleFaint}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <span style={{ fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 2, color: t.inkFaint }}>本月</span>
            <span style={{ fontFamily: t.headSerif, fontSize: 16, fontWeight: 500, letterSpacing: -0.3 }}>May 2026</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: t.mono, fontSize: 10, color: t.inkFaint }}>DAY 22/31</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MONTHLY_TOP3.map((m) => (
              <div key={m.id} style={{
                padding: '10px 12px',
                background: t.paperAlt,
                border: `1px solid ${t.rule}`,
                borderRadius: 3,
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <PlannedRefChip t={t} n={m.n} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, lineHeight: 1.3 }}>{m.title}</div>
                  <div style={{ fontSize: 11, color: t.inkSoft, marginTop: 2 }}>{m.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MDayChip({ t, d }) {
  const isToday = d.today;
  return (
    <div style={{
      flex: '0 0 auto', width: 56, padding: '8px 6px 10px',
      background: isToday ? t.accentSoft : t.paperAlt,
      border: `1px solid ${isToday ? t.accent : t.rule}`,
      borderRadius: 4, textAlign: 'center',
      scrollSnapAlign: 'start',
    }}>
      <div style={{
        fontFamily: t.bodySans, fontSize: 9, fontWeight: 700, letterSpacing: 1,
        color: isToday ? t.accentText : t.inkFaint,
      }}>{d.wf.toUpperCase()}</div>
      <div style={{
        fontFamily: t.headSerif, fontSize: 22, fontWeight: 500, letterSpacing: -0.5,
        color: isToday ? t.accentText : (d.done ? t.inkFaint : t.ink),
        textDecoration: d.done ? 'line-through' : 'none',
        lineHeight: 1.1, margin: '1px 0',
      }}>{d.d}</div>
      <div style={{
        fontFamily: t.mono, fontSize: 9,
        color: isToday ? t.accentText : t.inkFaint,
      }}>{d.top3.length} 件</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PLAN VIEW (mobile) — vertically stacked month → week → day
// ─────────────────────────────────────────────────────────────
function MPlanView({ t }) {
  const [monthly, setMonthly] = React.useState(MONTHLY_OTHER);
  const [todayOther, setTodayOther] = React.useState(TODAY_OTHER);
  const toggleM = (id) => setMonthly((xs) => xs.map((x) => x.id === id ? { ...x, done: !x.done } : x));
  const toggleT = (id) => setTodayOther((xs) => xs.map((x) => x.id === id ? { ...x, done: !x.done } : x));
  const togglePM = (id) => setMonthly((xs) => xs.map((x) => x.id === id ? { ...x, planned: !x.planned } : x));
  const togglePT = (id) => setTodayOther((xs) => xs.map((x) => x.id === id ? { ...x, planned: !x.planned } : x));

  return (
    <div style={{ background: t.paperEdge, position: 'relative' }}>
      <PaperTexture opacity={t.mode === 'dark' ? 0.25 : 0.4} />
      <div style={{ position: 'relative' }}>
        {/* MONTH */}
        <MPlanSection t={t} eyebrow="MONTH · 規劃" title="May 2026">
          <MCarryover t={t} items={LAST_MONTH_LEFTOVER}
            eyebrow="從上月延續"
            label={LAST_MONTH.label + ' 沒做完的任務'}
            getMeta={(it) => it.was}
          />
          <div style={{ fontFamily: t.headSerif, fontSize: 14, color: t.inkSoft, marginBottom: 8 }}>
            本月最重要的三件事
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            {MONTHLY_TOP3.map((m) => <D1HeroCard key={m.id} t={t} m={m} />)}
          </div>
          <MSectionLabel t={t} count={monthly.filter(o=>o.planned).length}>其他計劃內</MSectionLabel>
          <div style={{ marginBottom: 14 }}>
            {monthly.filter((o) => o.planned).map((o) => (
              <MRow key={o.id} t={t} item={o} onToggle={() => toggleM(o.id)} onTogglePlanned={() => togglePM(o.id)} size={15} />
            ))}
          </div>
          <MSectionLabel t={t} count={monthly.filter(o=>!o.planned).length} accent>計劃外</MSectionLabel>
          <div>
            {monthly.filter((o) => !o.planned).map((o) => (
              <MRow key={o.id} t={t} item={o} onToggle={() => toggleM(o.id)} onTogglePlanned={() => togglePM(o.id)} unplanned size={15} />
            ))}
            <button style={mPlanAddBtn(t)}>＋ 新增任務（會自動標為計劃外）</button>
          </div>
        </MPlanSection>

        {/* WEEK */}
        <MPlanSection t={t} eyebrow="WEEK · 規劃" title="第 21 週" sub="5/18 – 5/24">
          <MCarryover t={t} items={LAST_WEEK_LEFTOVER}
            eyebrow="從上週延續"
            label={LAST_WEEK.label + ' 沒做完的任務'}
            getMeta={(it) => it.fromDay}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {WEEK_DAYS.map((day) => <D1WeekRow key={day.i} t={t} day={day} />)}
          </div>
        </MPlanSection>

        {/* TODAY */}
        <MPlanSection t={t} eyebrow="TODAY · 五" title="May 22">
          <MCarryover t={t} items={YESTERDAY_LEFTOVER}
            eyebrow="從昨天延續"
            label={`5/${YESTERDAY.d}（${YESTERDAY.w}）`}
            getMeta={(it) => it.was}
          />
          <div style={{
            marginBottom: 18, padding: '12px 14px',
            background: t.accentSoft, border: `1px solid ${t.accent}`,
            borderRadius: 3,
          }}>
            <div style={{ fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: t.accentText, marginBottom: 8 }}>
              今天最重要的三件事
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TODAY_TOP3.map((task, i) => {
                const ref = monthRef(task.tag);
                return (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{
                      flex: '0 0 auto', width: 20, height: 20, borderRadius: 11,
                      background: t.paper, color: t.accentText,
                      border: `1.5px solid ${t.accent}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: t.headSerif, fontWeight: 600, fontSize: 12,
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: t.ink, lineHeight: 1.35 }}>{task.title}</div>
                      {ref && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: t.inkSoft, marginTop: 1 }}>
                          {ref.n && <PlannedRefChip t={t} n={ref.n} small />}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ref.title}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <MSectionLabel t={t} count={todayOther.filter(o=>o.planned).length}>其他計劃內</MSectionLabel>
          <div style={{ marginBottom: 14 }}>
            {todayOther.filter((o) => o.planned).map((o) => (
              <MRow key={o.id} t={t} item={o} onToggle={() => toggleT(o.id)} onTogglePlanned={() => togglePT(o.id)} size={15} />
            ))}
          </div>
          <MSectionLabel t={t} count={todayOther.filter(o=>!o.planned).length} accent>今天臨時加的</MSectionLabel>
          <div>
            {todayOther.filter((o) => !o.planned).map((o) => (
              <MRow key={o.id} t={t} item={o} onToggle={() => toggleT(o.id)} onTogglePlanned={() => togglePT(o.id)} unplanned size={15} />
            ))}
            <button style={mPlanAddBtn(t)}>＋ 加一件今天的事</button>
          </div>
        </MPlanSection>
      </div>
    </div>
  );
}

function MPlanSection({ t, eyebrow, title, sub, children }) {
  return (
    <div style={{
      padding: '16px 16px 20px',
      background: t.paper,
      borderBottom: `8px solid ${t.paperEdge}`,
    }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{
          fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 2,
          color: t.inkFaint, marginBottom: 2,
        }}>{eyebrow}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h2 style={{ margin: 0, fontFamily: t.headSerif, fontSize: 26, fontWeight: 500, letterSpacing: -0.6, lineHeight: 1 }}>{title}</h2>
          {sub && <span style={{ fontSize: 12, color: t.inkSoft }}>{sub}</span>}
        </div>
      </div>
      {children}
    </div>
  );
}

function mPlanAddBtn(t) {
  return {
    marginTop: 4, padding: '6px 8px', border: 'none', background: 'transparent',
    color: t.inkFaint, fontFamily: t.bodySans, fontSize: 12, textAlign: 'left', cursor: 'pointer',
    borderRadius: 4, width: '100%', display: 'block',
  };
}

Object.assign(window, { UnifiedMobileApp });
