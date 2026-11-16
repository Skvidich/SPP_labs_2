import 'dotenv/config';

const port = Number(process.env.PORT ?? 4000);

async function checkGraphql() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const body = await res.json();
    return body?.data?.__typename === 'Query';
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  try {
    const ok = await checkGraphql();
    if (!ok) {
      console.error('[healthcheck] unhealthy gateway graphql');
      process.exit(1);
    }
    console.log(`[healthcheck] healthy graphql=${ok}`);
    process.exit(0);
  } catch (e) {
    console.error('[healthcheck] unhealthy error=' + (e?.message ?? e));
    process.exit(1);
  }
})();