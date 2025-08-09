export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const target = url.searchParams.get('u');
  if (!target) return new Response('missing u', { status: 400 });

  const u = new URL(target);
  if (u.hostname !== 'lichess.org') return new Response('forbidden', { status: 403 });

  const resp = await fetch(u.toString(), {
    headers: { 'Accept': 'application/json' }
  });
  const headers = new Headers(resp.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(resp.body, { status: resp.status, headers });
};


