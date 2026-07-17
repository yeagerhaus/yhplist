import pc from "picocolors";
import { loadConfig } from "../config.js";
import { runAuthFlow } from "../spotify/auth.js";

export async function authCommand(): Promise<void> {
	const config = loadConfig();
	console.log("Opening your browser to log in to Spotify...");
	await runAuthFlow(config);
	console.log(pc.green("Logged in — token cached for future syncs."));
}
