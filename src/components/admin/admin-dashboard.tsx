"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowUpRight,
  CalendarClock,
  Database,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ManagedRepository } from "@/lib/admin/types";

function date(value: string | null): string {
  if (!value) return "기록 없음";
  return new Date(value).toLocaleString("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusTone(status: string | null): string {
  if (status === "complete") return "bg-[#dce9df] text-[#24563d]";
  if (status === "failed") return "bg-[#f4ddd7] text-[#8d321f]";
  if (status === "partial") return "bg-[#f3e7c6] text-[#775a12]";
  return "bg-[#e8e6dd] text-[#173b33]/65";
}

export function AdminDashboard({
  initialRepositories,
  adminUser,
}: {
  initialRepositories: ManagedRepository[];
  adminUser: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [period, setPeriod] = useState("1y");
  const [scheduleDay, setScheduleDay] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function register(event: React.FormEvent) {
    event.preventDefault();
    setBusy("register");
    setMessage(null);
    const response = await fetch("/api/admin/repositories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, period, scheduleDay, enabled: true }),
    });
    const body = (await response.json()) as { error?: string };
    setBusy(null);
    if (!response.ok) {
      setMessage(body.error ?? "등록에 실패했습니다.");
      return;
    }
    setUrl("");
    setMessage("저장소를 등록하고 기여자·stargazer 초기 수집을 예약했습니다.");
    router.refresh();
  }

  async function run(repository: ManagedRepository) {
    setBusy(repository.id);
    setMessage(null);
    const response = await fetch(
      `/api/admin/repositories/${repository.id}/run`,
      { method: "POST" }
    );
    const body = (await response.json()) as { error?: string };
    setBusy(null);
    setMessage(
      response.ok
        ? `${repository.owner}/${repository.repo} 분석을 예약했습니다.`
        : body.error ?? "분석 예약에 실패했습니다."
    );
    router.refresh();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  const enabledCount = initialRepositories.filter(
    (repository) => repository.enabled
  ).length;
  const contributorCount = initialRepositories.reduce(
    (sum, repository) => sum + repository.contributorCount,
    0
  );
  const backupCount = initialRepositories.reduce(
    (sum, repository) => sum + repository.backupCount,
    0
  );
  const summaryCards: Array<{
    label: string;
    value: string;
    icon: LucideIcon;
  }> = [
    {
      label: "자동 실행 저장소",
      value: `${enabledCount}곳`,
      icon: CalendarClock,
    },
    {
      label: "확보한 기여자 ID",
      value: `${contributorCount.toLocaleString()}명`,
      icon: Users,
    },
    {
      label: "월별 파일 백업",
      value: `${backupCount.toLocaleString()}건`,
      icon: Archive,
    },
  ];

  return (
    <main className="min-h-screen bg-[#e9e4d7] pb-24 pt-20 text-[#173b33]">
      <section className="border-b border-[#173b33]/20 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#c45a33]">
                Operations ledger · {adminUser}
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
                월별 성과 기록실
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#173b33]/65 sm:text-base">
                매월 같은 기준으로 수집하고, 판정 근거와 파일 백업을 함께
                남깁니다. 자동 실행은 매일 10:00 KST에 등록일을 확인합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 border border-[#173b33]/25 px-4 py-2 text-sm font-medium hover:bg-[#173b33] hover:text-white"
            >
              <LogOut className="size-4" />
              로그아웃
            </button>
          </div>

          <div className="mt-10 grid gap-px border border-[#173b33]/20 bg-[#173b33]/20 sm:grid-cols-3">
            {summaryCards.map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-[#f4f0e5] p-5 sm:p-6">
                <Icon className="size-5 text-[#c45a33]" aria-hidden />
                <p className="mt-6 text-xs font-semibold uppercase tracking-[0.15em] text-[#173b33]/55">
                  {label}
                </p>
                <p className="mt-1 font-display text-3xl font-semibold">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[360px_1fr]">
        <aside>
          <form
            onSubmit={register}
            className="sticky top-24 border border-[#173b33]/20 bg-[#f8f5ec] p-6 shadow-[8px_8px_0_#c45a33]"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-[#173b33] text-white">
                <Plus className="size-4" />
              </span>
              <div>
                <h2 className="font-display text-xl font-semibold">
                  저장소 등록
                </h2>
                <p className="text-xs text-[#173b33]/55">
                  GitHub 공개 저장소
                </p>
              </div>
            </div>
            <label className="mt-7 block">
              <span className="mb-2 block text-xs font-semibold">저장소 URL</span>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                required
                placeholder="https://github.com/owner/repo"
                className="h-11 w-full border-b-2 border-[#173b33] bg-transparent px-1 text-sm outline-none placeholder:text-[#173b33]/30"
              />
            </label>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <label>
                <span className="mb-2 block text-xs font-semibold">
                  분석 기간
                </span>
                <select
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                  className="h-10 w-full border border-[#173b33]/30 bg-white px-2 text-sm"
                >
                  <option value="1m">최근 1개월</option>
                  <option value="3m">최근 3개월</option>
                  <option value="6m">최근 6개월</option>
                  <option value="1y">최근 1년</option>
                </select>
              </label>
              <label>
                <span className="mb-2 block text-xs font-semibold">
                  매월 실행일
                </span>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={scheduleDay}
                  onChange={(event) => setScheduleDay(Number(event.target.value))}
                  className="h-10 w-full border border-[#173b33]/30 bg-white px-3 text-sm"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={busy === "register"}
              className="mt-6 flex h-11 w-full items-center justify-center gap-2 bg-[#173b33] text-sm font-semibold text-white hover:bg-[#24594d] disabled:opacity-50"
            >
              {busy === "register" ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Database className="size-4" />
              )}
              등록하고 초기 수집
            </button>
            {message && (
              <p className="mt-4 border-l-2 border-[#c45a33] pl-3 text-xs leading-5 text-[#173b33]/70">
                {message}
              </p>
            )}
          </form>
        </aside>

        <section>
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c45a33]">
                Registry
              </p>
              <h2 className="mt-1 font-display text-3xl font-semibold">
                등록 저장소
              </h2>
            </div>
            <span className="font-mono text-xs text-[#173b33]/50">
              {initialRepositories.length.toString().padStart(2, "0")} records
            </span>
          </div>

          <div className="space-y-4">
            {initialRepositories.length === 0 && (
              <div className="border border-dashed border-[#173b33]/30 px-6 py-16 text-center">
                <p className="font-display text-2xl">첫 저장소를 등록해주세요.</p>
                <p className="mt-2 text-sm text-[#173b33]/55">
                  등록 즉시 기여자 명부와 stargazer 표본 수집을 시작합니다.
                </p>
              </div>
            )}
            {initialRepositories.map((repository, index) => (
              <article
                key={repository.id}
                className="group border border-[#173b33]/20 bg-[#f8f5ec] transition hover:border-[#173b33]/45"
              >
                <div className="grid lg:grid-cols-[72px_1fr_auto]">
                  <div className="hidden border-r border-[#173b33]/15 p-4 font-mono text-xs text-[#173b33]/35 lg:block">
                    {(index + 1).toString().padStart(2, "0")}
                  </div>
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-display text-2xl font-semibold">
                        {repository.owner}/{repository.repo}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase ${statusTone(repository.lastStatus)}`}
                      >
                        {repository.lastStatus ?? "not run"}
                      </span>
                      {!repository.enabled && (
                        <span className="rounded-full border border-[#173b33]/20 px-2.5 py-1 text-[0.65rem]">
                          자동 실행 중지
                        </span>
                      )}
                    </div>
                    <div className="mt-5 grid gap-4 text-xs text-[#173b33]/60 sm:grid-cols-3">
                      <div>
                        <p className="font-semibold text-[#173b33]">다음 실행</p>
                        <p className="mt-1">{date(repository.nextRunAt)}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-[#173b33]">기여자 명부</p>
                        <p className="mt-1">
                          {repository.contributorCount.toLocaleString()}명 ·{" "}
                          {repository.contributorSyncStatus}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-[#173b33]">백업</p>
                        <p className="mt-1">
                          {repository.backupCount}건 · {repository.backupStatus}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-t border-[#173b33]/15 p-4 lg:border-l lg:border-t-0">
                    <button
                      type="button"
                      onClick={() => run(repository)}
                      disabled={busy === repository.id}
                      title="지금 분석"
                      className="grid size-10 place-items-center border border-[#173b33]/25 hover:bg-[#c45a33] hover:text-white disabled:opacity-40"
                    >
                      {busy === repository.id ? (
                        <RefreshCw className="size-4 animate-spin" />
                      ) : (
                        <Play className="size-4" />
                      )}
                    </button>
                    <Link
                      href={`/admin/repositories/${repository.id}`}
                      className="flex h-10 items-center gap-2 bg-[#173b33] px-4 text-sm font-semibold text-white hover:bg-[#24594d]"
                    >
                      관리
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
