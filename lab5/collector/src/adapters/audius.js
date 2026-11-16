import { sources } from '../config.js';
import { fetchJson } from '../fetch.js';
import { RateLimiter } from '../rateLimit.js';

const s = sources.audius;

export function createAudiusAdapter() {
  const limiter = new RateLimiter(s.rateMs);
  let offset = 0;
  const limit = 50;
  let statsRef = null;
  let seenTrackIds = new Set();
  let firstPass = true;

  function attachStats(stats) {
    statsRef = stats;
  }

  async function fetch() {
    await limiter.wait();
    const url = `${s.baseUrl}/v1/tracks/trending?limit=${limit}&offset=${offset}`;
    const data = await fetchJson(url, { headers: {} });
    const tracks = data.data ?? [];
    statsRef?.recordFetched(tracks.length);

    const items = [];
    const relations = [];
    const seenUsers = new Set();

    let isNewData = false;
    for (const t of tracks) {
      const trackId = t?.id ?? t?.track_id;
      if (!trackId) continue;
      const key = `track-${trackId}`;
      if (!firstPass && seenTrackIds.has(key)) continue;
      isNewData = true;
      seenTrackIds.add(key);

      const user = t?.user ?? null;
      items.push({
        type: 'track',
        title: t.title,
        sourceId: key,
        source: 'audius',
        url: user ? `https://audius.co/${user.name}` : null,
        description: t.description ?? null,
        metadata: {
          genre: t.genre ?? null,
          mood: t.mood ?? null,
          createdAt: t.release_date ?? t.created_at ?? null,
        },
      });

      if (user?.id) {
        const userKey = `user-${user.id}`;
        if (!seenUsers.has(userKey)) {
          items.push({
            type: 'artist',
            title: user.name,
            sourceId: userKey,
            source: 'audius',
            url: `https://audius.co/${user.name}`,
            description: user.bio ?? null,
            metadata: {
              handle: user.handle ?? null,
            },
          });
          seenUsers.add(userKey);
        }
        relations.push({ parentSourceId: userKey, childSourceId: key });
      }
    }

    if (tracks.length < limit || !isNewData) {
      // Страницы исчерпаны либо повторяются — начинаем новый проход.
      firstPass = false;
      offset = 0;
    } else {
      offset += limit;
    }

    return { source: 'audius', items, relations };
  }

  function resumeCycle() {
    offset = 0;
    firstPass = false;
  }

  return { attachStats, fetch, resumeCycle };
}