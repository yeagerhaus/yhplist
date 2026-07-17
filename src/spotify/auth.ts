import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import got from "got";
import open from "open";
import type { Config } from "../config.js";
import {
	ensureStateDirs,
	getSpotifyRedirectUri,
	getTokenCachePath,
} from "../config.js";
import type { SpotifyTokenCache } from "./types.js";

const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const SCOPES = "playlist-read-private playlist-read-collaborative";

interface TokenResponse {
	access_token: string;
	refresh_token?: string;
	expires_in: number;
}

function base64Url(input: Buffer): string {
	return input
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function generatePkcePair(): { verifier: string; challenge: string } {
	const verifier = base64Url(crypto.randomBytes(64));
	const challenge = base64Url(
		crypto.createHash("sha256").update(verifier).digest(),
	);
	return { verifier, challenge };
}

function loadTokenCache(config: Config): SpotifyTokenCache | null {
	const cachePath = getTokenCachePath(config);
	if (!fs.existsSync(cachePath)) {
		return null;
	}
	try {
		return JSON.parse(fs.readFileSync(cachePath, "utf-8")) as SpotifyTokenCache;
	} catch {
		return null;
	}
}

function saveTokenCache(config: Config, cache: SpotifyTokenCache): void {
	ensureStateDirs(config);
	fs.writeFileSync(
		getTokenCachePath(config),
		JSON.stringify(cache, null, 2),
		"utf-8",
	);
}

/**
 * Run the interactive Authorization Code + PKCE flow: opens the user's
 * browser, waits for the redirect on a local loopback server, exchanges the
 * code for tokens, and caches them.
 */
export async function runAuthFlow(config: Config): Promise<SpotifyTokenCache> {
	const { verifier, challenge } = generatePkcePair();
	const state = base64Url(crypto.randomBytes(16));
	const redirectUri = getSpotifyRedirectUri();

	const authorizeUrl = new URL(AUTHORIZE_URL);
	authorizeUrl.searchParams.set("client_id", config.spotifyClientId);
	authorizeUrl.searchParams.set("response_type", "code");
	authorizeUrl.searchParams.set("redirect_uri", redirectUri);
	authorizeUrl.searchParams.set("code_challenge_method", "S256");
	authorizeUrl.searchParams.set("code_challenge", challenge);
	authorizeUrl.searchParams.set("scope", SCOPES);
	authorizeUrl.searchParams.set("state", state);

	const code = await new Promise<string>((resolve, reject) => {
		const server = http.createServer((req, res) => {
			const url = new URL(req.url ?? "/", redirectUri);
			if (url.pathname !== "/callback") {
				res.writeHead(404).end();
				return;
			}

			const returnedState = url.searchParams.get("state");
			const returnedCode = url.searchParams.get("code");
			const error = url.searchParams.get("error");

			res.writeHead(200, { "Content-Type": "text/html" });
			if (error || !returnedCode || returnedState !== state) {
				res.end(
					"<html><body>Login failed. You can close this tab.</body></html>",
				);
				server.close();
				reject(new Error(error ?? "Spotify login failed or state mismatch"));
				return;
			}

			res.end(
				"<html><body>Logged in. You can close this tab and return to the terminal.</body></html>",
			);
			server.close();
			resolve(returnedCode);
		});

		server.listen(
			new URL(redirectUri).port ? Number(new URL(redirectUri).port) : 8888,
		);
		open(authorizeUrl.toString()).catch(reject);
	});

	const tokenResponse = await got
		.post(TOKEN_URL, {
			form: {
				grant_type: "authorization_code",
				code,
				redirect_uri: redirectUri,
				client_id: config.spotifyClientId,
				code_verifier: verifier,
			},
		})
		.json<TokenResponse>();

	if (!tokenResponse.refresh_token) {
		throw new Error("Spotify did not return a refresh token");
	}

	const cache: SpotifyTokenCache = {
		accessToken: tokenResponse.access_token,
		refreshToken: tokenResponse.refresh_token,
		expiresAt: Date.now() + tokenResponse.expires_in * 1000,
	};
	saveTokenCache(config, cache);
	return cache;
}

async function refreshTokenCache(
	config: Config,
	cache: SpotifyTokenCache,
): Promise<SpotifyTokenCache> {
	const tokenResponse = await got
		.post(TOKEN_URL, {
			form: {
				grant_type: "refresh_token",
				refresh_token: cache.refreshToken,
				client_id: config.spotifyClientId,
			},
		})
		.json<TokenResponse>();

	const updated: SpotifyTokenCache = {
		accessToken: tokenResponse.access_token,
		refreshToken: tokenResponse.refresh_token ?? cache.refreshToken,
		expiresAt: Date.now() + tokenResponse.expires_in * 1000,
	};
	saveTokenCache(config, updated);
	return updated;
}

const EXPIRY_SAFETY_MARGIN_MS = 60_000;

/**
 * Get a valid access token, refreshing the cached one if it's expired.
 * Runs the full interactive login flow if no cache exists yet.
 */
export async function getValidAccessToken(config: Config): Promise<string> {
	let cache = loadTokenCache(config);

	if (!cache) {
		cache = await runAuthFlow(config);
		return cache.accessToken;
	}

	if (Date.now() > cache.expiresAt - EXPIRY_SAFETY_MARGIN_MS) {
		cache = await refreshTokenCache(config, cache);
	}

	return cache.accessToken;
}
