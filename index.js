const vidsrc = require('./providers/vidsrc_provider');
const vidstreaming = require('./providers/vidstreaming_provider');
const { movieMetadata, seriesMetadata } = require('./lib/metadata');
const { cacheWrapStream } = require('./lib/cache');
const express = require("express");
const addon = express();

const PROVIDERS = [new vidsrc.Provider(), new vidstreaming.Provider()];
const MANIFEST = {
  id: 'com.stremio.cdn.videos',
  version: '1.0.0',
  name: 'CDN Videos',
  description: 'Search for movies, series and anime from various CDN providers',
  catalogs: [],
  resources: ['stream'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  background: 'http://www.pptbackgrounds.org/uploads/film-movies-movie-making-minimalism-creative-backgrounds-wallpapers.jpg',
  logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/High-contrast-video-x-generic.svg/2000px-High-contrast-video-x-generic.svg.png',
  contactEmail: 'pauliox@beyond.lt'
};

addon.param('type', function(req, res, next, val) {
  if (MANIFEST.types.includes(val)) {
    next();
  } else {
    next("Unsupported type " + val);
  }
});

addon.get('/', function(req, res) {
  res.redirect('/manifest.json')
});

addon.get('/manifest.json', function(req, res) {
  respond(res, MANIFEST);
});

addon.get('/stream/:type/:id.json', function(req, res, next) {
  if (!req.params.id.match(/tt\d+/i)) {
    return respond(res,  { streams: [] });
  }

  const handlers = {
    series: () => seriesStreamHandler(req.params.id),
    movie: () => movieStreamHandler(req.params.id),
    fallback: () => Promise.resolve([])
  };

  return cacheWrapStream(req.params.id, handlers[req.params.type] || handlers.fallback)
    .then((streams) => respond(res, { streams }))
    .catch((error) => {
      console.log(`Failed request ${req.params.id}: ${error}`);
      return respond(res,  { streams: [] });
    });
});

async function seriesStreamHandler(id) {
  const metadata = await seriesMetadata(id);
  console.log(metadata);

  const providerStreams = PROVIDERS
      .map((provider) => provider.seriesStreams(metadata).catch(() => []));

  return Promise.all(providerStreams)
      .then((results) => results.reduce((a, b) => a.concat(b), []))
      .then((results) => results.filter(result => result.url || result.externalUrl))
      .then((results) => {
        console.log(results);
        return results;
      });
}

async function movieStreamHandler(id) {
  const metadata = await movieMetadata(id);

  const providerStreams = PROVIDERS
      .map((provider) => provider.movieStreams(metadata).catch(() => []));

  return Promise.all(providerStreams)
      .then((results) => results.reduce((a, b) => a.concat(b), []))
      .then((results) => results.filter(result => result.url || result.externalUrl))
      // .then((results) => {
      //   console.log(results);
      //   return results;
      // });
}

function respond(res, data) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');
  res.send(data);
}

module.exports = addon;
