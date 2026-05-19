import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { url, method = 'GET', headers: reqHeaders = {}, bodyData } = body;

    if (!url) return Response.json({ error: 'Missing url parameter' }, { status: 400 });

    const fetchOptions = {
      method,
      headers: { 'Accept': 'application/json', ...reqHeaders },
    };
    if (bodyData) {
      fetchOptions.body = JSON.stringify(bodyData);
      fetchOptions.headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, fetchOptions);
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return Response.json({ status: res.status, ok: res.ok, data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});