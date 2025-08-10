import { Env, getBaseUrl, deriveCodeChallenge, createPkceCookie } from '../../_utils';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const base = getBaseUrl(ctx.request);
  const redirectUri = ctx.env.OAUTH_REDIRECT_URI || `${base}/api/oauth/callback`;
  const scope = 'board:play';
  const auth = new URL('https://lichess.org/oauth');

  // PKCE: generate state + code_verifier + challenge
  const state = crypto.randomUUID();
  const codeVerifier = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => ('0' + (b & 0xff).toString(16)).slice(-2))
    .join('');
  const codeChallenge = await deriveCodeChallenge(codeVerifier);

  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('client_id', ctx.env.LICHESS_CLIENT_ID);
  auth.searchParams.set('redirect_uri', redirectUri);
  auth.searchParams.set('scope', scope);
  auth.searchParams.set('code_challenge_method', 'S256');
  auth.searchParams.set('code_challenge', codeChallenge);
  auth.searchParams.set('state', state);

  const pkceCookie = await createPkceCookie({ state, code_verifier: codeVerifier }, ctx.env.SESSION_SECRET);
  const setCookie = `pkce=${encodeURIComponent(pkceCookie)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`;
  return new Response(null, { status: 302, headers: { Location: auth.toString(), 'Set-Cookie': setCookie } });
};


