export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload =
      req.body && typeof req.body === 'object'
        ? req.body
        : { info: { lang: 'en', company: '69' }, input: {} };

    const upstream = await fetch(
      'http://api.spotlot.com/api/Branch/get_branches_delivery_fullfillment',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') || 'application/json'
    );
    return res.send(text);
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : 'Upstream API error',
    });
  }
}
