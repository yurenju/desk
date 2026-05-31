import { useEffect, useRef, useState } from "react";

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
  // Keep the latest onAuthenticated without re-running the polling effect.
  const onAuthenticatedRef = useRef(onAuthenticated);
  useEffect(() => {
    onAuthenticatedRef.current = onAuthenticated;
  });

  useEffect(() => {
    let cancelled = false;

    const poll = (pollingId: string, pollIntervalMs: number) => {
      const tick = async () => {
        const res = await fetch(
          `/api/auth/status?polling_id=${encodeURIComponent(pollingId)}`,
        );
        if (cancelled) return;
        if (!res.ok) {
          // Infra failure (e.g. a non-JSON 5xx). Surface an error and stop
          // polling rather than letting res.json() throw and silently stall.
          setState("error");
          return;
        }
        const data = (await res.json()) as { state: string; slow_down?: boolean };
        if (cancelled) return;
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
      if (cancelled) return;
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
      if (cancelled) return;
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

    return () => {
      cancelled = true;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!init) {
    return <main>準備登入中⋯</main>;
  }

  return (
    <main>
      <h1>登入 WSPC</h1>
      <p>請點下方按鈕在 WSPC 完成授權，授權完成後本頁會自動進入。</p>
      <a href={init.verificationUriComplete} target="_blank" rel="noopener noreferrer">
        在 WSPC 開啟授權頁
      </a>
      <p>
        驗證碼：<strong>{init.userCode}</strong>
      </p>
      {state === "pending" && <p>等待授權中⋯</p>}
      {state === "denied" && <p>授權已拒絕，登入失敗。</p>}
      {state === "expired" && <p>授權已過期，請重新整理頁面再試。</p>}
      {state === "error" && <p>系統錯誤，請稍後再試。</p>}
    </main>
  );
}
