//const cacheManager = require('cache-manager');
//const mangodbStore = require('cache-manager-mongodb');
const cacheManager = {}; // not available for local add-ons
const mangodbStore = {}; // not available for local add-ons

const GLOBAL_KEY_PREFIX = 'stremio-tcdn';
const STREAM_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|stream`;
const WONDERFULSUBS_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|wonderfulsubs`;
const SLUG_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|slug`;

const STREAM_TTL = process.env.STREAM_TTL || 4 * 60 * 60; // 4 hours
const STREAM_EMPTY_TTL = process.env.STREAM_EMPTY_TTL || 30 * 60; // 30 minutes
// When the streams are empty we want to cache it for less time in case of timeouts or failures
const WONDERFULSUBS_TTL = process.env.WONDERFULSUBS_TTL || 24 * 60 * 60; // 1 day
const SLUG_TTL = process.env.SLUG_TTL || 7 * 24 * 60 * 60; // 1 week

const MONGO_URI = process.env.MONGODB_URI;
const NO_CACHE = process.env.NO_CACHE || true; // disabled cache by default for local add-on

const cache = initiateCache();

const cacheDb = {}

function initiateCache() {
  if (NO_CACHE) {
    return null;
  } else if (!NO_CACHE && MONGO_URI) {
    return cacheManager.caching({
      store: mangodbStore,
      uri: MONGO_URI,
      options: {
        collection: 'cdn_collection',
        ttl: STREAM_TTL
      },
      ttl: STREAM_TTL,
      ignoreCacheErrors: true
    });
  } else {
    return cacheManager.caching({
      store: 'memory',
      ttl: STREAM_TTL
    });
  }
}

function cacheWrap(key, method, options) {
  if (NO_CACHE || !cache) {
    return method();
  }
  return cache.wrap(key, method, options);
}

function cacheWrapStream(id, method) {
  return cacheWrap(`${STREAM_KEY_PREFIX}:${id}`, method, {
    ttl: (streams) => streams.length ? STREAM_TTL : STREAM_EMPTY_TTL
  });
}

function cacheWrapWonderfulSubs(id, method) {
  return cacheWrap(`${WONDERFULSUBS_KEY_PREFIX}:${id}`, method, { ttl: WONDERFULSUBS_TTL });
}

function cacheSlug(id, provider, value) {
  return cache.set(`${SLUG_KEY_PREFIX}|${provider}:${id}`, value, { ttl: SLUG_TTL });
}

function getSlug(id, provider) {
  return cache.get(`${SLUG_KEY_PREFIX}|${provider}:${id}`, { ttl: SLUG_TTL });
}

module.exports = { cacheWrapStream, cacheWrapWonderfulSubs, cacheSlug, getSlug };

