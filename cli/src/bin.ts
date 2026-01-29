/**
 * CLI entry point for cc-swtch (ccs)
 * Claude Code Provider Switch Utility
 */

import { disableZai, enableZai, getStatus } from "./settings.ts";
import { ZAI_CONFIG } from "./types.ts";

/**
 * CLI commands
 */
const COMMANDS = ["enable", "disable", "status", "toggle"] as const;
type Command = (typeof COMMANDS)[number];

/**
 * ANSI color codes for terminal output
 */
const colors = {
	reset: "\x1b[0m",
	green: "\x1b[32m",
	red: "\x1b[31m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	dim: "\x1b[2m",
};

/**
 * Print colored output
 */
function colorize(text: string, color: keyof typeof colors): string {
	return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Print usage information
 */
function printUsage() {
	console.log(`
Claude Code Provider Switch Utility

Usage:
  ccs <command>

Commands:
  ${colorize("enable", "green")}     Enable Z.ai provider (requires ANTHROPIC_AUTH_TOKEN in .env)
  ${colorize("disable", "yellow")}    Disable Z.ai provider (revert to official Anthropic)
  ${colorize("status", "blue")}      Show current provider status
  ${colorize("toggle", "dim")}       Toggle between providers

Examples:
  ccs status      # Check current provider
  ccs enable      # Switch to Z.ai provider
  ccs disable     # Switch back to official Anthropic
  ccs toggle      # Toggle between providers

Environment:
  The tool reads ANTHROPIC_AUTH_TOKEN from cli/.env for Z.ai authentication.
`);
}

/**
 * Get the Z.ai auth token from .env file
 * Searches multiple locations for the .env file
 */
async function getAuthToken(): Promise<string | null> {
	// Resolve the directory containing the binary
	const binaryDir = process.execPath
		? (() => {
				const execPath = process.execPath;
				// If this is a compiled binary, get its directory
				const dir = execPath.substring(0, execPath.lastIndexOf("/"));
				// The .env should be in the parent directory (cli/)
				return `${dir}/../.env`;
			})()
		: null;

	// Potential locations for .env file
	const searchPaths = [
		// Relative to binary location (for compiled builds)
		binaryDir,
		// Relative to current working directory
		".env",
		// In the cli directory (if running from project root)
		"cli/.env",
	].filter((path): path is string => path !== null);

	for (const path of searchPaths) {
		try {
			const envFile = Bun.file(path);
			if (await envFile.exists()) {
				const content = await envFile.text();
				const match = content.match(
					/ANTHROPIC_AUTH_TOKEN\s*=\s*["']?([^"'\n]+)["']?/,
				);
				const token = match?.[1]?.trim();
				if (token) {
					return token;
				}
			}
		} catch {
			// Continue to next path
		}
	}

	return null;
}

/**
 * Print the current provider status
 */
async function printStatus(): Promise<number> {
	const status = await getStatus();

	console.log(colorize("Claude Code Provider Status", "blue"));
	console.log("─".repeat(30));

	if (status.enabled && status.provider === "zai") {
		console.log(`  Provider: ${colorize("Z.ai", "green")}`);
		console.log(`  Status:   ${colorize("Enabled", "green")}`);
		console.log(
			`  Base URL: ${colorize(ZAI_CONFIG.ANTHROPIC_BASE_URL, "dim")}`,
		);
	} else if (status.provider === "official") {
		console.log(`  Provider: ${colorize("Official Anthropic", "blue")}`);
		console.log(`  Status:   ${colorize("Default", "dim")}`);
	} else {
		console.log(`  Provider: ${colorize("Custom/Unknown", "yellow")}`);
		console.log(
			`  Status:   ${colorize("Not managed by this tool", "yellow")}`,
		);
	}

	return 0;
}

/**
 * Enable Z.ai provider
 */
async function enableProvider(): Promise<number> {
	const token = await getAuthToken();

	if (!token) {
		console.error(
			colorize("Error: ANTHROPIC_AUTH_TOKEN not found in .env file", "red"),
		);
		console.error(colorize("Please add your Z.ai API key to cli/.env", "dim"));
		return 1;
	}

	const result = await enableZai(token);

	if (result.success) {
		console.log(colorize("✓ Z.ai provider enabled", "green"));
		console.log(
			colorize(`  Base URL: ${ZAI_CONFIG.ANTHROPIC_BASE_URL}`, "dim"),
		);
		return 0;
	}

	console.error(
		colorize(
			`Error: ${result.success === false ? result.error : "Unknown error"}`,
			"red",
		),
	);
	return 1;
}

/**
 * Disable Z.ai provider
 */
async function disableProvider(): Promise<number> {
	const result = await disableZai();

	if (result.success) {
		console.log(colorize("✓ Z.ai provider disabled", "yellow"));
		console.log(colorize("  Reverted to official Anthropic provider", "dim"));
		return 0;
	}

	console.error(
		colorize(
			`Error: ${result.success === false ? result.error : "Unknown error"}`,
			"red",
		),
	);
	return 1;
}

/**
 * Toggle between providers
 */
async function toggleProvider(): Promise<number> {
	const token = await getAuthToken();

	if (!token) {
		console.error(
			colorize("Error: ANTHROPIC_AUTH_TOKEN not found in .env file", "red"),
		);
		console.error(
			colorize("Cannot enable Z.ai provider without API key", "dim"),
		);
		// Still allow disabling even without token
	}

	const status = await getStatus();

	if (status.enabled) {
		return await disableProvider();
	} else {
		if (!token) {
			return 1;
		}
		return await enableProvider();
	}
}

/**
 * Main CLI entry point
 */
async function main(): Promise<number> {
	const args = process.argv.slice(2);

	if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
		printUsage();
		return 0;
	}

	const [command] = args;

	if (!COMMANDS.includes(command as Command)) {
		console.error(colorize(`Unknown command: ${command}`, "red"));
		console.error("");
		printUsage();
		return 1;
	}

	switch (command as Command) {
		case "status":
			return await printStatus();
		case "enable":
			return await enableProvider();
		case "disable":
			return await disableProvider();
		case "toggle":
			return await toggleProvider();
		default:
			return 1;
	}
}

// Run the CLI
main()
	.then((exitCode) => {
		process.exit(exitCode);
	})
	.catch((error) => {
		console.error(colorize(`Fatal error: ${error.message}`, "red"));
		process.exit(1);
	});
