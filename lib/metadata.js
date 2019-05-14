const needle = require('needle');

const CINEMETA_URL = 'https://v3-cinemeta.strem.io';
const KITSU_URL = 'https://anime-kitsu.stremio.ga';

function getImdbMetadata(imdbId, type) {
  return needle('get', `${CINEMETA_URL}/meta/${type}/${imdbId}.json`, { open_timeout: 1000 })
      .then((response) => response.body)
      .then((body) => {
        if (body && body.meta && body.meta.name) {
          return {
            imdbId: imdbId,
            title: body.meta.name,
            year: body.meta.year,
            genres: body.meta.genres,
            episodeCount: body.meta.videos && Object.values(body.meta.videos
                .filter((entry) => entry.season !== 0)
                .sort((a, b) => a.season - b.season)
                .reduce((map, next) => {
                  map[next.season] = map[next.season] + 1 || 1;
                  return map;
                }, {}))
          };
        } else {
          console.log(`failed cinemeta query: Empty Body`);
          throw new Error('failed cinemeta query');
        }
      });
}

function getKitsuMetadata(kitsuId, type) {
  return needle('get', `${KITSU_URL}/meta/${type}/kitsu:${kitsuId}.json`, { open_timeout: 1000 })
      .then((response) => response.body)
      .then((body) => {
        if (body && body.meta && body.meta.name) {
          return {
            kitsuId: kitsuId,
            title: body.meta.name,
            year: body.meta.year,
            slug: body.meta.slug,
            aliases: body.meta.aliases,
            animeType: body.meta.animeType
          };
        } else {
          console.log(`failed kitsu query: Empty Body`);
          throw new Error('failed kitsu query');
        }
      });
}

function escapeTitle(title) {
  return title.toLowerCase()
  .normalize('NFKD') // normalize non-ASCII characters
  .replace(/[\u0300-\u036F]/g, '')
  .replace(/[.,_+ -]+/g, ' ') // replace dots, commas or underscores with spaces
  .replace(/[^\w- ()]/gi, '') // remove all non-alphanumeric chars
  .trim();
}

const hardcodedTitles = {
  'tt0388629': 'one piece',
  'tt0182629': 'rurouni kenshin',
  'tt2098220': 'hunter x hunter 2011',
  'tt1409055': 'dragon ball kai',
  'tt7441658': 'black clover tv',
  'tt4508902': 'one punch man',
  'tt5626028': 'my hero academia'
};

async function seriesMetadata(id) {
  const idInfo = id.split(':');

  if (id.match(/tt\d+/)) {
    const imdbId = idInfo[0];
    const season = parseInt(idInfo[1], 10);
    const episode = parseInt(idInfo[2], 10);

    const metadata = await getImdbMetadata(imdbId, 'series');
    const hasEpisodeCount = metadata.episodeCount && metadata.episodeCount.length >= season;

    metadata.title= hardcodedTitles[imdbId] || metadata.title;
    metadata.season = season;
    metadata.episode = episode;
    metadata.absoluteEpisode = hasEpisodeCount && metadata.episodeCount.slice(0, season - 1).reduce((a, b) => a + b, episode);
    metadata.totalEpisodes = hasEpisodeCount && metadata.episodeCount.reduce((a, b) => a + b);
    metadata.totalInSeason = hasEpisodeCount && metadata.episodeCount[season - 1];
    metadata.isAnime = !metadata.genres.length || metadata.genres.includes('Animation');

    return metadata;
  } else if (id.match(/kitsu:\d+/)) {
    const kitsuId = idInfo[1];
    const episode = parseInt(idInfo[2], 10);

    const metadata = await getKitsuMetadata(kitsuId, 'series');
    metadata.episode = episode;
    metadata.absoluteEpisode = episode;
    metadata.isAnime = true;

    return metadata;
  }
}

async function movieMetadata(id) {
  if (id.match(/tt\d+/)) {
    const metadata = await getImdbMetadata(id, 'movie');
    metadata.isAnime = !metadata.genres.length || metadata.genres.includes('Animation');

    return metadata;
  } else if (id.match(/kitsu:\d+/)) {
    const kitsuId = id.split(':')[1];
    const metadata = await getKitsuMetadata(kitsuId, 'movie');
    metadata.isAnime = true;

    return metadata;
  }
}

module.exports = { escapeTitle, movieMetadata, seriesMetadata };
