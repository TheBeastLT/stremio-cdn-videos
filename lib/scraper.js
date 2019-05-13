const needle = require('needle');
const { getOpenloadUrl } = require("./openload");
const evl = require('eval');

// Some of the scrapped links can only be served inside local network, cause of IP restrictions
const IS_LOCAL = !(process.env.LOCAL_NETWORK === 'false' || process.env.LOCAL_NETWORK === '0');

async function getContentMatches(url, regex, headers = {}) {
  return new Promise((resolve, reject) => {
    let body = '';
    needle.get(url, { open_timeout: 1000, headers: headers })
        .on('readable', function() {
          let data = this.read();
          while (data) {
            body = body.concat(data.toString());
            const matches = body.match(regex);
            if (matches) {
              resolve(matches);
              this.destroy();
            }
            data = !matches && this.read();
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
      .catch((error) =>{
        if (error.message && error.message .includes('not supported url')) {
          // scraping for this provider is not supported return external link for it
          return {
            name: mirror.name,
            url: mirror.url,
            external: true
          }
        } else {
          // no video source was found - no url will be passed
          return {
            name: mirror.name,
            originalUrl: mirror.url
          }
        }
      })
}

async function _scrape(mirror) {
  if (!mirror || !mirror.url) {
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
          }));
    } else if (mirror.name.toLowerCase() === 'openload') {
      return getContent('https://vidsrc.me/yeye', 'get', { Referer: mirror.url })
          .then((response) => scrape({
            name: mirror.name,
            url: `https://openload.co/embed/${response.body}/`
          }));
    }
  } else if (mirror.url.match(/vidstreaming\.io\/load\.php/i)) {
    return getContentMatches(mirror.url, /sources:\[(.*?)]/)
        .then((sourcesDiv) => sourcesDiv[1].split('},{')
            .map(sourceDiv => ({
              name: mirror.name,
              url: sourceDiv.match(/file\s?:\s+['"]([^'"]+)['"]/)[1],
              resolution: `${(sourceDiv.match(/label\s?:\s?['"](\d+)[^'"]+['"]/) || [0, 0])[1]}p`
            })).reduce((s1, s2) => parseInt(s1.resolution) > parseInt(s2.resolution) ? s1 : s2))
        .then((source) => scrape(source))
  } else if (mirror.url.match(/vidup\.me\//i)) {
    return getContent(mirror.url)
        .then((response) => scrape({
          name: mirror.name,
          url: response.headers.location
        }));
  } else if (mirror.url.match(/mp4upload\.com\/embed/i)) {
    return getContentMatches(mirror.url, /<script type='text\/javascript'>eval\((.+)\)\s+<\/script>/s)
        .then(async (matches) => {
          return evl('(' + matches[1].trim() + ')')
        })
        .then((evaled) =>  evaled.match(/player\.src\("([^"]+)"/)[1])
        .then((videoUrl) => ({
          name: mirror.name,
          url: videoUrl
        }));
    // @TODO url is encoded based on passed headers need to figure out what headers does it need
  // } else if (mirror.url.match(/(?:vev|vidup)\.io\//i)) {
  //   const id = mirror.url.match(/\/([^\/]+)$/)[1];
  //   const host = mirror.url.match(/\/\/([^\/]+)\//)[1];
  //   return getContent(`https://${host}/api/serve/video/${id}`, 'post')
  //       .then((response) => Object.keys(response.body.qualities)
  //       .map((key) => ({
  //         name: mirror.name,
  //         originalUrl: mirror.url,
  //         url: response.body.qualities[key],
  //         resolution: key
  //       })).reduce((s1, s2) => parseInt(s1.resolution) > parseInt(s2.resolution) ? s1 : s2))
  } else if (mirror.url.match(/(?:xstreamcdn\.com|vidsource\.me)\/v/i) && IS_LOCAL) {
    return getContent(mirror.url.replace(/\/v\//, '/api/source/'), 'post')
        .then((response) => response.body.data
            .reduce((s1, s2) => parseInt(s1.label) > parseInt(s2.label) ? s1 : s2))
        .then((videoSource) => scrape({
          name: mirror.name,
          url: videoSource.file,
          resolution: videoSource.label
        }));
  } else if (mirror.url.match(/redirector\.googlevideo\.com\/|fvs\.io\/redirector/) && IS_LOCAL) {
    return getContent(mirror.url)
        .then((response) => ({
          name: mirror.name,
          url: response.headers.location,
          resolution: mirror.resolution
        }))
  } else if (mirror.url.match(/rapidvideo\.com\/e\//i) && IS_LOCAL) {
    // @TODO IP restricted streams need to figure out how to decode for specific ip
    return getContent(`${mirror.url}?q=1080`)
        .then((response) => response.body && response.body.match(/<video[^>]+>(.+)<\/video>/s))
        .then((matches) => matches[1].match(/<source src=.+type="video.+>/g)
            .map((sourceDiv) => ({
              name: mirror.name,
              originalUrl: mirror.url,
              url: sourceDiv.match(/src="(.*?)"/)[1],
              resolution: sourceDiv.match(/title="(.*?)"/)[1]
            })).reduce((s1, s2) => parseInt(s1.resolution) > parseInt(s2.resolution) ? s1 : s2));
  } else if (mirror.url.match(/streamango\.com\/embed/i) && IS_LOCAL) {
    // Disabled because eval works differently for local add-ons
    throw new Error(`not supported url=${mirror.url}`);
    // @TODO IP restricted streams need to figure out how to decode for specific ip
    // return getContentMatches(mirror.url, /<script[^>]*>(\s*eval\(.*srces\.push.*?)<\/script>/s)
    //     .then((matches) => {
    //       let window = {};
    //       let d = (...args) => window.d(...args);
    //       eval(matches[1].replace(/\$\(document\).+/s, ''));
    //       return srces.reduce((s1, s2) => s1.height > s2.height ? s1 : s2);
    //     })
    //     .then((source) => getContent(source.src.replace(/^\/\//, 'https://'))
    //         .then((response) => ({
    //           name: mirror.name,
    //           url: response.headers.location,
    //           resolution: `${source.height}p`
    //         })));
  } else if (mirror.url.match(/(?:openload\.co|oload\.tv)\/embed/i) && IS_LOCAL) {
    // @TODO IP restricted streams need to figure out how to decode for specific ip
    return getOpenloadUrl(mirror.url)
        .then((videoUrl) => getContent(videoUrl)
            .then((response) => ({
              name: mirror.name,
              url: response.headers.location
            })));
  } else if (mirror.url.match(/yourupload\.com\/embed\//i)) {
    // @TODO needs header attached to stream correctly
    throw new Error(`not supported url=${mirror.url}`);
    // return getContentMatches(mirror.url, /jwplayerOptions\W+file\s?:\s?["']([^"']+)["']/)
    //     .then((matches) => getContent(matches[1], 'get', { Referer: mirror.url }))
    //     .then((response) => ({
    //       name: mirror.name,
    //       originalUrl: mirror.url,
    //       url: response.headers.location,
    //       headers: { Referer: mirror.url }
    //     }))
  }
  throw new Error(`not supported url=${mirror.url}`);
}

module.exports = { getContentMatches, getContent, scrape };
