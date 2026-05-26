// Unified app: two top-level modes with one shared shell.
//   • 規劃 (Plan): three columns side-by-side — month / week / day.
//     Each column shows what spilled over from its prior period at the top
//     (collapsed), so you can review-then-plan in one continuous gesture.
//   • 今天 (Today): today is the hero, week strip on the left, month
//     digest on the right. A "從昨天延續" banner sits at the top of the
//     today pane only when something actually spilled over.

function UnifiedApp({ t, initialMode = 'today' }) {
  const [mode, setMode] = React.useState(initialMode);
  return (
    <div style={{
      width: '100%', height: '100%',
      background: t.paperEdge, color: t.ink,
      fontFamily: t.bodySans,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <UTopNav t={t} mode={mode} setMode={setMode} />
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {mode === 'today' ? <UTodayView t={t} /> : <UPlanView t={t} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Top nav: brand, mode segmented control, date
// ─────────────────────────────────────────────────────────────
function UTopNav({ t, mode, setMode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '14px 24px', background: t.paper,
      borderBottom: `1px solid ${t.rule}`,
      position: 'relative', zIndex: 2,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <DeskLogo t={t} size={22} />
        <span style={{ fontFamily: t.mono, fontSize: 10, color: t.inkFaint, letterSpacing: 0.5 }}>desk.yurenju.me</span>
      </div>
      <div style={{ flex: 1 }} />
      <div role="tablist" style={{
        display: 'inline-flex', background: t.paperAlt,
        borderRadius: 999, padding: 3, border: `1px solid ${t.rule}`,
        boxShadow: 'inset 0 1px 2px oklch(0 0 0 / 0.04)',
      }}>
        {['plan', 'today'].map((m) => {
          const on = mode === m;
          return (
            <button key={m} onClick={() => setMode(m)}
              role="tab" aria-selected={on}
              style={{
                padding: '7px 22px', border: 'none', borderRadius: 999,
                background: on ? t.accent : 'transparent',
                color: on ? '#fff' : t.inkSoft,
                cursor: 'pointer', fontFamily: t.bodySans, fontWeight: 600,
                fontSize: 13, letterSpacing: 0.4,
                transition: 'all .15s',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
              <span>{m === 'plan' ? '規劃' : '今天'}</span>
              <span style={{ fontFamily: t.mono, fontSize: 10, opacity: 0.7, fontWeight: 500 }}>
                {m === 'plan' ? '⌘P' : '⌘T'}
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, fontSize: 13 }}>
        <span style={{ fontFamily: t.headSerif, fontSize: 15 }}>Friday, May 22</span>
        <span style={{ fontFamily: t.mono, fontSize: 11, color: t.inkFaint }}>WEEK 21 · DAY 22/31</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CARRYOVER — collapsible banner (today) and inline section (plan)
// ─────────────────────────────────────────────────────────────
function UCarryoverBanner({ t, items, eyebrow, label, period }) {
  const [open, setOpen] = React.useState(false);
  const [resolved, setResolved] = React.useState({});
  const remaining = items.filter((i) => !resolved[i.id]);
  if (!remaining.length) {
    return (
      <div style={{
        padding: '10px 14px', borderRadius: 4,
        background: t.paperAlt, border: `1px solid ${t.ruleFaint}`,
        marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 13, color: t.inkSoft }}>
          ✓ 昨天的事都處理過了。
        </span>
      </div>
    );
  }
  return (
    <div style={{
      borderRadius: 4, overflow: 'hidden',
      background: t.carryBg, border: `1px solid ${t.carryEdge}`,
      marginBottom: 18,
    }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        padding: '12px 16px', border: 'none', background: 'transparent',
        cursor: 'pointer', textAlign: 'left',
        fontFamily: 'inherit', color: 'inherit',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 26, borderRadius: 13,
          background: t.carryEdge, color: t.paper,
          fontFamily: t.headSerif, fontWeight: 600, fontSize: 14,
        }}>↩</span>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
            color: t.carryText, marginBottom: 1,
          }}>{eyebrow} · {remaining.length} 件待處理</div>
          <div style={{
            fontFamily: t.headSerif, fontSize: 16,
            color: t.ink, fontWeight: 500, letterSpacing: -0.2,
          }}>{label}</div>
        </div>
        <span style={{ fontFamily: t.mono, fontSize: 11, color: t.inkFaint }}>{period}</span>
        <span style={{
          fontFamily: t.bodySans, fontSize: 12, fontWeight: 600, color: t.carryText,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>{open ? '收起' : '逐項處理'} <span style={{ fontSize: 9 }}>{open ? '▲' : '▼'}</span></span>
      </button>
      {open && (
        <div style={{
          padding: '4px 16px 14px',
          borderTop: `1px solid ${t.carryEdge}`,
          background: t.paper,
        }}>
          {remaining.map((it) => (
            <UCarryoverRow key={it.id} t={t} item={it} variant="banner"
              onResolve={(action) => setResolved((r) => ({ ...r, [it.id]: action }))} />
          ))}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10,
            paddingTop: 8, borderTop: `1px solid ${t.ruleFaint}`,
          }}>
            <UTinyButton t={t} onClick={() => {
              const r = {}; remaining.forEach((i) => r[i.id] = 'planned'); setResolved((x) => ({ ...x, ...r }));
            }}>全部移到今天計劃內</UTinyButton>
            <UTinyButton t={t} onClick={() => {
              const r = {}; remaining.forEach((i) => r[i.id] = 'drop'); setResolved((x) => ({ ...x, ...r }));
            }} ghost>全部略過</UTinyButton>
          </div>
        </div>
      )}
    </div>
  );
}

function UCarryoverSection({ t, items, eyebrow, label, getMeta, accent }) {
  const [open, setOpen] = React.useState(false);
  const [resolved, setResolved] = React.useState({});
  const remaining = items.filter((i) => !resolved[i.id]);
  const active = remaining.length > 0;
  return (
    <div data-comment-anchor="cc-1" style={{
      marginBottom: 18,
      borderRadius: 4,
      border: `1px dashed ${active ? t.carryEdge : t.ruleFaint}`,
      background: active ? t.carryBg : t.paperAlt,
      overflow: 'hidden',
    }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '8px 12px', border: 'none', background: 'transparent',
        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'inherit',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 18, height: 18, borderRadius: 9,
          background: active ? t.carryEdge : t.rule, color: t.paper,
          fontSize: 10, fontWeight: 700,
        }}>↩</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
            color: active ? t.carryText : t.inkFaint, marginBottom: 1,
          }}>{eyebrow}</div>
          <div style={{
            fontSize: 12.5, fontWeight: 500, color: t.ink,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{label}</div>
        </div>
        <span style={{
          fontFamily: t.mono, fontSize: 10, color: active ? t.carryText : t.inkFaint,
          background: t.paper, padding: '2px 6px', borderRadius: 3,
        }}>{remaining.length} 件</span>
        <span style={{ fontFamily: t.mono, fontSize: 9, color: active ? t.carryText : t.inkFaint }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && remaining.length > 0 && (
        <div style={{ padding: '4px 12px 10px', background: t.paper, borderTop: `1px dashed ${t.carryEdge}` }}>
          {remaining.map((it) => (
            <UCarryoverRow key={it.id} t={t} item={it} variant="section" getMeta={getMeta}
              onResolve={(action) => setResolved((r) => ({ ...r, [it.id]: action }))} />
          ))}
        </div>
      )}
    </div>
  );
}

function UCarryoverRow({ t, item, variant, getMeta, onResolve }) {
  const meta = getMeta ? getMeta(item) : (item.was || item.fromDay || '');
  const compact = variant === 'section';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: compact ? '5px 0' : '8px 0',
      borderBottom: `1px dashed ${t.ruleFaint}`,
    }}>
      <span style={{
        fontSize: compact ? 12 : 13.5, color: t.ink, flex: 1, minWidth: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{item.title}</span>
      {meta && (
        <span style={{
          fontFamily: t.mono, fontSize: 9, color: t.inkFaint,
          whiteSpace: 'nowrap',
        }}>{meta}</span>
      )}
      <div style={{ display: 'flex', gap: 4, flex: '0 0 auto' }}>
        {item.fromTop3 && (
          <UTinyButton t={t} onClick={() => onResolve('top3')} accent title="移到今天三件事">↑ 三件事</UTinyButton>
        )}
        <UTinyButton t={t} onClick={() => onResolve('planned')} title="移到今天計劃內">→ 計劃內</UTinyButton>
        <UTinyButton t={t} onClick={() => onResolve('drop')} ghost title="略過">略過</UTinyButton>
      </div>
    </div>
  );
}

function UTinyButton({ t, onClick, children, accent, ghost, title }) {
  return (
    <button onClick={onClick} title={title} style={{
      padding: '3px 8px',
      fontFamily: t.bodySans, fontSize: 11, fontWeight: 600,
      border: `1px solid ${ghost ? 'transparent' : (accent ? t.accent : t.rule)}`,
      background: ghost ? 'transparent' : (accent ? t.accent : t.paper),
      color: ghost ? t.inkSoft : (accent ? '#fff' : t.ink),
      borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap',
      letterSpacing: 0.3,
    }}>{children}</button>
  );
}

// ─────────────────────────────────────────────────────────────
// TODAY VIEW — Daybook (B layout) with yesterday-carryover banner
// ─────────────────────────────────────────────────────────────
function UTodayView({ t }) {
  const [top3, setTop3] = React.useState(TODAY_TOP3);
  const [other, setOther] = React.useState(TODAY_OTHER);
  const [selDay, setSelDay] = React.useState(4);

  const toggleTop3 = (id) => setTop3((xs) => xs.map((x) => x.id === id ? { ...x, done: !x.done } : x));
  const toggleOther = (id) => setOther((xs) => xs.map((x) => x.id === id ? { ...x, done: !x.done } : x));
  const togglePlanned = (id) => setOther((xs) => xs.map((x) => x.id === id ? { ...x, planned: !x.planned } : x));

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'grid', gridTemplateColumns: '240px 1fr 280px',
    }}>
      <D2WeekRail t={t} selected={selDay} onSelect={setSelDay} />

      <div style={{ background: t.paper, position: 'relative', overflow: 'auto', padding: '24px 48px 32px' }}>
        <PaperTexture opacity={t.mode === 'dark' ? 0.3 : 0.5} />
        <div style={{ position: 'relative' }}>
          <UCarryoverBanner t={t}
            items={YESTERDAY_LEFTOVER}
            eyebrow="從昨天延續"
            label={`5/${YESTERDAY.d}（${YESTERDAY.w}）有 ${YESTERDAY_LEFTOVER.length} 件沒做完`}
            period="YESTERDAY" />

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 6 }}>
            <span style={{ fontFamily: t.bodySans, fontSize: 11, fontWeight: 700, letterSpacing: 2, color: t.inkFaint }}>FRIDAY · 五 · 第 21 週</span>
            <div style={{ flex: 1, height: 1, background: t.ruleFaint }} />
            <span style={{ fontFamily: t.mono, fontSize: 11, color: t.inkFaint }}>2026-05-22 · DAY 22/31</span>
          </div>
          <h1 style={{ margin: 0, marginBottom: 24, fontFamily: t.headSerif, fontSize: 64, fontWeight: 500, letterSpacing: -1.8, lineHeight: 0.9 }}>May 22</h1>

          {/* Top 3 */}
          <div style={{ marginBottom: 22 }}>
            <D2SectionLabel t={t}>今天最重要的三件事</D2SectionLabel>
            <div style={{ marginTop: 8 }}>
              {top3.map((task, i) => {
                const mref = monthRef(task.tag);
                return <D2TopRow key={task.id} t={t} n={i + 1} task={task} mref={mref} onToggle={() => toggleTop3(task.id)} />;
              })}
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <D2SectionLabel t={t}>其他計劃內</D2SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 24px', marginTop: 8 }}>
              {other.filter((o) => o.planned).map((o) => (
                <D2OtherRow key={o.id} t={t} item={o} onToggle={() => toggleOther(o.id)} onTogglePlanned={() => togglePlanned(o.id)} />
              ))}
            </div>
          </div>

          <div>
            <D2SectionLabel t={t} accent>今天臨時加的</D2SectionLabel>
            <div style={{ marginTop: 8 }}>
              {other.filter((o) => !o.planned).map((o) => (
                <D2OtherRow key={o.id} t={t} item={o} onToggle={() => toggleOther(o.id)} onTogglePlanned={() => togglePlanned(o.id)} unplanned />
              ))}
              <button style={{
                marginTop: 8, padding: '9px 12px', border: `1px dashed ${t.rule}`, background: 'transparent',
                color: t.inkFaint, fontFamily: t.bodySans, fontSize: 13, textAlign: 'left', cursor: 'pointer',
                borderRadius: 4, width: '100%',
              }}>＋ 加一件今天臨時冒出來的事（會自動標為計劃外）</button>
            </div>
          </div>
        </div>
      </div>

      <D2MonthDigest t={t} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PLAN VIEW — three-column spread with per-column carryover at the top
// ─────────────────────────────────────────────────────────────
function UPlanView({ t }) {
  const [monthly, setMonthly] = React.useState(MONTHLY_OTHER);
  const [monthlyTop3, setMonthlyTop3] = React.useState(MONTHLY_TOP3);
  const [todayOther, setTodayOther] = React.useState(TODAY_OTHER);

  // Propagate a today task's done flip to its linked monthly item (via
  // task.tag). Only the "other" monthly items auto-flip — the big top3
  // items (推出 MVP、改版網站…) are aggregates that span many sub-tasks,
  // so one daily completion shouldn't mark the whole thing done. Those
  // are toggled manually via the hero card checkbox.
  const propagateToMonthly = (tag, nowDone) => {
    if (!tag) return;
    setMonthly((ms) => ms.map((m) => m.id === tag
      ? { ...m, done: nowDone, doneOn: nowDone ? TODAY.dateOf : undefined }
      : m));
  };
  const toggleMonthly = (id) => setMonthly((xs) => xs.map((x) => x.id === id ? { ...x, done: !x.done, doneOn: !x.done ? TODAY.dateOf : undefined } : x));
  const toggleMonthlyTop3 = (id) => setMonthlyTop3((xs) => xs.map((x) => x.id === id ? { ...x, done: !x.done, doneOn: !x.done ? TODAY.dateOf : undefined } : x));
  const toggleToday = (id) => setTodayOther((xs) => {
    const next = xs.map((x) => x.id === id ? { ...x, done: !x.done } : x);
    const task = next.find((x) => x.id === id);
    if (task) propagateToMonthly(task.tag, task.done);
    return next;
  });
  const togglePlannedM = (id) => setMonthly((xs) => xs.map((x) => x.id === id ? { ...x, planned: !x.planned } : x));
  const togglePlannedT = (id) => setTodayOther((xs) => xs.map((x) => x.id === id ? { ...x, planned: !x.planned } : x));

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'grid', gridTemplateColumns: '0.95fr 1.15fr 1.05fr',
      gap: 18, padding: '18px 22px 22px',
      background: t.paperEdge,
    }}>
      {/* Month column */}
      <D1Page t={t} eyebrow="MONTH · 規劃" title="May 2026"
        meta={<span>本月最重要的三件事 + 計劃任務</span>}>
        <UCarryoverSection t={t} items={LAST_MONTH_LEFTOVER}
          eyebrow="從上月延續"
          label={LAST_MONTH.label + ' 沒做完的任務'}
          getMeta={(it) => it.was}
        />

        <div style={{ fontFamily: t.headSerif, fontSize: 14, color: t.inkSoft, marginBottom: 10 }}>
          本月最重要的三件事
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          {monthlyTop3.map((m) => (
            <D1HeroCard key={m.id} t={t} m={m} onToggle={() => toggleMonthlyTop3(m.id)} />
          ))}
        </div>

        <D1Divider t={t} label="其他計劃內" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8, marginBottom: 18 }}>
          {monthly.filter((o) => o.planned).map((o) => (
            <D1MonthRow key={o.id} t={t} item={o} onToggle={() => toggleMonthly(o.id)} onTogglePlanned={() => togglePlannedM(o.id)} />
          ))}
        </div>

        <D1Divider t={t} label="計劃外" accent />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
          {monthly.filter((o) => !o.planned).map((o) => (
            <D1MonthRow key={o.id} t={t} item={o} onToggle={() => toggleMonthly(o.id)} onTogglePlanned={() => togglePlannedM(o.id)} unplanned />
          ))}
          <button style={{
            marginTop: 4, padding: '6px 8px', border: 'none', background: 'transparent',
            color: t.inkFaint, fontFamily: t.bodySans, fontSize: 12, textAlign: 'left', cursor: 'pointer', borderRadius: 4,
          }}>＋ 新增任務（會自動標為計劃外）</button>
        </div>
      </D1Page>

      {/* Week column */}
      <D1Page t={t} eyebrow="WEEK · 規劃" title="第 21 週"
        meta={<span>5/18 — 5/24 · 每日三件事</span>}>
        <UCarryoverSection t={t} items={LAST_WEEK_LEFTOVER}
          eyebrow="從上週延續"
          label={LAST_WEEK.label + ' 沒做完的任務'}
          getMeta={(it) => it.fromDay}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {WEEK_DAYS.map((day) => <D1WeekRow key={day.i} t={t} day={day} />)}
        </div>
      </D1Page>

      {/* Day column */}
      <D1Page t={t} eyebrow="TODAY · 五" title="May 22">
        <UCarryoverSection t={t} items={YESTERDAY_LEFTOVER}
          eyebrow="從昨天延續"
          label={`5/${YESTERDAY.d}（${YESTERDAY.w}）`}
          getMeta={(it) => it.was}
        />

        <div style={{
          marginBottom: 18, padding: '14px 16px',
          background: t.accentSoft, border: `1px solid ${t.accent}`,
          borderRadius: 3,
        }}>
          <div style={{ fontFamily: t.bodySans, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: t.accentText, marginBottom: 8 }}>
            今天的三件事
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {TODAY_TOP3.map((task, i) => {
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
                    <div style={{ fontSize: 14, fontWeight: 500, color: t.ink, lineHeight: 1.35, marginBottom: 2 }}>{task.title}</div>
                    {ref && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: t.inkSoft }}>
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

        <D1Divider t={t} label="其他計劃內" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8, marginBottom: 18 }}>
          {todayOther.filter((o) => o.planned).map((o) => (
            <D1TodayRow key={o.id} t={t} item={o} onToggle={() => toggleToday(o.id)} onTogglePlanned={() => togglePlannedT(o.id)} />
          ))}
        </div>

        <D1Divider t={t} label="今天臨時加的" accent />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
          {todayOther.filter((o) => !o.planned).map((o) => (
            <D1TodayRow key={o.id} t={t} item={o} onToggle={() => toggleToday(o.id)} onTogglePlanned={() => togglePlannedT(o.id)} unplanned />
          ))}
          <button style={{
            marginTop: 4, padding: '6px 8px', border: 'none', background: 'transparent',
            color: t.inkFaint, fontFamily: t.bodySans, fontSize: 12, textAlign: 'left', cursor: 'pointer', borderRadius: 4,
          }}>＋ 加一件今天的事</button>
        </div>
      </D1Page>
    </div>
  );
}

Object.assign(window, { UnifiedApp });
