import type { Got } from "got";
import type { PlexPlaylist } from "./types.js";

interface PlaylistsResponse {
	MediaContainer: {
		Metadata?: Array<{ ratingKey: string; title: string }>;
	};
}

interface PlaylistItemsResponse {
	MediaContainer: {
		Metadata?: Array<{ ratingKey: string }>;
	};
}

interface IdentityResponse {
	MediaContainer: { machineIdentifier: string };
}

let cachedMachineIdentifier: string | undefined;

async function getMachineIdentifier(client: Got): Promise<string> {
	if (cachedMachineIdentifier) {
		return cachedMachineIdentifier;
	}
	const response = await client.get("identity").json<IdentityResponse>();
	cachedMachineIdentifier = response.MediaContainer.machineIdentifier;
	return cachedMachineIdentifier;
}

function buildLibraryUri(
	machineIdentifier: string,
	ratingKeys: string[],
): string {
	const keys = ratingKeys.map((key) => `/library/metadata/${key}`).join(",");
	return `server://${machineIdentifier}/com.plexapp.plugins.library${keys}`;
}

/** Find an existing audio playlist by case-insensitive title match. */
export async function findPlaylistByName(
	client: Got,
	name: string,
): Promise<PlexPlaylist | undefined> {
	const response = await client
		.get("playlists", { searchParams: { type: 15 } })
		.json<PlaylistsResponse>();

	const match = (response.MediaContainer.Metadata ?? []).find(
		(p) => p.title.toLowerCase() === name.toLowerCase(),
	);
	return match ? { ratingKey: match.ratingKey, title: match.title } : undefined;
}

/** Rating keys of tracks already in a playlist, to avoid adding duplicates. */
export async function getPlaylistTrackKeys(
	client: Got,
	playlistRatingKey: string,
): Promise<Set<string>> {
	const response = await client
		.get(`playlists/${playlistRatingKey}/items`)
		.json<PlaylistItemsResponse>();
	return new Set(
		(response.MediaContainer.Metadata ?? []).map((m) => m.ratingKey),
	);
}

/**
 * Create a new audio playlist seeded with the given tracks.
 *
 * Plex's playlist creation endpoint reliably supports only a single seed
 * item in its `uri` param — passing many comma-joined items at once 500s on
 * some server versions (a known quirk python-plexapi and others work around
 * the same way). So we create with just the first track, then append the
 * rest via the add-items endpoint, which does support large item lists.
 */
export async function createPlaylist(
	client: Got,
	title: string,
	trackRatingKeys: string[],
): Promise<PlexPlaylist> {
	if (trackRatingKeys.length === 0) {
		throw new Error(
			`Cannot create playlist "${title}" with zero matched tracks`,
		);
	}

	const [seedKey, ...restKeys] = trackRatingKeys;
	const machineIdentifier = await getMachineIdentifier(client);
	const uri = buildLibraryUri(machineIdentifier, [seedKey]);

	const response = await client
		.post("playlists", {
			searchParams: { type: "music", title, smart: 0, uri },
		})
		.json<PlaylistsResponse>();

	const created = response.MediaContainer.Metadata?.[0];
	if (!created) {
		throw new Error(`Plex did not return the created playlist "${title}"`);
	}

	if (restKeys.length > 0) {
		await addTracksToPlaylist(client, created.ratingKey, restKeys);
	}

	return { ratingKey: created.ratingKey, title: created.title };
}

/** Append tracks to an existing playlist. Assumes callers already de-duped. */
export async function addTracksToPlaylist(
	client: Got,
	playlistRatingKey: string,
	trackRatingKeys: string[],
): Promise<void> {
	if (trackRatingKeys.length === 0) {
		return;
	}

	const machineIdentifier = await getMachineIdentifier(client);
	const uri = buildLibraryUri(machineIdentifier, trackRatingKeys);

	await client.put(`playlists/${playlistRatingKey}/items`, {
		searchParams: { uri },
	});
}
