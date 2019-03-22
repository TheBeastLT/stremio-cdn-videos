const needle = require('needle');
const { streamInfo } = require('../lib/streamInfo');
const { cacheWrapWonderfulSubs } = require('../lib/cache');

const PROVIDER_NAME = "WonderfulSubs.com";
const PROVIDER_URL = 'https://www.wonderfulsubs.com';

class Provider {

  constructor() {}

  async movieStreams(movieMetadata) {
    if (!movieMetadata.isAnime) {
      return Promise.resolve([]);
    }
    const preparedTitle = prepareTitle(movieMetadata.title);

    return cacheWrapWonderfulSubs(preparedTitle, () => seriesData(preparedTitle))
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

  async seriesStreams(seriesMetadata) {
    if (!seriesMetadata.isAnime) {
      return Promise.resolve([]);
    }
    const preparedTitle = prepareTitle(seriesMetadata.title);
    const year = seriesMetadata.year && seriesMetadata.year.match(/^\d+/)[0];
    let searchEpisode = seriesMetadata.absoluteEpisode;

    return cacheWrapWonderfulSubs(preparedTitle, () => seriesData(preparedTitle))
        .then((data) => data.seasons
            .filter((season) => season.type === 'episodes')
            .filter((season) => !season.has_older_series || season.has_older_series && season.title.includes(year))
            .reduce((seasons, nextSeason) => {
              nextSeason.kitsu_id = nextSeason.kitsu_id || data.kitsu_id; // some main seasons dont have id assigned
              const existingSeason = seasons.find((season) => season.kitsu_id === nextSeason.kitsu_id);
              if (existingSeason) {
                existingSeason.episodes = existingSeason.episodes.concat(nextSeason.episodes)
                    .reduce((episodes, nextEp) => {
                        const existingEp = episodes.find((episode) => episode.episode_number === nextEp.episode_number);
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
            .find((episode) => episode.episode_number === searchEpisode))
        .then((episode) => Promise.all(episode.sources
            .map((source) => retrieveStreams(episode, source))))
        .then((streams) => streams.reduce((a, b) => a.concat(b), []))
  }
}

function prepareTitle(title) {
  return title.replace(/\W/g, '').toLowerCase();
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
      .then((urls) => urls
          // stremio does not support 'Auto (HLS) encrypted' or 'Auto (DASH)' formats
          .filter((url) => url.type.match(/mp4/i) || url.src.match(/master\.m3u/))
          .map((url) => ({
              name: mirror.source && `[${mirror.source.toUpperCase()}] ${episode.title.replace(',', '')}`,
              url: url.src,
              resolution: url.label,
              dubbed: !!mirror.language.match(/dubs/i)
          }))
          .map((stream) => streamInfo(PROVIDER_NAME, stream)))
      .catch((err) => []);
}

exports.Provider = Provider;
