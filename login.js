module.exports = (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  if (!body || typeof body !== 'object') body = {};
  const code = String(body.code || '').trim();
  const expected = process.env.ADMIN_CODE || '';
  const ok = expected.length > 0 && code === expected;
  if (ok) {
    res.status(200).json({ ok: true, exp: Date.now() + 8 * 60 * 60 * 1000 });
  } else {
    res.status(401).json({ ok: false });
  }
};
