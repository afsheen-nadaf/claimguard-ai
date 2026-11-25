import { useState } from "react";
import Icon from "../components/Icon";
import { useAuth } from "./useAuth";

export default function SignInPage() {
  const { signIn, error } = useAuth();
  const [pending, setPending] = useState(false);
  const [signInError, setSignInError] = useState("");

  async function handleSignIn() {
    setPending(true);
    setSignInError("");
    try {
      await signIn();
    } catch (reason) {
      setSignInError(reason.message || "Could not start sign-in.");
      setPending(false);
    }
  }

  const message = signInError || error;

  return (
    <main className="min-h-screen grid bg-[#100d16] lg:grid-cols-[minmax(0,1.18fr)_minmax(380px,.82fr)]">
      <section className="relative hidden min-h-[440px] overflow-hidden px-12 py-10 lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(154,112,223,.16),transparent_28%),linear-gradient(135deg,#15101d_0%,#100d16_72%)]" />
        <div className="absolute -bottom-32 right-[8%] h-[430px] w-[430px] rounded-full border border-purple-400/10 shadow-[0_0_0_70px_rgba(154,112,223,.025),0_0_0_140px_rgba(154,112,223,.018)]" />

        <div className="relative z-10 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/15 bg-gradient-to-br from-purple-400 to-purple-700 shadow-[0_10px_28px_rgba(124,79,196,.28)]">
            <Icon name="shield" size={23} className="text-white" />
          </span>
          <span className="text-[16px] font-extrabold tracking-tight text-[#eee7dc]">
            ClaimGuard AI
            <span className="mt-1 block text-[10px] tracking-[0.12em] text-[#aaa2b4]">SCREENING WORKSPACE</span>
          </span>
        </div>

        <div className="relative z-10 max-w-[620px] py-12">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-purple-300">
            AI-assisted fraud detection
          </p>
          <h1 className="mt-4 max-w-[580px] text-5xl font-bold leading-[1.02] tracking-[-3px] text-[#eee7dc] xl:text-[68px]">
            Review claims with confidence.
          </h1>
          <p className="mt-5 max-w-[540px] text-base leading-7 text-[#bbb3c4]">
            Bring policy checks, document evidence, and image forensics into one explainable review workspace.
          </p>
          <div className="mt-8 flex flex-wrap gap-2.5">
            {["Private document storage", "Evidence-led decisions", "Human final review"].map((item, index) => (
              <span
                key={item}
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#1d1827]/80 px-3 py-2 text-xs text-[#cdc5d5]"
              >
                {index === 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,.10)]" />}
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex gap-5 text-[11px] text-[#91899c]">
          <span>Document protection</span>
          <span>Fraud review support</span>
        </div>
      </section>

      <section className="grid min-h-screen place-items-center border-l border-white/[0.08] bg-[linear-gradient(145deg,rgba(238,231,220,.035),rgba(154,112,223,.035))] px-5 py-10 sm:px-12">
        <div className="w-full max-w-[420px]">
          <section className="rounded-[22px] border border-white/[0.12] bg-[#1d1827]/95 p-7 shadow-[0_24px_80px_rgba(0,0,0,.38)] sm:p-9">
            <div className="mb-5 flex items-center gap-2 lg:hidden">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-purple-400 to-purple-700">
                <Icon name="shield" size={19} className="text-white" />
              </span>
              <span className="text-sm font-extrabold text-[#eee7dc]">ClaimGuard AI</span>
            </div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-purple-300">Authorized workspace</p>
            <h2 className="mt-3 text-[28px] font-bold tracking-[-1px] text-[#eee7dc]">Sign in</h2>
            <p className="mb-6 mt-2 text-[13px] leading-6 text-[#aaa2b4]">
              Access is managed by your ClaimGuard administrator. New accounts are provisioned by an admin.
            </p>
            {message && (
              <p className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" role="alert">
                {message}
              </p>
            )}
            <button
              type="button"
              className="inline-flex h-[60px] w-full items-center justify-center gap-2 rounded-[18px] border border-purple-300/55 bg-gradient-to-r from-purple-500 to-purple-700 px-5 text-[16px] font-semibold text-white shadow-[0_5px_16px_rgba(124,79,196,.22),inset_0_1px_1px_rgba(255,255,255,.2)] transition-all hover:from-purple-400 hover:to-purple-600 hover:shadow-[0_7px_20px_rgba(124,79,196,.3)] active:translate-y-px disabled:cursor-wait disabled:opacity-60"
              onClick={handleSignIn}
              disabled={pending || Boolean(error?.includes("not configured"))}
            >
              <span>{pending ? "Redirecting to secure sign-in…" : "Continue with secure sign-in"}</span>
              {!pending && <Icon name="arrow" size={18} />}
            </button>
            <p className="mt-5 text-center text-xs text-[#aaa2b4]">
              Need access? Contact your administrator.
            </p>
          </section>
          <p className="mt-7 text-center text-[10px] text-[#81788d]">
            ClaimGuard AI supports human review; it does not determine fraud.
          </p>
        </div>
      </section>
    </main>
  );
}
