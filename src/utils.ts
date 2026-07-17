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
