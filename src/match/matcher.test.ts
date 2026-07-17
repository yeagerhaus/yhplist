import { describe, expect, test } from "bun:test";
import type { PlexTrack } from "../plex/types.js";
import type { SpotifyTrack } from "../spotify/types.js";
import { buildPlexIndex, matchTrack } from "./matcher.js";

const library: PlexTrack[] = [
	{
		ratingKey: "1",
		title: "Let It Happen",
		artist: "Tame Impala",
		album: "Currents",
	},
	{
		ratingKey: "2",
		title: "The Less I Know The Better",
		artist: "Tame Impala",
		album: "Currents",
	},
	{
		ratingKey: "3",
		title: "Feels Like We Only Go Backwards",
		artist: "Tame Impala",
		album: "Lonerism",
	},
];

function spotifyTrack(overrides: Partial<SpotifyTrack> = {}): SpotifyTrack {
	return {
		id: "abc",
		name: "Let It Happen",
		artists: ["Tame Impala"],
		album: "Currents",
		durationMs: 470000,
		url: "https://open.spotify.com/track/abc",
		...overrides,
	};
}

describe("matchTrack", () => {
	test("matches an exact title/artist pair", () => {
		const index = buildPlexIndex(library);
		const result = matchTrack(spotifyTrack(), index, 85);
		expect(result.status).toBe("matched");
		expect(result.plexTrack?.ratingKey).toBe("1");
	});

	test("matches despite a remaster suffix", () => {
		const index = buildPlexIndex(library);
		const result = matchTrack(
			spotifyTrack({ name: "Let It Happen (2022 Remaster)" }),
			index,
			85,
		);
		expect(result.status).toBe("matched");
		expect(result.plexTrack?.ratingKey).toBe("1");
	});

	test("reports missing when nothing clears the threshold", () => {
		const index = buildPlexIndex(library);
		const result = matchTrack(
			spotifyTrack({
				name: "Some Completely Different Song",
				artists: ["Unrelated Artist"],
			}),
			index,
			85,
		);
		expect(result.status).toBe("missing");
	});

	test("reports missing on an empty library", () => {
		const index = buildPlexIndex([]);
		const result = matchTrack(spotifyTrack(), index, 85);
		expect(result.status).toBe("missing");
		expect(result.plexTrack).toBeUndefined();
	});
});
