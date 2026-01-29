/**
 * Operations for reading and modifying Claude Code settings.json
 * Testable design with injectable settings path
 */

import { mkdir, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ClaudeSettings, ProviderStatus, SwitchResult } from "./types.ts";
import { ClaudeSettingsSchema, ZAI_CONFIG } from "./types.ts";

/**
 * Default settings path resolver
 * Uses the actual Claude Code settings location
 */
export async function defaultSettingsPath(): Promise<string> {
	const home = homedir();
	const claudeDir = join(home, ".claude");
	const settingsFile = join(claudeDir, "settings.json");

	// Ensure the directory exists
	await mkdir(claudeDir, { recursive: true });

	// Resolve to real path
	return realpath(settingsFile).catch(() => settingsFile);
}

/**
 * Settings file operations interface
 * Allows for test mocks with different file paths
 */
export interface SettingsOps {
	path: () => Promise<string>;
	read: (path: string) => Promise<ClaudeSettings>;
	write: (path: string, settings: ClaudeSettings) => Promise<void>;
}

/**
 * Default file operations using Bun.file API
 */
export const defaultFileOps: SettingsOps = {
	path: defaultSettingsPath,
	async read(path: string): Promise<ClaudeSettings> {
		const file = Bun.file(path);
		if (!(await file.exists())) {
			return { env: undefined };
		}
		try {
			const content = await file.text();
			const parsed = JSON.parse(content || "{}");
			return ClaudeSettingsSchema.parse(parsed);
		} catch (error) {
			console.error(
				`Failed to parse settings.json: ${(error as Error).message}`,
			);
			return { env: undefined };
		}
	},
	async write(path: string, settings: ClaudeSettings): Promise<void> {
		const content = `${JSON.stringify(settings, null, 2)}\n`;
		await Bun.write(path, content);
	},
};

/**
 * Settings manager class for dependency injection
 */
export class SettingsManager {
	constructor(private ops: SettingsOps = defaultFileOps) {}

	/**
	 * Get the current provider status
	 */
	async getStatus(): Promise<ProviderStatus> {
		const path = await this.ops.path();
		const settings = await this.ops.read(path);
		const env = settings.env || {};

		// Check if Z.ai provider is enabled
		const hasZaiBaseUrl =
			env.ANTHROPIC_BASE_URL === ZAI_CONFIG.ANTHROPIC_BASE_URL;
		const hasZaiToken = env.ANTHROPIC_AUTH_TOKEN !== undefined;

		if (hasZaiBaseUrl && hasZaiToken) {
			return { enabled: true, provider: "zai" };
		}

		// Check if any custom provider is set
		if (env.ANTHROPIC_BASE_URL || env.ANTHROPIC_AUTH_TOKEN) {
			return { enabled: false, provider: null };
		}

		return { enabled: false, provider: "official" };
	}

	/**
	 * Switch to the Z.ai provider
	 */
	async enableZai(authToken: string): Promise<SwitchResult> {
		const current = await this.getStatus();
		const path = await this.ops.path();
		const settings = await this.ops.read(path);

		settings.env = {
			...(settings.env || {}),
			ANTHROPIC_AUTH_TOKEN: authToken,
			ANTHROPIC_BASE_URL: ZAI_CONFIG.ANTHROPIC_BASE_URL,
			API_TIMEOUT_MS: ZAI_CONFIG.API_TIMEOUT_MS,
		};

		await this.ops.write(path, settings);

		return {
			success: true,
			provider: "zai",
			previous: current.provider === "zai" ? "zai" : current.provider,
		};
	}

	/**
	 * Switch to the official Anthropic provider (remove custom env)
	 */
	async disableZai(): Promise<SwitchResult> {
		const current = await this.getStatus();
		const path = await this.ops.path();
		const settings = await this.ops.read(path);

		if (!settings.env) {
			return {
				success: true,
				provider: "official",
				previous: current.provider,
			};
		}

		// Remove Z.ai specific env vars
		const {
			ANTHROPIC_AUTH_TOKEN,
			ANTHROPIC_BASE_URL,
			API_TIMEOUT_MS,
			...restEnv
		} = settings.env;

		settings.env = Object.keys(restEnv).length > 0 ? restEnv : undefined;

		await this.ops.write(path, settings);

		return {
			success: true,
			provider: "official",
			previous: current.provider,
		};
	}

	/**
	 * Toggle between providers
	 */
	async toggleProvider(authToken: string): Promise<SwitchResult> {
		const status = await this.getStatus();
		return status.enabled ? this.disableZai() : this.enableZai(authToken);
	}
}

/**
 * Default settings manager instance
 * Uses actual Claude Code settings location
 */
export const settingsManager = new SettingsManager();

// Convenience functions using default manager
export const getStatus = () => settingsManager.getStatus();
export const enableZai = (token: string) => settingsManager.enableZai(token);
export const disableZai = () => settingsManager.disableZai();
export const toggleProvider = (token: string) =>
	settingsManager.toggleProvider(token);
