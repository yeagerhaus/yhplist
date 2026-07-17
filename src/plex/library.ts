import type { Got } from "got";
import type { Config } from "../config.js";
import type { PlexMusicSection, PlexTrack } from "./types.js";

const PAGE_SIZE = 500;

interface SectionsResponse {
	MediaContainer: {
		Directory: Array<{ key: string; title: string; type: string }>;
	};
}

interface TracksResponse {
	MediaContainer: {
		totalSize: number;
		Metadata?: Array<{
			ratingKey: string;
			title: string;
			grandparentTitle?: string;
			parentTitle?: string;
		}>;
	};
}

export async function listMusicSections(
	client: Got,
): Promise<PlexMusicSection[]> {
	const response = await client
		.get("library/sections")
		.json<SectionsResponse>();
	return response.MediaContainer.Directory.filter(
		(d) => d.type === "artist",
	).map((d) => ({ key: d.key, title: d.title }));
}

/**
 * Resolve which music library section to search/match against, using the
 * configured title/ID if set, or auto-detecting when there's exactly one.
 */
export async function resolveMusicSection(
	client: Got,
	config: Config,
): Promise<PlexMusicSection> {
	const sections = await listMusicSections(client);

	if (sections.length === 0) {
		throw new Error("No music library sections found on this Plex server");
	}

	if (config.plexMusicSection) {
		const match = sections.find(
			(s) =>
				s.key === config.plexMusicSection ||
				s.title.toLowerCase() === config.plexMusicSection?.toLowerCase(),
		);
		if (!match) {
			const available = sections
				.map((s) => `"${s.title}" (id ${s.key})`)
				.join(", ");
			throw new Error(
				`PLEX_MUSIC_SECTION "${config.plexMusicSection}" not found. Available: ${available}`,
			);
		}
		return match;
	}

	if (sections.length === 1) {
		return sections[0];
	}

	const available = sections
		.map((s) => `"${s.title}" (id ${s.key})`)
		.join(", ");
	throw new Error(
		`Multiple music library sections found. Set PLEX_MUSIC_SECTION or pass --section. Available: ${available}`,
	);
}

/**
 * Fetch every track in a music library section, once per run, to build an
 * in-memory index for fuzzy matching.
 */
export async function fetchLibraryTracks(
	client: Got,
	sectionKey: string,
): Promise<PlexTrack[]> {
	const tracks: PlexTrack[] = [];
	let start = 0;

	while (true) {
		const response = await client
			.get(`library/sections/${sectionKey}/all`, {
				searchParams: {
					type: 10, // track
					"X-Plex-Container-Start": start,
					"X-Plex-Container-Size": PAGE_SIZE,
				},
			})
			.json<TracksResponse>();

		const items = response.MediaContainer.Metadata ?? [];
		for (const item of items) {
			tracks.push({
				ratingKey: item.ratingKey,
				title: item.title,
				artist: item.grandparentTitle ?? "",
				album: item.parentTitle ?? "",
			});
		}

		start += items.length;
		if (
			items.length < PAGE_SIZE ||
			start >= response.MediaContainer.totalSize
		) {
			break;
		}
	}

	return tracks;
}
