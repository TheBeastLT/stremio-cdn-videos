const { Provider } = require('./providers/vidsrc_provider');
const express = require("express");
const addon = express();

const PROVIDERS = [new Provider()];
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

  return (handlers[req.params.type] || handlers.fallback)()
    .then((streams) => respond(res, { streams }))
    .catch((error) => {
      console.log(`Failed request ${req.params.id}: ${error}`);
      return next(error);
    });
});

async function seriesStreamHandler(id) {
  const split = id.split(':');
  const imdbId = split[0];
  const season = parseInt(split[1], 10);
  const episode = parseInt(split[2], 10);

  return Promise.all(PROVIDERS.map(provider => provider.seriesStreams(imdbId, season, episode)))
      .then(results => results.reduce((a, b) => a.concat(b), []))
}

async function movieStreamHandler(id) {
  return Promise.all(PROVIDERS.map(provider => provider.movieStreams(id)))
      .then(results => results.reduce((a, b) => a.concat(b), []))
}

function respond(res, data) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');
  res.send(data);
}

module.exports = addon;
// addon.listen(7000, function () {
//   console.log('Add-on Repository URL: http://127.0.0.1:7000/manifest.json');
// });
