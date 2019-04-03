const needle = require('needle');
const { scrape } = require('../lib/scraper');
const { streamInfo } = require('../lib/streamInfo');
const { escapeTitle } = require('../lib/metadata');
const { cacheSlug, getSlug, cacheWrapWonderfulSubs } = require('../lib/cache');

const PROVIDER_NAME = "WonderfulSubs.com";
const PROVIDER_URL = 'https://www.wonderfulsubs.com';

class Provider {

  constructor() {}

  isApplicable(metadata) {
    return metadata.isAnime || metadata.kitsuId;
  }

  async movieStreams(movieMetadata) {
    const slugs = await getSlugs(movieMetadata);

    return findStreams(slugs, movieMetadata, (slug) => movieStreams(slug));
  }

  async seriesStreams(seriesMetadata) {
    const slugs = await getSlugs(seriesMetadata);
    const searchEpisode = seriesMetadata.absoluteEpisode;

    return findStreams(slugs, seriesMetadata, (slug) => episodeStreams(slug, searchEpisode, seriesMetadata));
  }
}

async function findStreams(slugs, metadata, streamCallback) {
  while (slugs.length) {
    const slug = slugs.shift();
    const results = await streamCallback(slug).catch(() => undefined);

    if (results) {
      cacheSlug(metadata.imdbId || metadata.kitsuId, PROVIDER_NAME, slug);
      return results;
    }
  }

  return Promise.resolve([]);
}

async function movieStreams(slug) {
  return cacheWrapWonderfulSubs(slug, () => seriesData(slug))
      .then((data) => data.seasons
          .filter((season) => season.type === 'specials')
          .filter((season) => !season.kitsu_id || season.kitsu_id === data.kitsu_id)
          .map((season) => season.episodes)
          .reduce((a, b) => a.concat(b), []))
      .then((episodes) => Promise.all(episodes
          .map((episode) => episode.sources.map((source) => retrieveStreams(episode, source)))
          .reduce((a, b) => a.concat(b), [])))
      .then((streams) => streams.reduce((a, b) => a.concat(b), []))
}

async function episodeStreams(slug, searchEpisode, metadata) {
  const kitsuId = metadata.kitsuId;
  const year = metadata.year && metadata.year.match(/^\d+/)[0];
  const isEpisodes = metadata.animeType === 'TV' || metadata.animeType === 'ONA';

  return cacheWrapWonderfulSubs(slug, () => seriesData(slug))
      .then((data) => data.seasons
      .filter((season) => {
        if (!kitsuId) {
          return season.type === 'episodes'
              && (!season.has_older_series || season.has_older_series && season.title.includes(year))
        }
        return season.kitsu_id === kitsuId
            || (!season.kitsu_id && season.type === 'episodes' && isEpisodes)
            || (!season.kitsu_id && season.type === 'specials' && !isEpisodes && season.episodes.some((ep) => ep.ova_number));
      })
      .reduce((seasons, nextSeason) => {
        const existingSeason = seasons.find((season) => season.kitsu_id === nextSeason.kitsu_id
            || (!nextSeason.kitsu_id && season.type === nextSeason.type));
        if (existingSeason) {
          existingSeason.episodes = existingSeason.episodes.concat(nextSeason.episodes)
              .reduce((episodes, nextEp) => {
                const existingEp = episodes.find((episode) => episode.episode_number === nextEp.episode_number
                    || episode.ova_number && episode.ova_number === nextEp.ova_number);
                if (existingEp) {
                  existingEp.sources = existingEp.sources.concat(nextEp.sources);
                } else {
                  episodes.push(nextEp);
                }
                return episodes;
              }, []);
        } else {
          seasons.push(nextSeason)
        }
        return seasons;
      }, []))
      .then((seasons) => seasons
          .reduce((current, next) => {
            if (current.episodes.length < searchEpisode) {
              searchEpisode = searchEpisode - current.episodes.length;
              return next;
            }
            return current;
          }).episodes
          .find((episode) => episode.episode_number === searchEpisode || episode.ova_number === searchEpisode ))
      .then((episode) => Promise.all(episode.sources
          .map((source) => retrieveStreams(episode, source))))
      .then((streams) => streams.reduce((a, b) => a.concat(b), []))
}

async function getSlugs(metadata) {
  return await getSlug(metadata.imdbId || metadata.kitsuId, PROVIDER_NAME)
      .then((slug) => slug && [slug]).catch(() => undefined) ||
      [metadata.title].concat(metadata.aliases || []).map((title) => prepareTitle(title));
}

function prepareTitle(title) {
  return escapeTitle(title).replace(/\W/g, '').toLowerCase();
}

function seriesData(title) {
  const requestUrl = `${PROVIDER_URL}/api/media/series`;
  return needle('get', requestUrl, { series: title}, { open_timeout: 1000 })
      .then((response) => {
        if (response.statusCode === 200 && response.body && response.body.status === 200) {
          return response.body.json;
        }
        throw new Error(`no valid response from ${PROVIDER_NAME}`)
      })
      .then((data) => ({
        title: data.title,
        kitsu_id: data.kitsu_id,
        kitsu_ids: data.kitsu_ids,
        seasons: data.seasons.ws.media.map((season) => ({
          id: season.id,
          title: season.title,
          type: season.type,
          kitsu_id: season.kitsu_id,
          has_older_series: season.has_older_series,
          episodes: season.episodes.map((episode) => ({
            id: episode.id,
            title: episode.title,
            episode_number: episode.episode_number,
            ova_number: episode.ova_number || (!episode.episode_number && 1) || undefined,
            media_type: episode.media_type,
            is_subbed: episode.is_subbed,
            is_dubbed: episode.is_dubbed,
            sources: episode.sources ||
                [{ source: 'WS', language: episode.is_dubbed ? 'dubs' : 'subs', retrieve_url: episode.retrieve_url}],
          }))
        }))
      }));
}

function retrieveStreams(episode, mirror) {
  const streamId = Array.isArray(mirror.retrieve_url) ? mirror.retrieve_url.join(',') : mirror.retrieve_url;
  const streamsUrl = `${PROVIDER_URL}/api/media/stream`;
  return needle('get', streamsUrl, { code: streamId }, { open_timeout: 1000 })
      .then((response) => {
        if (response.statusCode === 200 && response.body && response.body.status === 200) {
          return response.body.urls;
        }
        throw new Error(`no valid response from ${PROVIDER_NAME}`)
      })
      .then((urls) => Array.isArray(urls) ? urls : scrape({ url: urls }))
      .then((urls) => (Array.isArray(urls) ? urls : [urls])
          // stremio does not support 'Auto (HLS) encrypted' or 'Auto (DASH)' formats
          //.filter((url) => url.type.match(/mp4/i) || url.src.match(/master\.m3u/))
          .map((url) => ({
              name: mirror.source && `[${mirror.source.toUpperCase()}] ${episode.title.replace(',', '')}`,
              url: url.src || url.url,
              resolution: url.label || url.resolution,
              dubbed: !!mirror.language.match(/dubs/i),
              external: url.external
          }))
          .map((stream) => streamInfo(PROVIDER_NAME, stream)))
      .catch(() => []);
}

exports.Provider = Provider;
