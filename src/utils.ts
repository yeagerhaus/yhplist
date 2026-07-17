import { HTTPError } from "got";

/**
 * Describe an error for CLI output, including the response body of an HTTP
 * failure (got swallows this into the status line by default) so API error
 * messages like "insufficient scope" are actually visible.
 */
export function describeError(error: unknown): string {
	if (error instanceof HTTPError) {
		const body = error.response.body;
		const bodyText = typeof body === "string" ? body : JSON.stringify(body);
		return `${error.message}\n${bodyText}`;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

/**
 * Normalize a track/artist/album string for fuzzy comparison:
 * lowercase, strip parenthetical/bracketed suffixes (remaster tags, "feat." credits),
 * strip punctuation, collapse whitespace.
 */
export function normalize(value: string): string {
	return value
		.toLowerCase()
		.replace(/\(.*?\)|\[.*?\]/g, " ")
		.replace(/feat\.?\s.+$/i, " ")
		.replace(/['’]/g, "")
		.replace(/[^\w\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^\w\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-");
}
