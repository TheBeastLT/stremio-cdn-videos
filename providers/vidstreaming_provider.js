const { getContent, getContentMatches, scrape } = require('../lib/scraper');
const { streamInfo } = require('../lib/streamInfo');
const { escapeTitle } = require('../lib/metadata');
const { cacheSlug, getSlug } = require('../lib/cache');

const PROVIDER_NAME = "VidStreaming.io";
const VIDSTREAMING_URL = 'https://vidstreaming.io';

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
    const absoluteEpisode = seriesMetadata.absoluteEpisode;

    return findStreams(slugs, seriesMetadata, (slug) => episodeStreams(slug, absoluteEpisode));
  }
}

async function findStreams(slugs, metadata, streamCallback) {
  while (slugs.length) {
    const slug = slugs.shift();
    const results = await streamCallback(slug);

    if (!results.every((result) => result === undefined)) {
      cacheSlug(metadata.imdbId || metadata.kitsuId, PROVIDER_NAME, slug);

      return results.filter((result) => result).reduce((a, b) => a.concat(b), []);
    }
  }

  return Promise.resolve([]);
}

async function movieStreams(slug) {
  return Promise.all([
    retrieveMirrors(`${VIDSTREAMING_URL}/videos/${slug}-episode-1`).catch(() => undefined),
    retrieveMirrors(`${VIDSTREAMING_URL}/videos/${slug}-dub-episode-1`, true).catch(() => undefined)
  ]);
}

async function episodeStreams(slug, absoluteEpisode) {
  return Promise.all([
    retrieveMirrors(`${VIDSTREAMING_URL}/videos/${slug}-episode-${absoluteEpisode}`)
        .catch((err) => retrieveMirrors(`${VIDSTREAMING_URL}/videos/${slug}--episode-${absoluteEpisode}`))
        .catch((err) => undefined),
    retrieveMirrors(`${VIDSTREAMING_URL}/videos/${slug}-dub-episode-${absoluteEpisode}`, true)
        .catch(() => undefined)
  ]);
}

async function getSlugs(metadata) {
  return await getSlug(metadata.imdbId || metadata.kitsuId, PROVIDER_NAME)
      .then((slug) => slug && [slug]).catch(() => undefined) ||
      [metadata.title].concat(metadata.aliases || []).map((title) => prepareTitle(title));
}

function prepareTitle(title) {
  return escapeTitle(title)
      .replace(/\W+/g, ' ')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();
}

function retrieveMirrors(url, dubbed = false) {
  return getContentMatches(url, /<iframe.+"(.*vidstreaming\.io[^"]+)"/i)
      .then((matches) => matches[1].replace(/^\/\//, 'https://'))
      .then((videoUrl) => getContent(videoUrl))
      .then((response) => extractMirrors(response.body))
      .then((mirrors) => Promise.all(mirrors.map(mirror => scrape(mirror))))
      .then((mirrors) => mirrors.map((mirror) => { mirror.dubbed = dubbed; return mirror; }))
      .then((mirrors) => mirrors.map(mirror => streamInfo(PROVIDER_NAME, mirror)));
}

function extractMirrors(body) {
  if (!body) {
    throw new Error('no body');
  }

  const listDiv = body.match(/<ul class="list-server-items">(.+)<\/ul>/s)[1];
  const activeSource = body.match(/file:\W+['"]([^'"]+)['"]/)[1];

  return listDiv.match(/<li class="(?:active )?linkserver".+<\/li>/g)
      .map(mirrorDiv => ({
        name: mirrorDiv.match(/>(.+)<\/li>/)[1],
        url: mirrorDiv.includes('active') ? activeSource :
            mirrorDiv.match(/data-video="(.+)"/)[1].replace(/^\/\//, 'https://')
      }))
}

exports.Provider = Provider;
