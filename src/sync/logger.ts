import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import type { Config } from "../config.js";
import { getLogDir } from "../config.js";
import { slugify } from "../utils.js";
import type { SyncResult } from "./types.js";

export function logSyncStart(
	spotifyPlaylistName: string,
	plexPlaylistName: string,
): void {
	console.log();
	console.log(pc.bold("═".repeat(63)));
	console.log(
		pc.bold(`  Syncing "${spotifyPlaylistName}" -> Plex "${plexPlaylistName}"`),
	);
	console.log(pc.bold("═".repeat(63)));
	console.log();
}

export function logSyncComplete(result: SyncResult): void {
	const matched = result.results.filter((r) => r.status === "matched");
	const missing = result.results.filter((r) => r.status === "missing");

	console.log();
	console.log(pc.bold("═".repeat(63)));
	console.log(pc.bold("  Sync Complete"));
	console.log(pc.bold("═".repeat(63)));
	console.log(`  Spotify tracks: ${result.results.length}`);
	console.log(`  ${pc.green("Matched")}: ${matched.length}`);
	console.log(`  ${pc.yellow("Missing")}: ${missing.length}`);
	console.log(`  Added to Plex playlist: ${result.addedCount}`);
	console.log(`  Already in Plex playlist: ${result.alreadyPresentCount}`);
	console.log(`  Match threshold: ${result.threshold}%`);
	console.log(pc.bold("═".repeat(63)));

	if (missing.length > 0) {
		console.log();
		console.log(pc.yellow(`  Missing tracks (${missing.length}):`));
		for (const m of missing) {
			const artists = m.spotifyTrack.artists.join(", ");
			const candidate = m.plexTrack
				? pc.dim(
						` (closest: "${m.plexTrack.title}" by ${m.plexTrack.artist}, ${m.score}%)`,
					)
				: "";
			console.log(`    • ${m.spotifyTrack.name} — ${artists}${candidate}`);
		}
	}

	console.log();
	console.log(pc.dim(`  Full log: ${result.logPath}`));
	console.log();
}

interface RunLogFile {
	timestamp: string;
	spotifyPlaylistName: string;
	plexPlaylistName: string;
	plexPlaylistExisted: boolean;
	threshold: number;
	matchedCount: number;
	missingCount: number;
	addedCount: number;
	alreadyPresentCount: number;
	missingTracks: Array<{
		name: string;
		artists: string[];
		album: string;
		url: string;
		bestCandidate?: { title: string; artist: string; score: number };
	}>;
}

/** Write the full run log (including all missing tracks) to `.yhplist/logs/`. */
export function writeRunLog(
	config: Config,
	spotifyPlaylistName: string,
	result: Omit<SyncResult, "logPath">,
): string {
	const dir = getLogDir(config);
	fs.mkdirSync(dir, { recursive: true });

	const timestamp = new Date().toISOString();
	const fileName = `${slugify(spotifyPlaylistName)}-${timestamp.replace(/[:.]/g, "-")}.json`;
	const logPath = path.join(dir, fileName);

	const missing = result.results.filter((r) => r.status === "missing");

	const log: RunLogFile = {
		timestamp,
		spotifyPlaylistName,
		plexPlaylistName: result.plexPlaylistName,
		plexPlaylistExisted: result.plexPlaylistExisted,
		threshold: result.threshold,
		matchedCount: result.results.length - missing.length,
		missingCount: missing.length,
		addedCount: result.addedCount,
		alreadyPresentCount: result.alreadyPresentCount,
		missingTracks: missing.map((m) => ({
			name: m.spotifyTrack.name,
			artists: m.spotifyTrack.artists,
			album: m.spotifyTrack.album,
			url: m.spotifyTrack.url,
			bestCandidate: m.plexTrack
				? {
						title: m.plexTrack.title,
						artist: m.plexTrack.artist,
						score: m.score,
					}
				: undefined,
		})),
	};

	fs.writeFileSync(logPath, JSON.stringify(log, null, 2), "utf-8");
	return logPath;
}
