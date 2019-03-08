const { getContentMatches, scrape } = require('../lib/scraper');
const { streamInfo } = require('../lib/streamInfo');

const PROVIDER_NAME = "VidSRC.me";
const VIDSRC_URL = 'https://vidsrc.me';

class Provider {

  constructor() {}

  async movieStreams(movieMetadata) {
    return retrieveMirrors(`${VIDSRC_URL}/embed/${movieMetadata.imdb}/`);
  }

  async seriesStreams(seriesMetadata) {
    const imdbId = seriesMetadata.imdb;
    const season = seriesMetadata.season;
    const episode = seriesMetadata.episode;
    const absoluteEpisode = seriesMetadata.absoluteEpisode;
    const isAnime = seriesMetadata.isAnime;

    return retrieveMirrors(`${VIDSRC_URL}/embed/${imdbId}/${season}-${episode}/`)
        .catch(() => isAnime ? retrieveMirrors(`${VIDSRC_URL}/embed/${imdbId}/1-${absoluteEpisode}/`) : []);
  }
}

function retrieveMirrors(url) {
  return getContentMatches(url, /<div id="server_list"[^>]+>(.+)<\/br>\s+<\/div>/s)
      .then((matches) => matches[1].match(/<div.+class=(?:"server"|"server active").+/gi)
          .map(mirrorDiv => ({
            name: mirrorDiv.match(/>(.+)<\/div>/)[1],
            url: url.replace('embed', `server${mirrorDiv.match(/data="(.+)"/)[1]}`)
          })))
      .then((mirrors) => Promise.all(mirrors.map(mirror => scrape(mirror))))
      .then((mirrors) => mirrors.map(mirror => streamInfo(PROVIDER_NAME, mirror)));
}

exports.Provider = Provider;
