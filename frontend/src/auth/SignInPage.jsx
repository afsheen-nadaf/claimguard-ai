import { useState } from "react";
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
    <main className="min-h-screen flex items-center justify-center bg-[#0f0b14] px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-purple-700/30 bg-[#1a1425] p-8 shadow-2xl">
        <p className="text-xs font-bold tracking-[0.18em] text-purple-300 uppercase">
          ClaimGuard AI
        </p>
        <h1 className="mt-4 text-3xl font-bold text-white">Sign in to continue</h1>
        <p className="mt-3 text-sm leading-6 text-purple-200">
          Access is managed by your ClaimGuard administrator. New accounts are provisioned by an admin.
        </p>
        {message && (
          <p className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" role="alert">
            {message}
          </p>
        )}
        <button
          type="button"
          className="mt-7 w-full rounded-xl bg-purple-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-wait disabled:opacity-60"
          onClick={handleSignIn}
          disabled={pending || Boolean(error?.includes("not configured"))}
        >
          {pending ? "Redirecting to secure sign-in…" : "Continue with secure sign-in"}
        </button>
      </section>
    </main>
  );
}
