import { describe, expect, test } from "bun:test";
import { parsePlaylistId } from "./client.js";

describe("parsePlaylistId", () => {
	test("parses a raw ID", () => {
		expect(parsePlaylistId("37i9dQZF1DXcBWIGoYBM5M")).toBe(
			"37i9dQZF1DXcBWIGoYBM5M",
		);
	});

	test("parses a spotify: URI", () => {
		expect(parsePlaylistId("spotify:playlist:37i9dQZF1DXcBWIGoYBM5M")).toBe(
			"37i9dQZF1DXcBWIGoYBM5M",
		);
	});

	test("parses an open.spotify.com URL", () => {
		expect(
			parsePlaylistId(
				"https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
			),
		).toBe("37i9dQZF1DXcBWIGoYBM5M");
	});

	test("parses an open.spotify.com URL with query params", () => {
		expect(
			parsePlaylistId(
				"https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123",
			),
		).toBe("37i9dQZF1DXcBWIGoYBM5M");
	});

	test("throws on unparseable input", () => {
		expect(() => parsePlaylistId("not a playlist!")).toThrow();
	});
});
