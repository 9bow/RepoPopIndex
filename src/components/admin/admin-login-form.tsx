"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";

export function AdminLoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(body.error ?? "로그인에 실패했습니다.");
      setLoading(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#173b33]/60">
          관리자 비밀번호
        </span>
        <div className="flex items-center border-b-2 border-[#173b33] bg-white/60 px-3">
          <KeyRound className="size-4 text-[#c45a33]" aria-hidden />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={!configured || loading}
            autoComplete="current-password"
            className="h-12 w-full bg-transparent px-3 text-base outline-none placeholder:text-[#173b33]/35"
            placeholder="비밀번호 입력"
          />
        </div>
      </label>
      {error && (
        <p className="border-l-2 border-[#c45a33] pl-3 text-sm text-[#8d321f]">
          {error}
        </p>
      )}
      {!configured && (
        <p className="border-l-2 border-[#c45a33] pl-3 text-sm leading-relaxed text-[#8d321f]">
          `ADMIN_PASSWORD`와 `ADMIN_SESSION_SECRET` 환경변수를 먼저
          설정해야 합니다.
        </p>
      )}
      <button
        type="submit"
        disabled={!configured || loading || !password}
        className="w-full bg-[#173b33] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#24594d] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "확인 중…" : "운영 대장 열기"}
      </button>
    </form>
  );
}
