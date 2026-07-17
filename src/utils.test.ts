import { describe, expect, test } from "bun:test";
import { normalize, slugify } from "./utils.js";

describe("normalize", () => {
	test("lowercases and trims", () => {
		expect(normalize("  Let It Happen  ")).toBe("let it happen");
	});

	test("strips parenthetical remaster tags", () => {
		expect(normalize("Currents (2015 Remaster)")).toBe("currents");
	});

	test("strips bracketed suffixes", () => {
		expect(normalize("Song Title [Live]")).toBe("song title");
	});

	test("strips feat. credits", () => {
		expect(normalize("Song Title feat. Someone Else")).toBe("song title");
	});

	test("strips punctuation and collapses whitespace", () => {
		expect(normalize("Don't Stop, Believing!!")).toBe("dont stop believing");
	});
});

describe("slugify", () => {
	test("produces a hyphenated slug", () => {
		expect(slugify("My Old Playlist 2015")).toBe("my-old-playlist-2015");
	});

	test("strips punctuation", () => {
		expect(slugify("Rock & Roll!")).toBe("rock-roll");
	});
});
