// API endpoint: same-origin /graphql, proxied by nginx (production) or
// Vite dev server (development) to the Apollo Gateway.
export const API_URL = '/graphql';

export const PAGE_SIZES = [10, 20, 50, 100];

export const ITEM_TYPE_LABELS = {
  artist: 'Исполнитель',
  track: 'Трек',
};