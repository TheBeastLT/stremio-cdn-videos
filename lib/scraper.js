const needle = require('needle');
const { getOpenloadUrl } = require("./openload");

async function getContentMatches(url, regex, headers = {}) {
  return new Promise((resolve, reject) => {
    let body = '';
    needle.get(url, { open_timeout: 1000, headers: headers })
        .on('readable', function() {
          while (data = this.read()) {
            body = body.concat(data.toString());
            const matches = body.match(regex);
            if (matches) {
              resolve(matches);
              this.destroy();
            }
          }
        })
        .on('done', (err) => {
          // means that promise was not resolved previously so no mirror was found
          reject(err || new Error(`vidstreaming url not available`));
        });
  })
}

async function getContent(url, method = 'get', headers = {}) {
  return needle(method, url, { open_timeout: 1000, headers: headers });
}

async function scrape(mirror) {
  return _scrape(mirror)
      .catch(() => ({
        name: mirror.name,
        url: mirror.url,
        external: true
      }))
}

async function _scrape(mirror) {
  if (!mirror || !mirror.url || !mirror.name) {
    return Promise.reject(new Error('Invalid mirror'));
  }

  if (mirror.url.match(/vidsrc\.me\/server\d+\//i)) {
    if (mirror.name.toLowerCase() === 'google hd') {
      const imdbId = mirror.url.match(/\/(tt\d+)\//)[1];
      const seasonMatch = mirror.url.match(/\/(\d+)-\d+\/?$/);
      const season = seasonMatch ? `&s=${seasonMatch[1]}` : '';
      const episodeMatch = mirror.url.match(/\/\d+-(\d+)\/?$/);
      const episode = episodeMatch ? `&e=${episodeMatch[1]}` : '';
      const srv = mirror.url.match(/\/server(\d+)\//)[1];
      return getContent(`https://vidsrc.me/watching?i=${imdbId}${season}${episode}&srv=${srv}`, 'get', { 'Referer': mirror.url })
          .then((response) => scrape({
            name: mirror.name,
            url: response.headers.location
          }))
    } else if (mirror.name.toLowerCase() === 'openload') {
      return getContent('https://vidsrc.me/yeye', 'get', { 'Referer': mirror.url })
          .then((response) => scrape({
            name: mirror.name,
            url: `https://openload.co/embed/${response.body}/`
          }))
    }
  } else if (mirror.url.match(/(?:xstreamcdn\.com|vidsource\.me)\/v/i)) {
    return getContent(mirror.url.replace(/\/v\//, '/api/source/'), 'post')
        .then((response) => response.body.data
            .reduce((s1, s2) => parseInt(s1.label) > parseInt(s2.label) ? s1 : s2))
        .then((videoSource) => getContent(videoSource.file)
            .then((response) => ({
              name: mirror.name,
              url: response.headers.location,
              resolution: videoSource.label
            })))
  } else if (mirror.url.match(/rapidvideo\.com\/e\//i)) {
    return getContentMatches(`${mirror.url}?q=1080`, /<video[^>]+>(.+)<\/video>/s)
        .then((matches) => matches[1].match(/<source src=.+type="video.+>/g)
            .map((sourceDiv) => ({
              url: sourceDiv.match(/src="(.*?)"/)[1],
              resolution: parseInt(sourceDiv.match(/title="(.*?)"/)[1])
            })).reduce((s1, s2) => s1.resolution > s2.resolution ? s1 : s2))
        .then((videoSource) => ({
          name: mirror.name,
          url: videoSource.url,
          resolution: `${videoSource.resolution}p`
        }));
  } else if (mirror.url.match(/streamango\.com\/embed/i)) {
    return getContentMatches(mirror.url, /<script[^>]*>(\s*eval\(.*srces\.push.*?)<\/script>/s)
        .then((matches) => {
          let window = {};
          let d = (...args) => window.d(...args);
          eval(matches[1].replace(/\$\(document\).+/s, ''));
          return srces.reduce((s1, s2) => s1.height > s2.height ? s1 : s2);
        })
        .then((source) => getContent(source.src.replace(/^\/\//, 'https://'))
            .then((response) => ({
              name: mirror.name,
              url: response.headers.location,
              resolution: `${source.height}p`
            })))
  } else if (mirror.url.match(/mp4upload\.com\/embed/i)) {
    return getContentMatches(mirror.url, /<script type='text\/javascript'>eval\((.+)\)\s+<\/script>/s)
        .then((matches) => {
            eval("result = " + matches[1].trim());
            return result;
        })
        .then((evaled) =>  evaled.match(/"file"\s?:\s?"([^"]+)"/)[1])
        .then((videoUrl) => ({
          name: mirror.name,
          url: videoUrl
        }))
  } else if (mirror.url.match(/(?:openload\.co|oload\.tv)\/embed/i)) {
    // @TODO IP restricted streams need to figure out how to decode for specific ip
    throw new Error(`not supported url=${mirror.url}`);
    // return getOpenloadUrl(mirror.url)
    //     .then((videoUrl) => getContent(videoUrl)
    //         .then((response) => ({
    //           name: mirror.name,
    //           url: response.headers.location
    //         })));
  } else if (mirror.url.match(/vidstreaming\.io\/load\.php/i)) {
    // @ TODO needs header attached when requesting stream, which is no possible now in stremio
    throw new Error(`not supported url=${mirror.url}`);
    // return getContentMatches(mirror.url, /file:\W+['"]([^']+)['"]/is)
    //     .then((playListUrl) => getContent(playListUrl[1], 'get', { 'Referer': 'https://vidstreaming.io/' })
    //         .then((response) => response.body.toString())
    //         .then((playlists) => playlists.match(/ext-x[^#]+/gis)
    //             .map(playlist => ({
    //                 resolution: parseInt(playlist.match(/name="(\d+)/i)[1]),
    //                 url: playListUrl[1].replace(/[^\/]+$/, playlist.match(/\n(.+)\n?$/)[1])
    //               })).reduce((s1, s2) => s1.resolution > s2.resolution ? s1 : s2)))
    //     .then((playlist) => ({
    //       name: mirror.name,
    //       url: playlist.url,
    //       resolution: `${playlist.resolution}p`,
    //       headers: { 'Referer': 'https://vidstreaming.io/' }
    //     }))
  }
  throw new Error(`not supported url=${mirror.url}`);
}

module.exports = { getContentMatches, scrape };
