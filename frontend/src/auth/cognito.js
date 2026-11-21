const SESSION_KEY = "claimguard.auth.session";
const PKCE_VERIFIER_KEY = "claimguard.auth.pkce";
const STATE_KEY = "claimguard.auth.state";
const NONCE_KEY = "claimguard.auth.nonce";
const RETURN_TO_KEY = "claimguard.auth.returnTo";
let callbackPromise;

export class AuthError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export function getCognitoConfig() {
  const env = import.meta.env || {};
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const domain = (env.VITE_COGNITO_DOMAIN || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  return {
    domain,
    clientId: env.VITE_COGNITO_CLIENT_ID || "",
    userPoolId: env.VITE_COGNITO_USER_POOL_ID || "",
    region: env.VITE_AWS_REGION || "",
    redirectUri: env.VITE_COGNITO_REDIRECT_URI || origin,
    logoutUri: env.VITE_COGNITO_LOGOUT_URI || origin,
  };
}

export function isCognitoConfigured() {
  const config = getCognitoConfig();
  return Boolean(
    config.domain &&
      config.clientId &&
      config.userPoolId &&
      config.region &&
      config.redirectUri &&
      config.logoutUri
  );
}

function requireConfig() {
  if (!isCognitoConfigured()) {
    throw new AuthError("Cognito is not configured. Complete the frontend environment settings.");
  }
  return getCognitoConfig();
}

function encodeBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
}

function randomUrlSafe(size = 32) {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(size)));
}

async function createChallenge(verifier) {
  const bytes = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return encodeBase64Url(new Uint8Array(digest));
}

function decodeIdToken(idToken) {
  try {
    const [, encodedPayload] = idToken.split(".");
    if (!encodedPayload) throw new Error("Missing token payload.");
    return JSON.parse(decodeBase64Url(encodedPayload));
  } catch {
    throw new AuthError("Cognito returned an unreadable ID token.");
  }
}

function groupsFromClaims(value) {
  if (Array.isArray(value)) return value.filter((group) => typeof group === "string");
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((group) => typeof group === "string");
  } catch {
    return value.split(",").map((group) => group.trim()).filter(Boolean);
  }
  return [value];
}

function sessionFromTokens(tokens, previous = {}, expectedNonce = null) {
  if (!tokens.id_token) throw new AuthError("Cognito did not return an ID token.");
  const claims = decodeIdToken(tokens.id_token);
  if (expectedNonce && claims.nonce !== expectedNonce) {
    throw new AuthError("ID token nonce validation failed. Please sign in again.");
  }
  if (!claims.sub || !Number.isFinite(claims.exp)) {
    throw new AuthError("Cognito returned an incomplete ID token.");
  }
  const groups = groupsFromClaims(claims["cognito:groups"]);
  return {
    idToken: tokens.id_token,
    accessToken: tokens.access_token || previous.accessToken || "",
    refreshToken: tokens.refresh_token || previous.refreshToken || "",
    expiresAt: claims.exp * 1000,
    user: {
      id: claims.sub,
      email: claims.email || "",
      groups,
      role: groups.includes("adjuster") ? "adjuster" : "claimant",
    },
  };
}

function saveSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function readSession() {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (!stored) return null;
  try {
    const session = JSON.parse(stored);
    if (!session.idToken || !session.user?.id || !Number.isFinite(session.expiresAt)) {
      throw new Error("Invalid stored session.");
    }
    return session;
  } catch (error) {
    console.error("[auth] Discarding invalid saved session:", error);
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

async function exchangeCode(code, verifier) {
  const config = requireConfig();
  const response = await fetch(`https://${config.domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      code,
      redirect_uri: config.redirectUri,
      code_verifier: verifier,
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AuthError(
      body?.error_description || "Cognito could not complete sign-in.",
      response.status
    );
  }
  return body;
}

export async function beginSignIn() {
  const config = requireConfig();
  const verifier = randomUrlSafe(64);
  const state = randomUrlSafe();
  const nonce = randomUrlSafe();
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(NONCE_KEY, nonce);
  sessionStorage.setItem(RETURN_TO_KEY, window.location.hash || "#/");
  const challenge = await createChallenge(verifier);
  const url = new URL(`https://${config.domain}/oauth2/authorize`);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: "openid email profile",
    state,
    nonce,
    code_challenge_method: "S256",
    code_challenge: challenge,
  }).toString();
  window.location.assign(url.toString());
}

export function completeSignIn() {
  if (!callbackPromise) callbackPromise = completeSignInOnce();
  return callbackPromise;
}

async function completeSignInOnce() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (!code && !url.searchParams.has("error")) return null;

  const returnedState = url.searchParams.get("state");
  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  const nonce = sessionStorage.getItem(NONCE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(NONCE_KEY);
  if (!expectedState || returnedState !== expectedState || !verifier) {
    throw new AuthError("Sign-in state validation failed. Please try again.");
  }

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    throw new AuthError(
      url.searchParams.get("error_description") || "Cognito sign-in was not completed."
    );
  }

  const session = sessionFromTokens(await exchangeCode(code, verifier), {}, nonce);
  saveSession(session);
  const returnTo = sessionStorage.getItem(RETURN_TO_KEY);
  sessionStorage.removeItem(RETURN_TO_KEY);
  window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
  if (returnTo?.startsWith("#/")) window.location.hash = returnTo.slice(1);
  return session;
}

export async function getValidSession() {
  const session = readSession();
  if (!session) return null;
  if (session.expiresAt > Date.now() + 60_000) return session;
  if (!session.refreshToken) {
    clearSession();
    return null;
  }

  const config = requireConfig();
  const response = await fetch(`https://${config.domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      refresh_token: session.refreshToken,
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      clearSession();
      return null;
    }
    throw new AuthError("Cognito session refresh failed.", response.status);
  }
  const refreshed = sessionFromTokens(body, session);
  saveSession(refreshed);
  return refreshed;
}

export async function getIdToken() {
  const session = await getValidSession();
  if (!session) throw new AuthError("Your session has expired. Please sign in again.");
  return session.idToken;
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(NONCE_KEY);
  sessionStorage.removeItem(RETURN_TO_KEY);
}

export function signOutFromCognito(userId) {
  const config = requireConfig();
  clearSession();
  if (userId) localStorage.removeItem(`claimguard_screenings:${userId}`);
  localStorage.removeItem("claimguard_screenings");
  const url = new URL(`https://${config.domain}/logout`);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    logout_uri: config.logoutUri,
  }).toString();
  window.location.assign(url.toString());
}
