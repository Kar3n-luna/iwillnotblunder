export interface Env {
  DB: D1Database;
  LICHESS_CLIENT_ID: string;
  OAUTH_REDIRECT_URI: string;
  SESSION_SECRET: string;
}

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function getBaseUrl(req: Request): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export function parseCookies(req: Request): Record<string, string> {
  const cookie = req.headers.get('cookie') || '';
  return Object.fromEntries(
    cookie
      .split(';')
      .map((c) => {
        const idx = c.indexOf('=');
        if (idx === -1) return [c.trim(), ''];
        return [c.slice(0, idx).trim(), decodeURIComponent(c.slice(idx + 1))];
      })
      .filter(([k]) => k)
  );
}

async function hmac(value: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  const bytes = new Uint8Array(sig);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export async function createSessionCookie(payload: Record<string, unknown>, secret: string) {
  const body = btoa(JSON.stringify(payload));
  const sig = await hmac(body, secret);
  return `${body}.${sig}`;
}

export async function verifySessionCookie(cookie: string | null, secret: string): Promise<Record<string, unknown> | null> {
  if (!cookie) return null;
  const idx = cookie.lastIndexOf('.');
  if (idx === -1) return null;
  const body = cookie.slice(0, idx);
  const sig = cookie.slice(idx + 1);
  const expected = await hmac(body, secret);
  if (expected !== sig) return null;
  try {
    return JSON.parse(atob(body));
  } catch {
    return null;
  }
}

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function deriveCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64url(new Uint8Array(digest));
}

export async function exchangeCodeForToken(code: string, codeVerifier: string, env: Env) {
  const params = new URLSearchParams();
  params.set('grant_type', 'authorization_code');
  params.set('code', code);
  params.set('redirect_uri', env.OAUTH_REDIRECT_URI);
  params.set('client_id', env.LICHESS_CLIENT_ID);
  params.set('code_verifier', codeVerifier);

  const resp = await fetch('https://lichess.org/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!resp.ok) throw new Error(`Token exchange failed: ${resp.status}`);
  return resp.json<any>();
}

export async function fetchLichessProfile(accessToken: string) {
  const resp = await fetch('https://lichess.org/api/account', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!resp.ok) throw new Error(`Profile fetch failed: ${resp.status}`);
  return resp.json<any>();
}

// PKCE cookie helpers
export async function createPkceCookie(payload: { state: string; code_verifier: string }, secret: string) {
  return createSessionCookie(payload, secret);
}

export async function readPkceCookie(req: Request, secret: string): Promise<{ state: string; code_verifier: string } | null> {
  const cookies = parseCookies(req);
  const raw = cookies['pkce'] || null;
  const decoded = await verifySessionCookie(raw, secret);
  if (!decoded) return null;
  const state = String((decoded as any).state || '');
  const code_verifier = String((decoded as any).code_verifier || '');
  if (!state || !code_verifier) return null;
  return { state, code_verifier };
}


