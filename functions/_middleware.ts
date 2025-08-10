export const onRequest: PagesFunction = async (ctx) => {
  // Simple CORS for API routes
  const res = await ctx.next();
  const headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(res.body, { status: res.status, headers });
};


