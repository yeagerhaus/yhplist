import type { MatchResult } from "../match/types.js";

export interface SyncOptions {
	playlistIdOrUrl: string;
	nameOverride?: string;
	sectionOverride?: string;
	thresholdOverride?: number;
	dryRun: boolean;
}

export interface SyncResult {
	spotifyPlaylistName: string;
	plexPlaylistName: string;
	plexPlaylistExisted: boolean;
	threshold: number;
	results: MatchResult[];
	addedCount: number;
	alreadyPresentCount: number;
	logPath: string;
}
