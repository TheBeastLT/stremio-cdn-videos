const { getContentMatches, scrape } = require('../lib/scraper');
const { streamInfo } = require('../lib/streamInfo');

const PROVIDER_NAME = "VidStreaming.io";
const VIDSTREAMING_URL = 'https://vidstreaming.io';

class Provider {

  constructor() {}

  async movieStreams(movieMetadata) {
    if (!movieMetadata.isAnime) {
      return Promise.resolve([]);
    }

    const title = movieMetadata.title.replace(/\s/g, '-');

    return Promise.all([
      retrieveMirrors(`${VIDSTREAMING_URL}/videos/${title}-episode-1`).catch(() => []),
      retrieveMirrors(`${VIDSTREAMING_URL}/videos/${title}-dub-episode-1`, true).catch(() => [])
    ]).then(results => results.reduce((a, b) => a.concat(b), []));
  }

  async seriesStreams(seriesMetadata) {
    if (!seriesMetadata.isAnime) {
      return Promise.resolve([]);
    }

    const title = seriesMetadata.title.replace(/\s/g, '-');
    const absoluteEpisode = seriesMetadata.absoluteEpisode;

    return Promise.all([
      retrieveMirrors(`${VIDSTREAMING_URL}/videos/${title}-episode-${absoluteEpisode}`)
        .catch(() => retrieveMirrors(`${VIDSTREAMING_URL}/videos/${title}--episode-${absoluteEpisode}`))
        .catch(() => []),
      retrieveMirrors(`${VIDSTREAMING_URL}/videos/${title}-dub-episode-${absoluteEpisode}`, true)
        .catch(() => [])
    ]).then(results => results.reduce((a, b) => a.concat(b), []));
  }
}

function retrieveMirrors(url, dubbed = false) {
  return getContentMatches(url, /<iframe.+"(.*vidstreaming\.io[^"]+)"/i)
      .then((matches) => matches[1].replace(/^\/\//, 'https://'))
      .then((videoUrl) => getContentMatches(videoUrl, /<ul class="list-server-items">(.+)<\/ul>/s))
      .then((matches) => matches[1].match(/<li class="linkserver".+<\/li>/g)
          .map(mirrorDiv => ({
            name: mirrorDiv.match(/>(.+)<\/li>/)[1],
            url: mirrorDiv.match(/data-video="(.+)"/)[1].replace(/^\/\//, 'https://')
          })))
      .then((mirrors) => Promise.all(mirrors.map(mirror => scrape(mirror))))
      .then((mirrors) => mirrors.map((mirror) => { mirror.dubbed = dubbed; return mirror; }))
      .then((mirrors) => mirrors.map(mirror => streamInfo(PROVIDER_NAME, mirror)));
}

exports.Provider = Provider;
