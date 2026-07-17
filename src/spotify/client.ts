import got from "got";
import type { SpotifyPlaylist, SpotifyTrack } from "./types.js";

const API_BASE = "https://api.spotify.com/v1";
const PAGE_SIZE = 50; // max allowed by the /items endpoint

interface RawTrackItem {
	// Spotify's Feb 2026 migration renamed `track` -> `item` on this endpoint
	// (GET /playlists/{id}/tracks was removed in favor of /items).
	item: {
		id: string;
		name: string;
		duration_ms: number;
		external_urls?: { spotify?: string };
		artists: Array<{ name: string }>;
		album: { name: string };
	} | null;
}

interface RawTracksPage {
	items: RawTrackItem[];
	next: string | null;
}

/**
 * Extract a Spotify playlist ID from a raw ID, a spotify: URI, or an
 * open.spotify.com URL.
 */
export function parsePlaylistId(input: string): string {
	const trimmed = input.trim();

	const uriMatch = trimmed.match(/^spotify:playlist:([a-zA-Z0-9]+)$/);
	if (uriMatch) {
		return uriMatch[1];
	}

	try {
		const url = new URL(trimmed);
		const match = url.pathname.match(/\/playlist\/([a-zA-Z0-9]+)/);
		if (match) {
			return match[1];
		}
	} catch {
		// Not a URL, fall through
	}

	if (/^[a-zA-Z0-9]+$/.test(trimmed)) {
		return trimmed;
	}

	throw new Error(`Could not parse a Spotify playlist ID from "${input}"`);
}

export async function fetchPlaylist(
	playlistIdOrUrl: string,
	accessToken: string,
): Promise<SpotifyPlaylist> {
	const playlistId = parsePlaylistId(playlistIdOrUrl);
	const headers = { Authorization: `Bearer ${accessToken}` };

	const meta = await got(`${API_BASE}/playlists/${playlistId}`, {
		headers,
		searchParams: { fields: "name" },
	}).json<{ name: string }>();

	const tracks: SpotifyTrack[] = [];
	let url: string | undefined = `${API_BASE}/playlists/${playlistId}/items`;
	let searchParams: Record<string, string | number> | undefined = {
		limit: PAGE_SIZE,
		fields:
			"items(item(id,name,duration_ms,external_urls,artists(name),album(name))),next",
	};

	while (url) {
		const page: RawTracksPage = await got(url, {
			headers,
			searchParams,
		}).json<RawTracksPage>();

		for (const item of page.items) {
			if (!item.item) continue; // local/removed tracks show up as null
			tracks.push({
				id: item.item.id,
				name: item.item.name,
				artists: item.item.artists.map((a) => a.name),
				album: item.item.album.name,
				durationMs: item.item.duration_ms,
				url: item.item.external_urls?.spotify ?? "",
			});
		}

		url = page.next ?? undefined;
		searchParams = undefined; // `next` already includes query params
	}

	return { id: playlistId, name: meta.name, tracks };
}
