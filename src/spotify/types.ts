export interface SpotifyTokenCache {
	accessToken: string;
	refreshToken: string;
	expiresAt: number; // epoch ms
}

export interface SpotifyTrack {
	id: string;
	name: string;
	artists: string[];
	album: string;
	durationMs: number;
	url: string;
}

export interface SpotifyPlaylist {
	id: string;
	name: string;
	tracks: SpotifyTrack[];
}
