const _ = require('lodash');
const needle = require('needle');

const PROVIDER_NAME = "VidSRC.me";
const VIDSRC_URL = 'https://vidsrc.me';

class Provider {

  constructor() {}

  async movieStreams(movieMetadata) {
    return retrieveMirrors(`${VIDSRC_URL}/embed/${movieMetadata.imdb}/`)
        .then(mirrors => mirrors.map(mirror => streamInfo(mirror)));
  }

  async seriesStreams(seriesMetadata) {
    const imdbId = seriesMetadata.imdb;
    const season = seriesMetadata.season;
    const episode = seriesMetadata.episode;
    const absoluteEpisode = seriesMetadata.absoluteEpisode;
    const isAnime = seriesMetadata.isAnime;

    return retrieveMirrors(`${VIDSRC_URL}/embed/${imdbId}/${season}-${episode}/`)
        .catch(() => isAnime ? retrieveMirrors(`${VIDSRC_URL}/embed/${imdbId}/1-${absoluteEpisode}/`) : [])
        .then(mirrors => mirrors.map(mirror => streamInfo(mirror)));
  }
}

// @TODO extract actual streams somehow from the response js code
function retrieveMirrors(url) {
  return new Promise((resolve, reject) => {
    needle.get(url, { timeout: 1000 }, (err, res, body) => {
      if (!err && res.statusCode === 200 && body && !body.match(/not found/i)) {
        const mirrorMatch = body.match(/<div.+class=(?:"server"|"server active").+/gi);
        const mirrors = mirrorMatch && mirrorMatch
            .map(mirrorDiv => ({
              name: mirrorDiv.match(/>(.+)<\/div>/)[1],
              url: url.replace('embed', `server${mirrorDiv.match(/data="(.+)"/)[1]}`)
            }));
        resolve(mirrors || []);
      } else {
        reject(new Error(`vidsrc url not available`));
      }
    });
  });
}

function streamInfo(mirror) {
  return {
    name: 'CDN',
    title: `${PROVIDER_NAME}\n${mirror.name}`,
    externalUrl: mirror.url
  }
}

exports.Provider = Provider;
