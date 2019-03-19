function streamInfo(providerName, mirror) {
  return {
    name: 'CDN',
    title: joinDetailParts(
        [
        joinDetailParts([providerName, tag(mirror.dubbed, '(Dub)')]),
        joinDetailParts([mirror.name, tag(mirror.external, '[external]')]),
        joinDetailParts([mirror.resolution], '📺 ')
      ],
        '',
        '\n'
    ),
    url: !mirror.external ? mirror.url : undefined,
    externalUrl: mirror.external ?  mirror.url : undefined
  }
}

function joinDetailParts(parts, prefix = '', delimiter = ' ') {
  const filtered = parts.filter((part) => part).join(delimiter);

  return filtered.length > 0 ? `${prefix}${filtered}` : null;
}

function tag(condition, value) {
  return condition ? value : '';
}

module.exports = { streamInfo };
