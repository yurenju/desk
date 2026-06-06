import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../ui/Button/Button";
import styles from "./LoginPage.module.css";

interface LoginInit {
  verificationUriComplete: string;
  userCode: string;
  pollingId: string;
  interval: number;
  expiresIn: number;
}

type PollState = "idle" | "pending" | "authenticated" | "denied" | "expired" | "error";

interface Props {
  onAuthenticated: () => void;
}

export function LoginPage({ onAuthenticated }: Props) {
  const [init, setInit] = useState<LoginInit | null>(null);
  const [state, setState] = useState<PollState>("idle");
  const timerRef = useRef<number | null>(null);
  // A per-run cancellation token. Each start() bumps this; in-flight async
  // work checks it so a stale poll from a previous run can't mutate state.
  const runIdRef = useRef(0);
  // Keep the latest onAuthenticated without re-running the polling effect.
  const onAuthenticatedRef = useRef(onAuthenticated);
  useEffect(() => {
    onAuthenticatedRef.current = onAuthenticated;
  });

  // start() initiates one round of the device flow: POST /api/auth/login,
  // then poll /api/auth/status. It is restartable — calling it again
  // invalidates the previous run and clears any pending timer.
  const start = useCallback(() => {
    const myRun = ++runIdRef.current;
    const cancelled = () => runIdRef.current !== myRun;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);

    const poll = (pollingId: string, pollIntervalMs: number) => {
      const tick = async () => {
        const res = await fetch(
          `/api/auth/status?polling_id=${encodeURIComponent(pollingId)}`,
        );
        if (cancelled()) return;
        if (!res.ok) {
          // Infra failure (e.g. a non-JSON 5xx). Surface an error and stop
          // polling rather than letting res.json() throw and silently stall.
          setState("error");
          return;
        }
        const data = (await res.json()) as { state: string; slow_down?: boolean };
        if (cancelled()) return;
        if (data.state === "authenticated") {
          setState("authenticated");
          onAuthenticatedRef.current();
          return;
        }
        if (data.state === "denied") {
          setState("denied");
          return;
        }
        if (data.state === "expired") {
          setState("expired");
          return;
        }
        if (data.slow_down) {
          // RFC 8628 §3.5: on slow_down, increase polling interval. Follow
          // wspc-cli and add a fixed +5s instead of doubling — keeps cap
          // predictable.
          pollIntervalMs += 5000;
        }
        timerRef.current = window.setTimeout(tick, pollIntervalMs);
      };
      timerRef.current = window.setTimeout(tick, pollIntervalMs);
    };

    (async () => {
      const res = await fetch("/api/auth/login", { method: "POST" });
      if (cancelled()) return;
      if (!res.ok) {
        setState("error");
        return;
      }
      const data = (await res.json()) as {
        verification_uri_complete: string;
        user_code: string;
        polling_id: string;
        interval: number;
        expires_in: number;
      };
      if (cancelled()) return;
      setInit({
        verificationUriComplete: data.verification_uri_complete,
        userCode: data.user_code,
        pollingId: data.polling_id,
        interval: data.interval,
        expiresIn: data.expires_in,
      });
      setState("pending");
      // Start polling immediately rather than waiting for a re-render so the
      // status request is scheduled in the same task as the login response.
      poll(data.polling_id, data.interval * 1000);
    })();
  }, []);

  // restart() re-initiates the whole device flow: reset UI to a clean slate,
  // then start a fresh run. Shared by all three failure states.
  const restart = useCallback(() => {
    setInit(null);
    setState("idle");
    start();
  }, [start]);

  useEffect(() => {
    start();
    return () => {
      // Invalidate the active run and clear any pending poll timer.
      runIdRef.current++;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [start]);

  if (!init) {
    return (
      <main className={styles.page}>
        <p className={styles.loading}>準備登入中⋯</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1 className={styles.title}>登入 WSPC</h1>
        <p className={styles.lead}>
          點下方按鈕到 WSPC，核對畫面上的碼與下方一致後按 Approve，本頁會自動進入。
        </p>

        <a
          className={styles.primaryLink}
          href={init.verificationUriComplete}
          target="_blank"
          rel="noopener noreferrer"
        >
          在 WSPC 開啟授權頁 ↗
        </a>

        <div className={styles.codeBlock}>
          <span className={styles.codeLabel}>核對碼</span>
          <span className={styles.code}>{init.userCode}</span>
        </div>

        {state === "pending" && (
          <p className={`${styles.status} ${styles.statusPending}`}>⟳ 等待授權中⋯</p>
        )}
        {state === "denied" && (
          <div className={`${styles.status} ${styles.statusDenied}`}>
            <p className={styles.statusText}>授權已被拒絕。</p>
            <Button variant="primary" onClick={restart}>
              重新登入
            </Button>
          </div>
        )}
        {state === "expired" && (
          <div className={`${styles.status} ${styles.statusExpired}`}>
            <p className={styles.statusText}>驗證碼已過期。</p>
            <Button variant="primary" onClick={restart}>
              重新產生驗證碼
            </Button>
          </div>
        )}
        {state === "error" && (
          <div className={`${styles.status} ${styles.statusError}`}>
            <p className={styles.statusText}>系統錯誤，請稍後再試。</p>
            <Button variant="primary" onClick={restart}>
              重試
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
