const FAPI = 'https://frontend-api.clerk.dev';
const PROXY_URL = 'https://tiendaata.vercel.app/__clerk';

module.exports = async (req, res) => {
  const secretKey = process.env.CLERK_SECRET_KEY || '';
  if (!secretKey) return res.status(500).json({ error: 'Clerk secret key is not configured.' });

  const rawPath = Array.isArray(req.query.path) ? req.query.path.join('/') : String(req.query.path || '');
  const queryIndex = req.url.indexOf('?');
  const query = queryIndex >= 0 ? req.url.slice(queryIndex + 1) : '';
  const params = new URLSearchParams(query);
  params.delete('path');
  const target = FAPI + '/' + rawPath.replace(/^\/+/, '') + (params.toString() ? '?' + params.toString() : '');

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (lower === 'host' || lower === 'content-length') continue;
    if (Array.isArray(value)) headers.set(key, value.join(', '));
    else if (value != null) headers.set(key, String(value));
  }

  headers.set('Clerk-Proxy-Url', PROXY_URL);
  headers.set('Clerk-Secret-Key', secretKey);

  const forwarded = req.headers['x-forwarded-for'];
  const originalIp = Array.isArray(forwarded)
    ? forwarded[0]
    : String(forwarded || req.socket?.remoteAddress || '').split(',')[0].trim();
  headers.set('X-Forwarded-For', originalIp);

  const body = ['GET', 'HEAD'].includes(req.method)
    ? undefined
    : await new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(Buffer.from(chunk)));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      });

  try {
    const response = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: 'manual'
    });

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error('Clerk proxy error:', error);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Clerk proxy unavailable.' }));
  }
};
