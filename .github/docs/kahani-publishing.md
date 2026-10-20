# Kahani publishing

The Hindi story section uses the existing Jekyll site and TypeScript build. Its author credit is **Kahani by Ram Sandesh**, independently of the developer profile.

## Routes

- `/Kahani/`: catalogue, episode introductions, publication status and sharing.
- `/About-Kahani-Videos/`: creator identity, fictional-story notice, production transparency and contact.

Both routes use their requested capitalisation. Jekyll generates index.html in each directory. Search and sitemap generation pick up both pages automatically.

## Publish a video

1. Finish and check the voiced film and its final subtitles, then publish it to the actual YouTube channel.
2. In `_data/kahani.yml`, set `brand.channel_profile` to the appropriate key in `_data/social.yml`. The current `youtube` profile contains the owner-provided Kahani Wali Shaam channel. Keep the channel URL in that shared profile so the Kahani pages and the rest of the website stay in sync.
3. For the episode set `youtube_url`, change `status` to `published` and `status_label` to `प्रकाशित`. Set `duration_label` only when the final runtime is known; leave it empty otherwise. Set `captions_url` only when a final caption file exists at that path.
4. Check the episode's publication note: it switches automatically with `status`. The first episode now links to the video supplied by the owner: `https://youtu.be/ZHGqhWnJRmU`, with the owner-confirmed runtime of 11 minutes 55 seconds. Its captions field remains empty until a final caption file is supplied.
5. Rebuild Jekyll and verify both routes, the episode links, sitemap and search index. Run `npm run check` and `npm run build` if TypeScript changed; commit both `src/ts/kahani.ts` and `assets/js/kahani.js`.

For another episode, append a record in `_data/kahani.yml`, with a unique HTML-safe `id`. Use real production metadata, a local poster and accessible alt text. Do not advertise a placeholder as an already published film.

## Browser behaviour and privacy

The catalogue's search and status filters run in the browser, without network calls or persistent storage. The HTML remains readable and navigable when JavaScript is disabled. Sharing uses the browser's native share interface where available, with clipboard fallback. It runs only after a visitor presses the button.

Videos currently link out rather than loading an external player. Do not add third-party embeds without reviewing the site's CSP and its privacy/cookie pages, as documented in README.md.

The initial artwork is original code-drawn SVG/PNG, not AI image-generator output. Noto Sans Devanagari is self-hosted under the bundled OFL notice. Website code/content keep the repository's existing licensing decision.
