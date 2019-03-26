# Stremio CDN Videos

Stremio addon for retrieving CDN links for movies, series and anime.

## Deploy

Deploy using `npm` command:

```
npm run deploy
```

## Publish

Use `curl` command to publish addon to Stremio:

```
curl 'https://api.strem.io/api/addonPublish' \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{ "transportUrl": "https://cdn-videos.ga/manifest.json", "transportName": "http" }'
```
