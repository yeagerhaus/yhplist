import fs from "node:fs";
import path from "node:path";

export interface Config {
	spotifyClientId: string;
	plexUrl: string;
	plexToken: string;
	plexMusicSection?: string;
	matchThreshold: number;
	statePath: string;
}

const DEFAULT_MATCH_THRESHOLD = 85;
const DEFAULT_STATE_DIR = ".yhplist";
const REDIRECT_PORT = 8888;

/**
 * Find the project root by walking up from cwd looking for package.json.
 * Falls back to cwd if none is found (e.g. running from a built binary).
 */
function getProjectRoot(): string {
	let currentDir = process.cwd();
	const root = path.parse(currentDir).root;

	while (currentDir !== root) {
		if (fs.existsSync(path.join(currentDir, "package.json"))) {
			return currentDir;
		}
		currentDir = path.dirname(currentDir);
	}

	return process.cwd();
}

export function getSpotifyRedirectUri(): string {
	return `http://127.0.0.1:${REDIRECT_PORT}/callback`;
}

export function getSpotifyRedirectPort(): number {
	return REDIRECT_PORT;
}

export function loadConfig(): Config {
	const spotifyClientId = process.env.SPOTIFY_CLIENT_ID?.trim();
	const plexUrl = process.env.PLEX_URL?.trim();
	const plexToken = process.env.PLEX_TOKEN?.trim();

	if (!spotifyClientId) {
		throw new Error("Missing SPOTIFY_CLIENT_ID in .env");
	}
	if (!plexUrl) {
		throw new Error("Missing PLEX_URL in .env");
	}
	if (!plexToken) {
		throw new Error("Missing PLEX_TOKEN in .env");
	}

	const matchThreshold = process.env.MATCH_THRESHOLD
		? Number.parseInt(process.env.MATCH_THRESHOLD, 10)
		: DEFAULT_MATCH_THRESHOLD;

	const statePath = process.env.YHPLIST_STATE_PATH?.trim()
		? path.resolve(getProjectRoot(), process.env.YHPLIST_STATE_PATH.trim())
		: path.join(getProjectRoot(), DEFAULT_STATE_DIR);

	return {
		spotifyClientId,
		plexUrl: plexUrl.replace(/\/+$/, ""),
		plexToken,
		plexMusicSection: process.env.PLEX_MUSIC_SECTION?.trim() || undefined,
		matchThreshold: Number.isFinite(matchThreshold)
			? matchThreshold
			: DEFAULT_MATCH_THRESHOLD,
		statePath,
	};
}

export function getTokenCachePath(config: Config): string {
	return path.join(config.statePath, "spotify-token.json");
}

export function getLogDir(config: Config): string {
	return path.join(config.statePath, "logs");
}

export function ensureStateDirs(config: Config): void {
	fs.mkdirSync(config.statePath, { recursive: true });
	fs.mkdirSync(getLogDir(config), { recursive: true });
}
