# yhplist

Convert a specific old Spotify playlist into a Plex playlist. Point it at one playlist at a time, it finds (or creates) a matching Plex playlist by name, adds every song you already have in your Plex music library, and logs the ones it couldn't find so you know what to go acquire.

## Quick Start

Requires [Bun](https://bun.sh) ≥ 1.0.0.

```bash
bun install
cp .env.example .env   # fill in SPOTIFY_CLIENT_ID, PLEX_URL, PLEX_TOKEN
bun run dev auth       # one-time Spotify login
bun run dev sync "https://open.spotify.com/playlist/<id>"
```

## Commands

| Command | Alias | Description |
|---|---|---|
| `bun run dev auth` | — | Log in to Spotify (opens your browser, caches a token) |
| `bun run dev sync <playlist>` | `s` | Convert one Spotify playlist into a matching Plex playlist |

`<playlist>` accepts a Spotify playlist URL, `spotify:playlist:...` URI, or raw ID.

### Sync options

| Flag | Description |
|---|---|
| `--name <name>` | Override the target Plex playlist name (default: the Spotify playlist's own name) |
| `--section <title\|id>` | Plex music library section to match against (only needed if your server has more than one) |
| `--threshold <0-100>` | Fuzzy match similarity threshold for this run (default: `MATCH_THRESHOLD` from `.env`) |
| `--dry-run` | Match and log only — writes nothing to Plex |

## How it works

1. Fetches the Spotify playlist's tracks (title, artists, album) via the Spotify Web API.
2. Fetches every track in your configured Plex music library section, once per run.
3. Fuzzy-matches each Spotify track against your Plex library (via [`fuse.js`](https://www.fusejs.io/), weighted on title/artist), normalizing for things like remaster tags, `feat.` credits, and punctuation.
4. Finds a Plex playlist whose name matches (case-insensitively) — or creates one — and adds any matched tracks that aren't already in it. **Existing playlist items are never removed or reordered**, so it's safe to hand-curate the same playlist in Plex too.
5. Writes a full run log and prints a summary of what was added and what's missing.

Tracks scoring below the match threshold are treated as missing rather than force-matched to the nearest thing in your library.

**Note:** as of Spotify's February 2026 API changes, playlist *contents* are only readable for playlists you own (or own collaboratively) — playlists you merely follow will only expose their name, not their tracks. Old playlists on your own account are unaffected.

## Missing tracks

Every run writes a JSON log to `.yhplist/logs/<playlist>-<timestamp>.json` with the full list of unmatched Spotify tracks (name, artists, album, Spotify URL, and the closest sub-threshold Plex candidate found, if any) — a ready-made shopping list for filling gaps in your library. The same list also prints to the console after each sync.

## Configuration

Create `.env` in the project root (see `.env.example`):

| Variable | Description | Default |
|---|---|---|
| `SPOTIFY_CLIENT_ID` | Spotify app client ID (public client, PKCE flow — no secret needed) | required |
| `PLEX_URL` | Plex server base URL | required |
| `PLEX_TOKEN` | Plex `X-Plex-Token` | required |
| `PLEX_MUSIC_SECTION` | Music library section title or ID to match against | auto-detected if your server has exactly one |
| `MATCH_THRESHOLD` | Fuzzy match similarity threshold, 0-100 | `85` |
| `YHPLIST_STATE_PATH` | Where the Spotify token cache and run logs live | `.yhplist` |

**Spotify app:** create one at the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and add `http://127.0.0.1:8888/callback` as a Redirect URI.

**Plex token:** see [Finding an authentication token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/).

## Development

```bash
bun run dev auth              # run from source
bun run dev sync <playlist>
bun test                      # run tests
bun run check:all             # typecheck + lint
```

## License

MIT
