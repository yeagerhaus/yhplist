import type { Config } from "../config.js";
import { buildPlexIndex, matchPlaylist } from "../match/matcher.js";
import { createPlexClient } from "../plex/client.js";
import { fetchLibraryTracks, resolveMusicSection } from "../plex/library.js";
import {
	addTracksToPlaylist,
	createPlaylist,
	findPlaylistByName,
	getPlaylistTrackKeys,
} from "../plex/playlists.js";
import { getValidAccessToken } from "../spotify/auth.js";
import { fetchPlaylist } from "../spotify/client.js";
import { logSyncStart, writeRunLog } from "./logger.js";
import type { SyncOptions, SyncResult } from "./types.js";

export async function syncPlaylist(
	config: Config,
	options: SyncOptions,
): Promise<SyncResult> {
	const accessToken = await getValidAccessToken(config);
	const spotifyPlaylist = await fetchPlaylist(
		options.playlistIdOrUrl,
		accessToken,
	);
	const plexPlaylistName = options.nameOverride ?? spotifyPlaylist.name;

	logSyncStart(spotifyPlaylist.name, plexPlaylistName);

	const plexClient = createPlexClient(config);
	const section = await resolveMusicSection(plexClient, {
		...config,
		plexMusicSection: options.sectionOverride ?? config.plexMusicSection,
	});
	const libraryTracks = await fetchLibraryTracks(plexClient, section.key);

	const threshold = options.thresholdOverride ?? config.matchThreshold;
	const index = buildPlexIndex(libraryTracks);
	const results = matchPlaylist(spotifyPlaylist.tracks, index, threshold);

	const matchedKeys = [
		...new Set(
			results
				.filter((r) => r.status === "matched" && r.plexTrack)
				.map((r) => r.plexTrack?.ratingKey as string),
		),
	];

	const existingPlaylist = await findPlaylistByName(
		plexClient,
		plexPlaylistName,
	);
	let addedCount = 0;
	let alreadyPresentCount = 0;

	if (!options.dryRun) {
		if (!existingPlaylist) {
			if (matchedKeys.length > 0) {
				await createPlaylist(plexClient, plexPlaylistName, matchedKeys);
				addedCount = matchedKeys.length;
			}
		} else {
			const existingKeys = await getPlaylistTrackKeys(
				plexClient,
				existingPlaylist.ratingKey,
			);
			const newKeys = matchedKeys.filter((k) => !existingKeys.has(k));
			alreadyPresentCount = matchedKeys.length - newKeys.length;
			await addTracksToPlaylist(
				plexClient,
				existingPlaylist.ratingKey,
				newKeys,
			);
			addedCount = newKeys.length;
		}
	} else if (existingPlaylist) {
		const existingKeys = await getPlaylistTrackKeys(
			plexClient,
			existingPlaylist.ratingKey,
		);
		const newKeys = matchedKeys.filter((k) => !existingKeys.has(k));
		alreadyPresentCount = matchedKeys.length - newKeys.length;
		addedCount = newKeys.length; // count of tracks that *would* be added
	} else {
		addedCount = matchedKeys.length;
	}

	const partialResult = {
		spotifyPlaylistName: spotifyPlaylist.name,
		plexPlaylistName,
		plexPlaylistExisted: Boolean(existingPlaylist),
		threshold,
		results,
		addedCount,
		alreadyPresentCount,
	};

	const logPath = writeRunLog(config, spotifyPlaylist.name, partialResult);

	return { ...partialResult, logPath };
}
