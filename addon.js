const { addonBuilder } = require("stremio-addon-sdk");
const vidsrc = require('./providers/vidsrc_provider');
const vidstreaming = require('./providers/vidstreaming_provider');
const wonderfulsubs = require('./providers/wonderfulsubs_provider');
const { movieMetadata, seriesMetadata } = require('./lib/metadata');
const { cacheWrapStream } = require('./lib/cache');

const IS_LOCAL = !(process.env.LOCAL_NETWORK === 'false' || process.env.LOCAL_NETWORK === '0');
const PROVIDERS = [new vidsrc.Provider(), new vidstreaming.Provider(), new wonderfulsubs.Provider()];

const CACHE_MAX_AGE = process.env.CACHE_MAX_AGE || 2 * 24 * 60; // 2 days
const CACHE_MAX_AGE_EMPTY = 4 * 60; // 4 hours in seconds
const STALE_REVALIDATE_AGE = 4 * 60; // 4 hours
const STALE_ERROR_AGE = 7 * 24 * 60; // 7 days

const builder = new addonBuilder({
  id: 'com.stremio.cdn.videos' + (IS_LOCAL ? '.local' : ''),
  version: '1.0.0',
  name: 'CDN Videos',
  description: 'Search for movies, series and anime from various CDN providers',
  catalogs: [],
  resources: ['stream'],
  types: ['movie', 'series'],
  idPrefixes: ['tt', 'kitsu'],
  background: 'https://i.imgur.com/Pjg3e0E.jpg',
  logo: 'https://i.imgur.com/83CPdiS.png'
});

builder.defineStreamHandler((args) => {
  if (!args.id.match(/tt\d+/i) && !args.id.match(/kitsu:\d+/i) ) {
    return Promise.resolve({ streams: [] });
  }

  const handlers = {
    series: () => seriesStreamHandler(args.id),
    movie: () => movieStreamHandler(args.id),
    fallback: () => Promise.resolve([])
  };

  return cacheWrapStream(args.id, handlers[args.type] || handlers.fallback)
    .then((streams) => ({
      streams: streams,
      cacheMaxAge: streams.length ? CACHE_MAX_AGE : CACHE_MAX_AGE_EMPTY,
      staleRevalidate: STALE_REVALIDATE_AGE,
      staleError: STALE_ERROR_AGE
    }))
    .catch((error) => {
      console.log(`Failed request ${args.id}: ${error}`);
      throw error;
    });
});

async function seriesStreamHandler(id) {
  const metadata = await seriesMetadata(id);

  const providerStreams = PROVIDERS
      .filter((provider) => provider.isApplicable(metadata))
      .map((provider) => provider.seriesStreams(metadata).catch(() => []));

  return Promise.all(providerStreams)
      .then((results) => results.reduce((a, b) => a.concat(b), []))
      .then((results) => results.filter(result => result.url || result.externalUrl))
      // .then((results) => {
      //   console.log(results);
      //   return results;
      // });
}

async function movieStreamHandler(id) {
  const metadata = await movieMetadata(id);

  const providerStreams = PROVIDERS
      .filter((provider) => provider.isApplicable(metadata))
      .map((provider) => provider.movieStreams(metadata).catch(() => []));

  return Promise.all(providerStreams)
      .then((results) => results.reduce((a, b) => a.concat(b), []))
      .then((results) => results.filter(result => result.url || result.externalUrl))
      // .then((results) => {
      //   console.log(results);
      //   return results;
      // });
}

module.exports = builder.getInterface();