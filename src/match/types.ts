import type { PlexTrack } from "../plex/types.js";
import type { SpotifyTrack } from "../spotify/types.js";

export interface MatchResult {
	spotifyTrack: SpotifyTrack;
	plexTrack?: PlexTrack;
	score: number; // 0-100 similarity of the best candidate found, if any
	status: "matched" | "missing";
}
