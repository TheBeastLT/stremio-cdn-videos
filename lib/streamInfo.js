function streamInfo(providerName, mirror, dub = false) {
  return {
    name: 'CDN',
    title: `${providerName}${dub ? ' (Dub)': ''}\n${mirror.name}${mirror.external ? ' [external]' : ''}`,
    url: !mirror.external ? mirror.url : undefined,
    externalUrl: mirror.external ?  mirror.url : undefined
  }
}

module.exports = { streamInfo };