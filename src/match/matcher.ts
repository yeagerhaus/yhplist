import Fuse, { type Expression } from "fuse.js";
import type { PlexTrack } from "../plex/types.js";
import type { SpotifyTrack } from "../spotify/types.js";
import { normalize } from "../utils.js";
import type { MatchResult } from "./types.js";

interface SearchableTrack {
	original: PlexTrack;
	title: string;
	artist: string;
}

export type PlexTrackIndex = Fuse<SearchableTrack>;

export function buildPlexIndex(tracks: PlexTrack[]): PlexTrackIndex {
	const searchable: SearchableTrack[] = tracks.map((t) => ({
		original: t,
		title: normalize(t.title),
		artist: normalize(t.artist),
	}));

	return new Fuse(searchable, {
		keys: [
			{ name: "title", weight: 0.65 },
			{ name: "artist", weight: 0.35 },
		],
		includeScore: true,
		ignoreLocation: true,
		threshold: 0.6,
	});
}

/**
 * Match one Spotify track against the pre-built Plex library index. Accepts
 * the best candidate if its similarity clears `thresholdPercent`; otherwise
 * the track is reported missing, with the best (sub-threshold) candidate
 * attached for debugging.
 */
export function matchTrack(
	spotifyTrack: SpotifyTrack,
	index: PlexTrackIndex,
	thresholdPercent: number,
): MatchResult {
	const query: Expression = {
		$and: [
			{ title: normalize(spotifyTrack.name) },
			{ artist: normalize(spotifyTrack.artists[0] ?? "") },
		],
	};
	const results = index.search(query, { limit: 1 });

	if (results.length === 0) {
		return { spotifyTrack, score: 0, status: "missing" };
	}

	const [best] = results;
	const score = Math.round((1 - (best.score ?? 1)) * 100);

	if (score >= thresholdPercent) {
		return {
			spotifyTrack,
			plexTrack: best.item.original,
			score,
			status: "matched",
		};
	}

	return {
		spotifyTrack,
		plexTrack: best.item.original,
		score,
		status: "missing",
	};
}

export function matchPlaylist(
	spotifyTracks: SpotifyTrack[],
	index: PlexTrackIndex,
	thresholdPercent: number,
): MatchResult[] {
	return spotifyTracks.map((track) =>
		matchTrack(track, index, thresholdPercent),
	);
}
