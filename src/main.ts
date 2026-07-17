#!/usr/bin/env node

import { Command } from "commander";
import pc from "picocolors";
import pkg from "../package.json" with { type: "json" };
import { authCommand } from "./cli/auth.js";
import type { SyncCommandOpts } from "./cli/sync.js";
import { syncCommand } from "./cli/sync.js";

const program = new Command();

program
	.name("yhplist")
	.description("Convert specific Spotify playlists into Plex playlists")
	.version(pkg.version);

program
	.command("auth")
	.description("Log in to Spotify (opens your browser)")
	.action(() => {
		authCommand().catch((e) => {
			console.error(pc.red("Error:"), e.message);
			process.exit(1);
		});
	});

program
	.command("sync")
	.alias("s")
	.description("Convert one Spotify playlist into a matching Plex playlist")
	.argument("<playlist>", "Spotify playlist URL, URI, or ID")
	.option(
		"--name <name>",
		"Override the target Plex playlist name (default: Spotify playlist name)",
	)
	.option("--section <title|id>", "Plex music library section to match against")
	.option("--threshold <0-100>", "Fuzzy match similarity threshold")
	.option("--dry-run", "Match and log only — don't write anything to Plex")
	.action((playlist: string, opts: SyncCommandOpts) => {
		syncCommand(playlist, opts).catch((e) => {
			console.error(pc.red("Error:"), e.message);
			process.exit(1);
		});
	});

program.parse();
