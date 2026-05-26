// Direction 2: "Daybook" — today is hero, week strip on left, month digest on right.
// Feels like opening a leather daybook: large centered today page, with the week
// shown as a vertical timeline strip on one side, and the month's commitments
// summarised on the other.

function Direction2({ t }) {
  const [top3, setTop3] = React.useState(TODAY_TOP3);
  const [other, setOther] = React.useState(TODAY_OTHER);
  const [selectedDay, setSelectedDay] = React.useState(4); // Friday

  const toggleTop3 = (id) => setTop3((xs) => xs.map((x) => x.id === id ? { ...x, done: !x.done } : x));
  const toggleOther = (id) => setOther((xs) => xs.map((x) => x.id === id ? { ...x, done: !x.done } : x));

  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      background: t.paperEdge,
      fontFamily: t.bodySans, color: t.ink,
      overflow: 'hidden',
      display: 'grid',
      gridTemplateColumns: '240px 1fr 280px',
    }}>
      <D2WeekRail t={t} selected={selectedDay} onSelect={setSelectedDay} />
      <D2TodayCenter t={t} top3={top3} other={other} onToggleTop3={toggleTop3} onToggleOther={toggleOther} />
      <D2MonthDigest t={t} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Left rail: vertical week strip
// ─────────────────────────────────────────────────────────────
function D2WeekRail({ t, selected, onSelect }) {
  return (
    <div style={{
      background: t.paperAlt,
      borderRight: `1px solid ${t.rule}`,
      padding: '22px 14px 22px 18px',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <PaperTexture opacity={t.mode === 'dark' ? 0.25 : 0.4} />
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <div style={{
          fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 2,
          color: t.inkFaint, marginBottom: 2,
        }}>WEEK 21</div>
        <div style={{ fontFamily: t.headSerif, fontSize: 19, fontWeight: 500, letterSpacing: -0.4 }}>
          5/18 – 5/24
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* vertical timeline rule */}
        <div style={{ position: 'absolute', left: 14, top: 14, bottom: 14, width: 1, background: t.rule }} />

        {WEEK_DAYS.map((day) => {
          const isSel = selected === day.i;
          const isToday = day.today;
          return (
            <button key={day.i} onClick={() => onSelect(day.i)}
              style={{
                position: 'relative',
                display: 'grid', gridTemplateColumns: '30px 1fr', alignItems: 'flex-start',
                gap: 10, padding: '7px 6px',
                border: 'none', background: isSel ? t.paper : 'transparent',
                borderRadius: 4, cursor: 'pointer',
                textAlign: 'left', fontFamily: 'inherit', color: 'inherit',
                boxShadow: isSel ? `0 1px 0 ${t.rule}, inset 0 0 0 1px ${t.rule}` : 'none',
              }}>
              <div style={{
                position: 'relative', zIndex: 1, marginTop: 1,
                width: 28, height: 28, borderRadius: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: t.headSerif, fontSize: 14, fontWeight: 500,
                background: isToday ? t.accent : (day.done ? t.paperEdge : t.paper),
                color: isToday ? t.paper : t.ink,
                border: `1px solid ${isToday ? t.accent : t.rule}`,
              }}>{day.d}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
                  color: isToday ? t.accentText : t.inkFaint, marginBottom: 3,
                }}>{day.wf.toUpperCase()}{isToday ? ' · 今天' : ''}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {day.top3.map((task, i) => (
                    <div key={i} style={{
                      fontFamily: t.bodySans, fontSize: 11,
                      color: day.done ? t.inkFaint : t.inkSoft,
                      textDecoration: day.done ? 'line-through' : 'none',
                      textDecorationColor: t.inkFaint,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      lineHeight: 1.35,
                    }}>{task}</div>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ position: 'relative', paddingTop: 12, borderTop: `1px solid ${t.ruleFaint}`, marginTop: 8 }}>
        <div style={{ fontFamily: t.headSerif, fontSize: 12, color: t.inkSoft }}>
          下週開始前，記得做週回顧
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Center: today
// ─────────────────────────────────────────────────────────────
function D2TodayCenter({ t, top3, other, onToggleTop3, onToggleOther }) {
  return (
    <div style={{
      background: t.paper,
      position: 'relative',
      overflow: 'auto',
      padding: '34px 56px 36px',
    }}>
      <PaperTexture opacity={t.mode === 'dark' ? 0.3 : 0.5} />

      {/* Masthead */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
          <div style={{
            fontFamily: t.bodySans, fontSize: 11, fontWeight: 700, letterSpacing: 2,
            color: t.inkFaint,
          }}>FRIDAY · 五</div>
          <div style={{ flex: 1, height: 1, background: t.ruleFaint, transform: 'translateY(-3px)' }} />
          <div style={{ fontFamily: t.mono, fontSize: 11, color: t.inkFaint }}>2026-05-22</div>
        </div>
        <h1 style={{
          margin: 0, fontFamily: t.headSerif, fontSize: 64, fontWeight: 500,
          letterSpacing: -2, lineHeight: 0.9, color: t.ink,
        }}>May 22</h1>
      </div>

      {/* Top 3 spotlight */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{
            fontFamily: t.bodySans, fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
            color: t.ink,
          }}>今天最重要的三件事</span>
          <div style={{ flex: 1, height: 1, background: t.ruleFaint }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {top3.map((task, i) => {
            const mref = monthRef(task.tag);
            return (
              <D2TopRow key={task.id} t={t} n={i + 1} task={task} mref={mref} onToggle={() => onToggleTop3(task.id)} />
            );
          })}
        </div>
      </div>

      {/* Other planned */}
      <div style={{ position: 'relative', marginBottom: 22 }}>
        <D2SectionLabel t={t}>其他計劃內</D2SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 24px', marginTop: 8 }}>
          {other.filter((o) => o.planned).map((o) => (
            <D2OtherRow key={o.id} t={t} item={o} onToggle={() => onToggleOther(o.id)} />
          ))}
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <D2SectionLabel t={t} accent>今天臨時加的</D2SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
          {other.filter((o) => !o.planned).map((o) => (
            <D2OtherRow key={o.id} t={t} item={o} onToggle={() => onToggleOther(o.id)} unplanned />
          ))}
          <button style={{
            marginTop: 4, padding: '8px 10px', border: `1px dashed ${t.rule}`, background: 'transparent',
            color: t.inkFaint, fontFamily: t.bodySans, fontSize: 13, textAlign: 'left', cursor: 'pointer',
            borderRadius: 4,
          }}>＋ 加一件今天臨時冒出來的事（會標為計劃外）</button>
        </div>
      </div>
    </div>
  );
}

function D2TopRow({ t, n, task, mref, onToggle }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '40px 1fr auto', alignItems: 'center',
      gap: 14, padding: '12px 4px 13px',
      borderBottom: `1px solid ${t.ruleFaint}`,
    }}>
      <div style={{
        fontFamily: t.headSerif, fontWeight: 500,
        fontSize: 40, lineHeight: 0.9,
        color: task.done ? t.inkFaint : t.accent,
        textAlign: 'center',
      }}>{n}</div>
      <div>
        <div style={{
          fontFamily: t.headSerif, fontSize: 19, fontWeight: 500, letterSpacing: -0.3,
          color: task.done ? t.inkFaint : t.ink,
          textDecoration: task.done ? 'line-through' : 'none',
          lineHeight: 1.25, marginBottom: 3,
        }}>{task.title}</div>
        {mref && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.inkSoft }}>
            {mref.n && <PlannedRefChip t={t} n={mref.n} />}
            <span>對應月度任務：{mref.title}</span>
          </div>
        )}
      </div>
      <Checkbox checked={task.done} onClick={onToggle} t={t} size={22} accent />
    </div>
  );
}

function D2OtherRow({ t, item, onToggle, onTogglePlanned, unplanned }) {
  const ref = monthRef(item.tag);
  return (
    <div className="tr" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px' }}>
      <Checkbox checked={item.done} onClick={onToggle} t={t} size={16} />
      <span style={{
        flex: 1, fontSize: 13.5, color: item.done ? t.inkFaint : t.ink,
        textDecoration: item.done ? 'line-through' : 'none', textDecorationColor: t.inkFaint,
        display: 'flex', alignItems: 'center', gap: 6, minWidth: 0,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
        {ref && ref.n && <PlannedRefChip t={t} n={ref.n} small />}
      </span>
      {unplanned && <UnplannedChip t={t} small />}
      {onTogglePlanned && <RowMenu t={t} planned={!unplanned} onTogglePlanned={onTogglePlanned} />}
    </div>
  );
}

function D2SectionLabel({ t, children, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
        color: accent ? t.flag : t.inkFaint, textTransform: 'uppercase',
      }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: accent ? t.flagSoft : t.ruleFaint }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Right column: month digest
// ─────────────────────────────────────────────────────────────
function D2MonthDigest({ t }) {
  const plannedTotal = MONTHLY_TOP3.length + MONTHLY_OTHER.filter((o) => o.planned).length;
  const plannedDone = MONTHLY_OTHER.filter((o) => o.planned && o.done).length;
  const unplanned = MONTHLY_OTHER.filter((o) => !o.planned);
  const monthProgress = plannedDone / plannedTotal;

  return (
    <div style={{
      background: t.paperAlt,
      borderLeft: `1px solid ${t.rule}`,
      padding: '22px 22px 22px 20px',
      position: 'relative', overflow: 'auto',
    }}>
      <PaperTexture opacity={t.mode === 'dark' ? 0.25 : 0.4} />
      <div style={{ position: 'relative' }}>
        <div style={{
          fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 2,
          color: t.inkFaint, marginBottom: 2,
        }}>MONTH</div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontFamily: t.headSerif, fontSize: 22, fontWeight: 500, letterSpacing: -0.4 }}>
            May 2026
          </div>
          <div style={{ fontFamily: t.mono, fontSize: 11, color: t.inkFaint }}>
            DAY 22 / 31
          </div>
        </div>
        <div style={{ marginBottom: 4 }}><ProgressBar t={t} value={22/31} color={t.inkSoft} /></div>
        <div style={{ fontSize: 11, color: t.inkSoft, marginBottom: 18 }}>
          月份過了 {Math.round(22/31 * 100)}%，計劃內已完成 {plannedDone}/{plannedTotal} 件
        </div>

        <div style={{ fontFamily: t.headSerif, fontSize: 13, color: t.inkSoft, marginBottom: 8 }}>
          本月三件大事
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {MONTHLY_TOP3.map((m) => {
            const done = !!m.done;
            return (
              <div key={m.id} style={{
                padding: '10px 12px',
                background: t.paper,
                border: `1px solid ${done ? t.ruleFaint : t.rule}`,
                borderRadius: 3,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 3 }}>
                  {done ? (
                    <span style={{
                      width: 18, height: 18, borderRadius: 9, flex: '0 0 auto',
                      background: t.paperEdge, color: t.inkFaint,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, marginTop: 1,
                    }}>✓</span>
                  ) : (
                    <PlannedRefChip t={t} n={m.n} />
                  )}
                  <div style={{
                    flex: 1, fontSize: 12.5, fontWeight: 600,
                    color: done ? t.inkFaint : t.ink, lineHeight: 1.3,
                    textDecoration: done ? 'line-through' : 'none',
                    textDecorationColor: t.inkFaint,
                  }}>{m.title}</div>
                </div>
                <div style={{ fontSize: 10.5, color: t.inkFaint, paddingLeft: 24 }}>
                  {m.sub}
                  {done && m.doneOn && (
                    <span style={{ fontFamily: t.mono, marginLeft: 6 }}>· 完成 5/{m.doneOn}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <D2SectionLabel t={t}>其他 ({MONTHLY_OTHER.filter(o=>o.planned).length})</D2SectionLabel>
        <div style={{ marginTop: 6, marginBottom: 16 }}>
          {MONTHLY_OTHER.filter((o) => o.planned).map((o) => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <span style={{
                width: 12, height: 12, borderRadius: 2,
                background: o.done ? t.inkSoft : 'transparent',
                border: `1.5px solid ${t.inkSoft}`,
                flex: '0 0 auto',
              }} />
              <span style={{
                flex: 1, fontSize: 12, color: o.done ? t.inkFaint : t.ink,
                textDecoration: o.done ? 'line-through' : 'none',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{o.title}</span>
              {o.done && o.doneOn && (
                <span style={{ fontFamily: t.mono, fontSize: 10, color: t.inkFaint, flex: '0 0 auto' }}>5/{o.doneOn}</span>
              )}
            </div>
          ))}
        </div>

        <D2SectionLabel t={t} accent>計劃外 ({unplanned.length})</D2SectionLabel>
        <div style={{ marginTop: 6 }}>
          {unplanned.map((o) => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <span style={{
                width: 12, height: 12, borderRadius: 2,
                background: o.done ? t.flag : 'transparent',
                border: `1.5px solid ${t.flag}`, flex: '0 0 auto',
              }} />
              <span style={{
                flex: 1, fontSize: 12, color: o.done ? t.inkFaint : t.ink,
                textDecoration: o.done ? 'line-through' : 'none',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{o.title}</span>
              {o.done && o.doneOn && (
                <span style={{ fontFamily: t.mono, fontSize: 10, color: t.inkFaint, flex: '0 0 auto' }}>5/{o.doneOn}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Direction2, D2WeekRail, D2TopRow, D2OtherRow, D2SectionLabel, D2MonthDigest });
