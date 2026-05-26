// Tweakable defaults (host parses + persists these).
const APP_TWEAKS = /*EDITMODE-BEGIN*/{
  "mode": "light",
  "accent": "#5C9352"
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(APP_TWEAKS);
  const t = React.useMemo(() => buildTheme(tweaks.mode, tweaks.accent), [tweaks.mode, tweaks.accent]);

  // Paint the canvas backdrop to match the current paper edge so dark mode
  // doesn't show a bright canvas around the artboards.
  React.useEffect(() => {
    document.body.style.background = tweaks.mode === 'dark' ? '#1a1612' : '#f0eee9';
  }, [tweaks.mode]);

  return (
    <>
      <DesignCanvas>
        <DCSection id="unified" title="兩個模式：規劃 vs. 今天"
          subtitle="同一個 app，依使用情境切換。右上 toggle 可切換；每個 boundary 都有「從上個週期延續」的回顧 UI。">
          <DCArtboard id="u-today" label="今天 mode（每日執行）" width={1500} height={920}>
            <UnifiedApp t={t} initialMode="today" />
          </DCArtboard>
          <DCArtboard id="u-plan" label="規劃 mode（月初／週初／日初）" width={1500} height={920}>
            <UnifiedApp t={t} initialMode="plan" />
          </DCArtboard>
        </DCSection>

        <DCSection id="unified-mobile" title="同一個 app · Mobile"
          subtitle="窄畫面下單欄堆疊；規劃模式把月／週／日垂直堆，今天模式聚焦今天並把週/月放在下方 peek。">
          <DCArtboard id="m-today" label="今天 mode · Mobile" width={460} height={920}>
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tweaks.mode === 'dark' ? '#1a1612' : '#f0eee9' }}>
              <IOSDevice dark={tweaks.mode === 'dark'}>
                <UnifiedMobileApp t={t} initialMode="today" />
              </IOSDevice>
            </div>
          </DCArtboard>
          <DCArtboard id="m-plan" label="規劃 mode · Mobile" width={460} height={920}>
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tweaks.mode === 'dark' ? '#1a1612' : '#f0eee9' }}>
              <IOSDevice dark={tweaks.mode === 'dark'}>
                <UnifiedMobileApp t={t} initialMode="plan" />
              </IOSDevice>
            </div>
          </DCArtboard>
        </DCSection>

        <DCSection id="archive" title="早期方向（參考）"
          subtitle="這是上一輪的三個探索方向。整合版採用了 A（規劃）+ B（今天）的組合。">
          <DCArtboard id="d1" label="A · Paper Planner — 三欄並列" width={1440} height={900}>
            <Direction1 t={t} />
          </DCArtboard>
          <DCArtboard id="d2" label="B · Daybook — 以今天為主" width={1440} height={900}>
            <Direction2 t={t} />
          </DCArtboard>
          <DCArtboard id="d3" label="C · Stream — mobile-first" width={420} height={1180}>
            <Direction3 t={t} />
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection label="主題">
          <TweakRadio label="模式" value={tweaks.mode} onChange={(v) => setTweak('mode', v)}
            options={[
              { value: 'light', label: '亮' },
              { value: 'dark',  label: '暗' },
            ]} />
          <TweakColor label="Accent" value={tweaks.accent} onChange={(v) => setTweak('accent', v)}
            options={ACCENT_OPTIONS.map((o) => o.hex)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
