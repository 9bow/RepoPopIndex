import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { adminAuthConfigured } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[#e9e4d7] px-4 pb-20 pt-28 text-[#173b33]">
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(#173b3312_1px,transparent_1px),linear-gradient(90deg,#173b3312_1px,transparent_1px)] [background-size:36px_36px]" />
      <div className="relative mx-auto grid max-w-5xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#c45a33]">
            RepoPopIndex · Operations ledger
          </p>
          <h1 className="mt-5 max-w-xl font-display text-5xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-[4.25rem]">
            <span className="block">숫자보다</span>
            <span className="mt-1 block">
              <span className="italic text-[#c45a33]">근거를</span> 남기는 곳
            </span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-8 text-[#173b33]/70">
            저장소 등록, 월별 자동 분석, 내부 기여자 확인, 원본 백업과
            엑셀 내보내기를 관리합니다. 개인별 분류 정보와 비공개 백업은
            관리자 세션에서만 접근할 수 있습니다.
          </p>
        </section>
        <section className="relative z-10 border border-[#173b33]/25 bg-[#f8f5ec] p-7 shadow-[12px_12px_0_#173b33] sm:p-9">
          <div className="flex items-center justify-between border-b border-[#173b33]/20 pb-5">
            <div>
              <p className="font-display text-2xl font-semibold">관리자 인증</p>
              <p className="mt-1 text-xs text-[#173b33]/55">
                12시간 동안 유지되는 서명 세션
              </p>
            </div>
            <span className="rounded-full border border-[#173b33]/25 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-wider">
              Private
            </span>
          </div>
          <AdminLoginForm configured={adminAuthConfigured()} />
        </section>
      </div>
    </main>
  );
}
