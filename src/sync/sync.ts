import ora from "ora";
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

	const spotifySpinner = ora("Fetching Spotify playlist...").start();
	const spotifyPlaylist = await fetchPlaylist(
		options.playlistIdOrUrl,
		accessToken,
		(fetched, total) => {
			spotifySpinner.text = `Fetching Spotify playlist... ${fetched}/${total} tracks`;
		},
	);
	spotifySpinner.succeed(
		`Fetched ${spotifyPlaylist.tracks.length} Spotify tracks from "${spotifyPlaylist.name}"`,
	);

	const plexPlaylistName = options.nameOverride ?? spotifyPlaylist.name;

	logSyncStart(spotifyPlaylist.name, plexPlaylistName);

	const plexClient = createPlexClient(config);
	const section = await resolveMusicSection(plexClient, {
		...config,
		plexMusicSection: options.sectionOverride ?? config.plexMusicSection,
	});

	const librarySpinner = ora(
		`Scanning Plex library "${section.title}"...`,
	).start();
	const libraryTracks = await fetchLibraryTracks(
		plexClient,
		section.key,
		(fetched, total) => {
			librarySpinner.text = `Scanning Plex library "${section.title}"... ${fetched}/${total} tracks`;
		},
	);
	librarySpinner.succeed(`Scanned ${libraryTracks.length} Plex tracks`);

	const threshold = options.thresholdOverride ?? config.matchThreshold;
	const index = buildPlexIndex(libraryTracks);
	const results = matchPlaylist(spotifyPlaylist.tracks, index, threshold);
	const matchedCount = results.filter((r) => r.status === "matched").length;
	console.log(
		`  Matched ${matchedCount}/${results.length} tracks against your Plex library`,
	);

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

	const playlistSpinner = ora(
		options.dryRun
			? "Checking Plex playlist (dry run)..."
			: `Updating Plex playlist "${plexPlaylistName}"...`,
	).start();

	if (!options.dryRun) {
		if (!existingPlaylist) {
			if (matchedKeys.length > 0) {
				await createPlaylist(plexClient, plexPlaylistName, matchedKeys);
				addedCount = matchedKeys.length;
			}
			playlistSpinner.succeed(
				`Created Plex playlist "${plexPlaylistName}" with ${addedCount} tracks`,
			);
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
			playlistSpinner.succeed(
				`Added ${addedCount} new tracks to existing Plex playlist "${plexPlaylistName}"`,
			);
		}
	} else if (existingPlaylist) {
		const existingKeys = await getPlaylistTrackKeys(
			plexClient,
			existingPlaylist.ratingKey,
		);
		const newKeys = matchedKeys.filter((k) => !existingKeys.has(k));
		alreadyPresentCount = matchedKeys.length - newKeys.length;
		addedCount = newKeys.length; // count of tracks that *would* be added
		playlistSpinner.succeed(
			`(dry run) Would add ${addedCount} tracks to existing Plex playlist "${plexPlaylistName}"`,
		);
	} else {
		addedCount = matchedKeys.length;
		playlistSpinner.succeed(
			`(dry run) Would create Plex playlist "${plexPlaylistName}" with ${addedCount} tracks`,
		);
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
