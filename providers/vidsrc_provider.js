const _ = require('lodash');
const request = require('request');

const PROVIDER_NAME = "VidSRC";
const VIDSRC_URL = 'https://vidsrc.me';
const CINEMETA_URL = 'https://v3-cinemeta.strem.io';

class Provider {

  constructor() {}

  async movieStreams(imdbId) {
    return checkIfAvailable(`${VIDSRC_URL}/embed/${imdbId}/`)
        .then(url => [streamInfo(url)]);
  }

  async seriesStreams(imdbId, season, episode) {
    return checkIfAvailable(`${VIDSRC_URL}/embed/${imdbId}/${season}-${episode}/`)
        .catch(() => getAbsoluteEpisode(imdbId, season, episode)
            .then(absolute => checkIfAvailable(`${VIDSRC_URL}/embed/${imdbId}/1-${absolute}/`)))
        .then(url => [streamInfo(url)]);
  }
}

function checkIfAvailable(url) {
  return new Promise((resolve, reject) => {
    request.get(url, { timeout: 1000 }, (err, res, body) => {
      if (res.statusCode === 200 && body && !body.match(/not found/i)) {
        resolve(url);
      } else {
        reject(new Error(`url not available`));
      }
    });
  });
}

function getAbsoluteEpisode(imdbId, season, episode) {
  return new Promise((resolve, reject) => {
    request(
        `${CINEMETA_URL}/meta/series/${imdbId}.json`,
        (err, res, body) => {
          const data = body.includes('<!DOCTYPE html>') ? null : JSON.parse(body);
          if (data && data.meta && data.meta.name) {
            const absoluteEpisode = data.meta.videos && _.chain(data.meta.videos)
                .countBy('season')
                .toPairs()
                .filter((pair) => pair[0] !== '0')
                .sortBy((pair) => parseInt(pair[0], 10))
                .map((pair) => pair[1])
                .value()
                .slice(0, season - 1)
                .reduce((a, b) => a + b, episode);
            if (absoluteEpisode) {
              resolve(absoluteEpisode);
            } else {
              reject(new Error('no videos found'));
            }
          } else {
            console.log(`failed cinemeta query: ${err || 'Empty Body'}`);
            reject(err || new Error('failed cinemeta query'));
          }
        }
    );
  });
}

function streamInfo(url) {
  return {
    name: 'CDN',
    title: PROVIDER_NAME,
    externalUrl: url
  }
}

exports.Provider = Provider;
