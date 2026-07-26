"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  Play,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ManagedContributor,
  ManagedRepository,
  ReportBackup,
  StargazerDistribution,
  StargazerProfile,
} from "@/lib/admin/types";

type Tab = "contributors" | "stargazers" | "backups" | "settings";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function ManagedRepositoryDetail({
  initialRepository,
  initialContributors,
  distribution,
  profiles,
  backups,
}: {
  initialRepository: ManagedRepository;
  initialContributors: ManagedContributor[];
  distribution: StargazerDistribution | null;
  profiles: StargazerProfile[];
  backups: ReportBackup[];
}) {
  const router = useRouter();
  const [repository, setRepository] = useState(initialRepository);
  const [contributors, setContributors] = useState(initialContributors);
  const [tab, setTab] = useState<Tab>("contributors");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "internal" | "other">("all");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const pageSize = 100;

  const filteredContributors = useMemo(() => {
    const query = search.trim().toLowerCase();
    return contributors.filter((contributor) => {
      if (filter === "internal" && !contributor.internal) return false;
      if (filter === "other" && contributor.internal) return false;
      return (
        !query ||
        contributor.login.toLowerCase().includes(query) ||
        contributor.nodeId?.toLowerCase().includes(query) ||
        String(contributor.databaseId ?? "").includes(query)
      );
    });
  }, [contributors, filter, search]);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredContributors.length / pageSize)
  );
  const visibleContributors = filteredContributors.slice(
    (page - 1) * pageSize,
    page * pageSize
  );
  const internalCount = contributors.filter(
    (contributor) => contributor.internal
  ).length;
  const summaryCards: Array<{
    label: string;
    value: number;
    icon: LucideIcon;
  }> = [
    { label: "전체 기여자", value: contributors.length, icon: Users },
    { label: "확인된 내부", value: internalCount, icon: ShieldCheck },
    {
      label: "stargazer 표본",
      value: distribution?.sampledCount ?? 0,
      icon: Star,
    },
    { label: "월별 백업", value: backups.length, icon: Archive },
  ];
  const tabs: Array<{ value: Tab; label: string; icon: LucideIcon }> = [
    { value: "contributors", label: "기여자 명부", icon: Users },
    { value: "stargazers", label: "Star 계정 분포", icon: BarChart3 },
    { value: "backups", label: "월별 백업", icon: Archive },
    { value: "settings", label: "자동 실행 설정", icon: Settings2 },
  ];

  async function action(path: string, label: string) {
    setBusy(path);
    setMessage(null);
    const response = await fetch(path, { method: "POST" });
    const body = (await response.json()) as { error?: string };
    setBusy(null);
    setMessage(response.ok ? label : body.error ?? "요청에 실패했습니다.");
    router.refresh();
  }

  async function toggleInternal(contributor: ManagedContributor) {
    const internal = !contributor.internal;
    setContributors((current) =>
      current.map((item) =>
        item.id === contributor.id ? { ...item, internal } : item
      )
    );
    const response = await fetch(
      `/api/admin/repositories/${repository.id}/contributors`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contributorId: contributor.id,
          internal,
        }),
      }
    );
    if (!response.ok) {
      setContributors((current) =>
        current.map((item) =>
          item.id === contributor.id
            ? { ...item, internal: contributor.internal }
            : item
        )
      );
      setMessage("내부 직원 표시를 저장하지 못했습니다.");
    }
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("settings");
    const form = new FormData(event.currentTarget);
    const response = await fetch(
      `/api/admin/repositories/${repository.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: form.get("enabled") === "on",
          period: form.get("period"),
          scheduleDay: Number(form.get("scheduleDay")),
        }),
      }
    );
    const body = (await response.json()) as {
      error?: string;
      repository?: ManagedRepository;
    };
    setBusy(null);
    if (response.ok && body.repository) {
      setRepository(body.repository);
      setMessage("자동 실행 설정을 저장했습니다.");
    } else {
      setMessage(body.error ?? "설정을 저장하지 못했습니다.");
    }
  }

  const monthlyChart = useMemo(() => {
    if (!distribution) return [];
    const signups = new Map(
      distribution.signupMonths.map((item) => [item.month, item.count])
    );
    const stars = new Map(
      distribution.starMonths.map((item) => [item.month, item.count])
    );
    return [...new Set([...signups.keys(), ...stars.keys()])]
      .sort()
      .slice(-24)
      .map((month) => ({
        month,
        signups: signups.get(month) ?? 0,
        stars: stars.get(month) ?? 0,
      }));
  }, [distribution]);

  return (
    <main className="min-h-screen bg-[#e9e4d7] pb-24 pt-20 text-[#173b33]">
      <header className="border-b border-[#173b33]/20 bg-[#173b33] px-4 py-8 text-[#f8f5ec] sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#f8f5ec]/65 hover:text-white"
          >
            <ArrowLeft className="size-4" />
            운영 대장
          </Link>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#df7752]">
                Managed repository
              </p>
              <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
                {repository.owner}/{repository.repo}
              </h1>
              <p className="mt-3 text-sm text-[#f8f5ec]/60">
                매월 {repository.scheduleDay}일 · {repository.period} 분석 · 다음
                실행 {formatDate(repository.nextRunAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  action(
                    `/api/admin/repositories/${repository.id}/run`,
                    "분석을 예약했습니다."
                  )
                }
                disabled={busy !== null}
                className="flex h-10 items-center gap-2 bg-[#df7752] px-4 text-sm font-semibold text-white hover:bg-[#ee8964] disabled:opacity-50"
              >
                <Play className="size-4" />
                지금 분석
              </button>
              <Link
                href={`/report/github/${repository.owner}/${repository.repo}/${repository.period}`}
                target="_blank"
                className="flex h-10 items-center gap-2 border border-white/25 px-4 text-sm font-semibold hover:bg-white hover:text-[#173b33]"
              >
                공개 리포트
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-2 gap-px border border-[#173b33]/20 bg-[#173b33]/20 sm:grid-cols-4">
          {summaryCards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-[#f8f5ec] p-5">
              <Icon className="size-4 text-[#c45a33]" />
              <p className="mt-5 text-xs text-[#173b33]/55">{label}</p>
              <p className="mt-1 font-display text-3xl font-semibold">
                {value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {message && (
          <div className="mt-5 flex items-start gap-3 border-l-4 border-[#c45a33] bg-[#f8f5ec] px-4 py-3 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#c45a33]" />
            {message}
          </div>
        )}

        <nav className="mt-10 flex gap-1 overflow-x-auto border-b border-[#173b33]/25">
          {tabs.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-semibold ${
                tab === value
                  ? "bg-[#173b33] text-white"
                  : "text-[#173b33]/60 hover:bg-[#173b33]/5"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </nav>

        {tab === "contributors" && (
          <section className="mt-7">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c45a33]">
                  Verified roster
                </p>
                <h2 className="mt-1 font-display text-3xl font-semibold">
                  GitHub ID 기준 기여자 명부
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#173b33]/60">
                  GitHub node ID를 우선 식별자로 사용해 로그인명이 바뀌어도
                  판정을 유지합니다. 익명 커밋과 GitHub 계정에 연결되지 않은
                  작성자는 포함되지 않을 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  action(
                    `/api/admin/repositories/${repository.id}/contributors`,
                    "전체 기여자 명부 갱신을 예약했습니다."
                  )
                }
                disabled={busy !== null}
                className="flex h-10 items-center gap-2 border border-[#173b33]/30 bg-[#f8f5ec] px-4 text-sm font-semibold hover:bg-[#173b33] hover:text-white"
              >
                <RefreshCw
                  className={`size-4 ${busy?.includes("contributors") ? "animate-spin" : ""}`}
                />
                명부 갱신
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <label className="flex min-w-[260px] flex-1 items-center border border-[#173b33]/25 bg-[#f8f5ec] px-3">
                <Search className="size-4 text-[#173b33]/45" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="로그인, node ID, 숫자 ID 검색"
                  className="h-11 w-full bg-transparent px-3 text-sm outline-none"
                />
              </label>
              <select
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value as typeof filter);
                  setPage(1);
                }}
                className="h-11 border border-[#173b33]/25 bg-[#f8f5ec] px-3 text-sm"
              >
                <option value="all">전체 {contributors.length}명</option>
                <option value="internal">내부 {internalCount}명</option>
                <option value="other">
                  그 외 {contributors.length - internalCount}명
                </option>
              </select>
            </div>

            <div className="mt-4 overflow-x-auto border border-[#173b33]/20 bg-[#f8f5ec]">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-[#173b33] text-left text-xs uppercase tracking-wider text-white">
                  <tr>
                    <th className="px-4 py-3">내부</th>
                    <th className="px-4 py-3">GitHub 로그인</th>
                    <th className="px-4 py-3">숫자 ID</th>
                    <th className="px-4 py-3">node ID</th>
                    <th className="px-4 py-3">기여</th>
                    <th className="px-4 py-3">수집 경로</th>
                    <th className="px-4 py-3">최근 관측</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleContributors.map((contributor) => (
                    <tr
                      key={contributor.id}
                      className="border-t border-[#173b33]/12 hover:bg-[#efe9db]"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={contributor.internal}
                          onClick={() => toggleInternal(contributor)}
                          className={`grid size-6 place-items-center border ${
                            contributor.internal
                              ? "border-[#c45a33] bg-[#c45a33] text-white"
                              : "border-[#173b33]/30 bg-white"
                          }`}
                          title="기업 내부 직원 여부"
                        >
                          {contributor.internal && (
                            <ShieldCheck className="size-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        <a
                          href={contributor.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-[#c45a33] hover:underline"
                        >
                          {contributor.login}
                        </a>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {contributor.databaseId ?? "—"}
                      </td>
                      <td className="max-w-[240px] truncate px-4 py-3 font-mono text-[0.68rem] text-[#173b33]/60">
                        {contributor.nodeId ?? "login fallback"}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {contributor.contributions?.toLocaleString() ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#173b33]/60">
                        {contributor.sources.join(", ")}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#173b33]/60">
                        {formatDate(contributor.lastObservedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-[#173b33]/55">
                {filteredContributors.length === 0
                  ? "조건에 맞는 기여자가 없습니다."
                  : `${filteredContributors.length.toLocaleString()}명 중 ${
                      (page - 1) * pageSize + 1
                    }–${Math.min(
                      page * pageSize,
                      filteredContributors.length
                    )}`}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={page === 1}
                  className="border border-[#173b33]/25 px-3 py-1.5 disabled:opacity-30"
                >
                  이전
                </button>
                <span className="px-2 py-1.5 font-mono text-xs">
                  {page}/{totalPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                  disabled={page === totalPages}
                  className="border border-[#173b33]/25 px-3 py-1.5 disabled:opacity-30"
                >
                  다음
                </button>
              </div>
            </div>
          </section>
        )}

        {tab === "stargazers" && (
          <section className="mt-7">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c45a33]">
                  Supporting signal
                </p>
                <h2 className="mt-1 font-display text-3xl font-semibold">
                  Star 계정 가입일 분포
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#173b33]/60">
                  최근 조회 가능한 stargazer 최대 1,000명의 계정 생성일과
                  star 시점을 비교합니다. 신규 계정 비율은 조작 확정값이
                  아니며, 월별 증가량·개발 활동과 함께 검토해야 합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  action(
                    `/api/admin/repositories/${repository.id}/stargazers`,
                    "Stargazer 표본 갱신을 예약했습니다."
                  )
                }
                disabled={busy !== null}
                className="flex h-10 items-center gap-2 border border-[#173b33]/30 bg-[#f8f5ec] px-4 text-sm font-semibold hover:bg-[#173b33] hover:text-white"
              >
                <RefreshCw className="size-4" />
                표본 갱신
              </button>
            </div>

            {!distribution ? (
              <div className="mt-6 border border-dashed border-[#173b33]/30 px-5 py-16 text-center">
                아직 수집된 stargazer 표본이 없습니다.
              </div>
            ) : distribution.status === "unavailable" ? (
              <div className="mt-6 border-l-4 border-[#c45a33] bg-[#f8f5ec] px-5 py-6">
                <p className="font-semibold">Stargazer 명단에 접근할 수 없습니다.</p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#173b33]/65">
                  {distribution.error} Star 총계{" "}
                  {distribution.totalStars.toLocaleString()}개는 계속 확인할 수
                  있지만, 개인별 가입일 분포는 만들지 않습니다.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-6 grid grid-cols-2 gap-px border border-[#173b33]/20 bg-[#173b33]/20 sm:grid-cols-4">
                  {[
                    ["표본 / 전체", `${distribution.sampledCount.toLocaleString()} / ${distribution.totalStars.toLocaleString()}`],
                    ["7일 미만", percent(distribution.youngAccountRatios.under7Days)],
                    ["30일 미만", percent(distribution.youngAccountRatios.under30Days)],
                    ["90일 미만", percent(distribution.youngAccountRatios.under90Days)],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-[#f8f5ec] p-5">
                      <p className="text-xs text-[#173b33]/55">{label}</p>
                      <p className="mt-2 font-display text-2xl font-semibold">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <div className="border border-[#173b33]/20 bg-[#f8f5ec] p-5">
                    <h3 className="font-display text-xl font-semibold">
                      Star 당시 계정 연령
                    </h3>
                    <p className="mt-1 text-xs text-[#173b33]/50">
                      계정 생성일부터 star 시점까지 경과일
                    </p>
                    <div className="mt-5 h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={distribution.ageBuckets}>
                          <CartesianGrid stroke="#173b3320" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#c45a33" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="border border-[#173b33]/20 bg-[#f8f5ec] p-5">
                    <h3 className="font-display text-xl font-semibold">
                      가입 월과 Star 월
                    </h3>
                    <p className="mt-1 text-xs text-[#173b33]/50">
                      최근 표본 내 월별 계정 가입·star 건수
                    </p>
                    <div className="mt-5 h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyChart}>
                          <CartesianGrid stroke="#173b3320" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="signups"
                            name="계정 가입"
                            stroke="#c45a33"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="stars"
                            name="Star"
                            stroke="#173b33"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
                <div className="mt-6 overflow-x-auto border border-[#173b33]/20 bg-[#f8f5ec]">
                  <div className="border-b border-[#173b33]/15 px-5 py-4">
                    <p className="font-semibold">최근 stargazer 표본</p>
                    <p className="mt-1 text-xs text-[#173b33]/50">
                      수집 {formatDate(distribution.sampledAt)} · 상태{" "}
                      {distribution.status}
                      {distribution.error ? ` · ${distribution.error}` : ""}
                    </p>
                  </div>
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="text-left text-xs text-[#173b33]/55">
                      <tr>
                        <th className="px-4 py-3">로그인</th>
                        <th className="px-4 py-3">계정 가입</th>
                        <th className="px-4 py-3">Star 시점</th>
                        <th className="px-4 py-3">Star 당시 계정 연령</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profiles.slice(0, 100).map((profile) => (
                        <tr key={profile.id} className="border-t border-[#173b33]/10">
                          <td className="px-4 py-3 font-semibold">
                            <a
                              href={profile.profileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-[#c45a33] hover:underline"
                            >
                              {profile.login}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {formatDate(profile.accountCreatedAt)}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {formatDate(profile.starredAt)}
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            {profile.accountAgeDaysAtStar.toLocaleString()}일
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}

        {tab === "backups" && (
          <section className="mt-7">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c45a33]">
                  Private archive
                </p>
                <h2 className="mt-1 font-display text-3xl font-semibold">
                  월별 파일 백업
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#173b33]/60">
                  전체 리포트 JSON, 평면 지표 CSV, 여러 시트로 구성된 네이티브
                  XLSX를 비공개 객체로 보관합니다. 과거 리포트는 요청할 때만
                  파일에서 복원합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  action(
                    `/api/admin/repositories/${repository.id}/backups`,
                    "현재 최신 리포트의 백업을 생성했습니다."
                  )
                }
                disabled={busy !== null}
                className="flex h-10 items-center gap-2 border border-[#173b33]/30 bg-[#f8f5ec] px-4 text-sm font-semibold hover:bg-[#173b33] hover:text-white"
              >
                <Archive className="size-4" />
                지금 백업
              </button>
            </div>
            <div className="mt-6 space-y-3">
              {backups.length === 0 && (
                <div className="border border-dashed border-[#173b33]/30 px-5 py-16 text-center">
                  생성된 파일 백업이 없습니다.
                </div>
              )}
              {backups.map((backup) => (
                <article
                  key={backup.id}
                  className="grid gap-4 border border-[#173b33]/20 bg-[#f8f5ec] p-5 lg:grid-cols-[1fr_auto] lg:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-display text-2xl font-semibold">
                        {backup.month}
                      </p>
                      <span className="rounded-full bg-[#e4eadf] px-2.5 py-1 text-[0.65rem] font-semibold text-[#24563d]">
                        {backup.reportStatus}
                      </span>
                      <span className="font-mono text-xs text-[#173b33]/45">
                        score {backup.compositeScore.toFixed(1)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[#173b33]/50">
                      {formatDate(backup.createdAt)} ·{" "}
                      {backup.artifacts
                        .reduce((sum, artifact) => sum + artifact.size, 0)
                        .toLocaleString()}{" "}
                      bytes
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/repositories/${repository.id}/backups/${backup.id}`}
                      className="flex h-9 items-center gap-2 bg-[#173b33] px-3 text-xs font-semibold text-white"
                    >
                      <FileJson className="size-4" />
                      리포트 복원
                    </Link>
                    {backup.artifacts.map((artifact) => (
                      <a
                        key={artifact.kind}
                        href={`/api/admin/repositories/${repository.id}/backups/${backup.id}/${artifact.kind}`}
                        className="flex h-9 items-center gap-2 border border-[#173b33]/25 px-3 text-xs font-semibold hover:bg-[#173b33] hover:text-white"
                      >
                        {artifact.kind === "xlsx" ? (
                          <FileSpreadsheet className="size-4" />
                        ) : (
                          <Download className="size-4" />
                        )}
                        {artifact.kind.toUpperCase()}
                      </a>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === "settings" && (
          <section className="mt-7 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c45a33]">
              Schedule policy
            </p>
            <h2 className="mt-1 font-display text-3xl font-semibold">
              자동 실행 설정
            </h2>
            <form
              onSubmit={saveSettings}
              className="mt-6 space-y-6 border border-[#173b33]/20 bg-[#f8f5ec] p-6"
            >
              <label className="flex items-center justify-between gap-5 border-b border-[#173b33]/15 pb-5">
                <span>
                  <span className="block font-semibold">월별 자동 실행</span>
                  <span className="mt-1 block text-xs text-[#173b33]/55">
                    매일 10:00 KST에 실행일이 도래한 저장소를 확인합니다.
                  </span>
                </span>
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={repository.enabled}
                  className="size-5 accent-[#c45a33]"
                />
              </label>
              <div className="grid gap-5 sm:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-semibold">
                    매월 실행일
                  </span>
                  <input
                    type="number"
                    name="scheduleDay"
                    min={1}
                    max={28}
                    defaultValue={repository.scheduleDay}
                    className="h-11 w-full border border-[#173b33]/25 bg-white px-3"
                  />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-semibold">
                    분석 기간
                  </span>
                  <select
                    name="period"
                    defaultValue={repository.period}
                    className="h-11 w-full border border-[#173b33]/25 bg-white px-3"
                  >
                    <option value="1m">최근 1개월</option>
                    <option value="3m">최근 3개월</option>
                    <option value="6m">최근 6개월</option>
                    <option value="1y">최근 1년</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-px border border-[#173b33]/15 bg-[#173b33]/15 sm:grid-cols-2">
                <div className="bg-[#efe9db] p-4">
                  <p className="text-xs text-[#173b33]/55">마지막 실행</p>
                  <p className="mt-1 text-sm font-semibold">
                    {formatDate(repository.lastRunAt)}
                  </p>
                </div>
                <div className="bg-[#efe9db] p-4">
                  <p className="text-xs text-[#173b33]/55">마지막 백업</p>
                  <p className="mt-1 text-sm font-semibold">
                    {formatDate(repository.lastBackupAt)}
                  </p>
                </div>
              </div>
              {repository.backupError && (
                <p className="border-l-2 border-[#c45a33] pl-3 text-sm text-[#8d321f]">
                  최근 백업 오류: {repository.backupError}
                </p>
              )}
              <button
                type="submit"
                disabled={busy === "settings"}
                className="flex h-11 items-center gap-2 bg-[#173b33] px-5 text-sm font-semibold text-white hover:bg-[#24594d] disabled:opacity-50"
              >
                {busy === "settings" && (
                  <RefreshCw className="size-4 animate-spin" />
                )}
                설정 저장
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
