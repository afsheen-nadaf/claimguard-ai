import { useEffect, useMemo, useState } from "react";
import {
  beginSignIn,
  completeSignIn,
  getValidSession,
  isCognitoConfigured,
  signOutFromCognito,
} from "./cognito";
import { AuthContext } from "./AuthContext";

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    status: "loading",
    session: null,
    error: null,
  });

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      if (!isCognitoConfigured()) {
        setState({
          status: "unauthenticated",
          session: null,
          error: "Cognito is not configured. Set the required frontend environment variables.",
        });
        return;
      }
      try {
        const callbackSession = await completeSignIn();
        const session = callbackSession || (await getValidSession());
        if (active) {
          setState({ status: session ? "authenticated" : "unauthenticated", session, error: null });
        }
      } catch (error) {
        console.error("[auth] Could not initialize the Cognito session:", error);
        if (active) setState({ status: "unauthenticated", session: null, error: error.message });
      }
    };
    initialize();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (state.status !== "authenticated") return undefined;
    const timer = window.setInterval(async () => {
      try {
        const session = await getValidSession();
        setState({
          status: session ? "authenticated" : "unauthenticated",
          session,
          error: session ? null : "Your session expired. Please sign in again.",
        });
      } catch (error) {
        console.error("[auth] Could not refresh the Cognito session:", error);
        setState({ status: "unauthenticated", session: null, error: error.message });
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [state.status]);

  const value = useMemo(
    () => ({
      ...state,
      signIn: beginSignIn,
      signOut: () => signOutFromCognito(state.session?.user?.id),
    }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
