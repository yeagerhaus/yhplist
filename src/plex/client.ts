import got, { type Got } from "got";
import type { Config } from "../config.js";

const CLIENT_IDENTIFIER = "yhplist";

/**
 * Thin HTTP wrapper over the Plex Media Server API. Plex returns XML by
 * default, so every request asks for JSON via the Accept header.
 */
export function createPlexClient(config: Config): Got {
	return got.extend({
		prefixUrl: config.plexUrl,
		headers: {
			Accept: "application/json",
			"X-Plex-Token": config.plexToken,
			"X-Plex-Client-Identifier": CLIENT_IDENTIFIER,
			"X-Plex-Product": "yhplist",
		},
	});
}
