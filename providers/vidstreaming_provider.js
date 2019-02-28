const _ = require('lodash');
const needle = require('needle');

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
      retrieveMirror(`${VIDSTREAMING_URL}/videos/${title}-episode-1`)
        .then(url => [streamInfo(url)])
        .catch(() => []),
      retrieveMirror(`${VIDSTREAMING_URL}/videos/${title}-dub-episode-1`)
        .then(url => [streamInfo(url, true)])
        .catch(() => [])
    ]).then(results => results.reduce((a, b) => a.concat(b), []));
  }

  async seriesStreams(seriesMetadata) {
    if (!seriesMetadata.isAnime) {
      return Promise.resolve([]);
    }

    const title = seriesMetadata.title.replace(/\s/g, '-');
    const absoluteEpisode = seriesMetadata.absoluteEpisode;

    return Promise.all([
      retrieveMirror(`${VIDSTREAMING_URL}/videos/${title}-episode-${absoluteEpisode}`)
        .catch(() => retrieveMirror(`${VIDSTREAMING_URL}/videos/${title}--episode-${absoluteEpisode}`))
        .then(url => [streamInfo(url)])
        .catch(() => []),
      retrieveMirror(`${VIDSTREAMING_URL}/videos/${title}-dub-episode-${absoluteEpisode}`)
        .then(url => [streamInfo(url, true)])
        .catch(() => [])
    ]).then(results => results.reduce((a, b) => a.concat(b), []));
  }
}

function retrieveMirror(url) {
  return new Promise((resolve, reject) => {
    let body = '';
    needle.get(url)
      .on('readable', function() {
        while (data = this.read()) {
          body = body.concat(data.toString());
          const mirrorMatch = body.match(/<iframe.+"(.*vidstreaming\.io[^"]+)"/i);
          const mirror = mirrorMatch && mirrorMatch[1].replace(/^\/\//, 'https://');
          if (mirror) {
            resolve(mirror);
            this.destroy();
          }
        }
      })
      .on('done', () => {
        // means that promise was not resolved previously so no mirror was found
        reject(new Error(`vidstreaming url not available`));
      });
  });
}

function streamInfo(url, dub = false) {
  return {
    name: 'CDN',
    title: `${PROVIDER_NAME}${dub ? ' (Dub)': ''}`,
    externalUrl: url
  }
}

exports.Provider = Provider;
