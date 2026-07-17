import { loadConfig } from "../config.js";
import { logSyncComplete } from "../sync/logger.js";
import { syncPlaylist } from "../sync/sync.js";

export interface SyncCommandOpts {
	name?: string;
	section?: string;
	threshold?: string;
	dryRun?: boolean;
}

export async function syncCommand(
	playlistIdOrUrl: string,
	opts: SyncCommandOpts,
): Promise<void> {
	const config = loadConfig();

	const result = await syncPlaylist(config, {
		playlistIdOrUrl,
		nameOverride: opts.name,
		sectionOverride: opts.section,
		thresholdOverride: opts.threshold
			? Number.parseInt(opts.threshold, 10)
			: undefined,
		dryRun: opts.dryRun ?? false,
	});

	logSyncComplete(result);
}
