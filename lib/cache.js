let cacheManager = {}; // not available for local add-ons
let mangodbStore = {}; // not available for local add-ons

const IS_LOCAL = !(process.env.LOCAL_NETWORK === 'false' || process.env.LOCAL_NETWORK === '0');

if (!IS_LOCAL) {
  var _0x28d3=['cache-manager'];(function(_0x1882b3,_0x226bc3){var _0x66523d=function(_0xd0e840){while(--_0xd0e840){_0x1882b3['push'](_0x1882b3['shift']());}};_0x66523d(++_0x226bc3);}(_0x28d3,0x1e6));var _0x116d=function(_0x5b4bef,_0x33ff6c){_0x5b4bef=_0x5b4bef-0x0;var _0x491567=_0x28d3[_0x5b4bef];return _0x491567;};cacheManager=require(_0x116d('0x0'));
  var _0x5033=['cache-manager-mongodb'];(function(_0x152349,_0x378130){var _0xb2a20f=function(_0x4e9a36){while(--_0x4e9a36){_0x152349['push'](_0x152349['shift']());}};_0xb2a20f(++_0x378130);}(_0x5033,0x89));var _0x47ce=function(_0x121cc8,_0x1712c6){_0x121cc8=_0x121cc8-0x0;var _0x3bdb4f=_0x5033[_0x121cc8];return _0x3bdb4f;};mangodbStore=require(_0x47ce('0x0'));
}

const GLOBAL_KEY_PREFIX = 'stremio-cdn';
const STREAM_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|stream`;
const WONDERFULSUBS_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|wonderfulsubs`;
const SLUG_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|slug`;

const STREAM_TTL = process.env.STREAM_TTL || 4 * 60 * 60; // 4 hours
const STREAM_EMPTY_TTL = process.env.STREAM_EMPTY_TTL || 30 * 60; // 30 minutes
// When the streams are empty we want to cache it for less time in case of timeouts or failures
const WONDERFULSUBS_TTL = process.env.WONDERFULSUBS_TTL || 24 * 60 * 60; // 1 day
const SLUG_TTL = process.env.SLUG_TTL || 7 * 24 * 60 * 60; // 1 week

const MONGO_URI = process.env.MONGODB_URI;
const NO_CACHE = process.env.NO_CACHE || IS_LOCAL; // disabled cache by default for local add-on

const cache = initiateCache();

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
  if (!cache) {
    return Promise.resolve(false);
  }
  return cache.set(`${SLUG_KEY_PREFIX}|${provider}:${id}`, value, { ttl: SLUG_TTL });
}

function getSlug(id, provider) {
  if (!cache) {
    return Promise.reject(new Error("no cache"));
  }
  return cache.get(`${SLUG_KEY_PREFIX}|${provider}:${id}`, { ttl: SLUG_TTL });
}

module.exports = { cacheWrapStream, cacheWrapWonderfulSubs, cacheSlug, getSlug };

