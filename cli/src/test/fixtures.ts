/**
 * Test fixtures for settings tests
 * Provides mock data and test helpers
 */

import type { ClaudeSettings } from "../types.ts";

/**
 * Test auth token (fake, for testing only)
 */
export const TEST_AUTH_TOKEN = "test-token-1234567890abcdef";

/**
 * Minimal official settings (no custom provider)
 */
export const officialSettings: ClaudeSettings = {
	$respectGitignore: false,
	cleanupPeriodDays: 300,
	model: "opus",
};

/**
 * Z.ai enabled settings
 */
export const zaiEnabledSettings: ClaudeSettings = {
	...officialSettings,
	env: {
		ANTHROPIC_AUTH_TOKEN: TEST_AUTH_TOKEN,
		ANTHROPIC_BASE_URL: "https://api.z.ai/api/anthropic",
		API_TIMEOUT_MS: "3000000",
	},
};

/**
 * Custom provider settings (non-Z.ai)
 */
export const customProviderSettings: ClaudeSettings = {
	...officialSettings,
	env: {
		ANTHROPIC_AUTH_TOKEN: "custom-token",
		ANTHROPIC_BASE_URL: "https://custom.api.com",
	},
};

/**
 * Settings with mixed env vars (some Z.ai, some custom)
 */
export const mixedEnvSettings: ClaudeSettings = {
	...officialSettings,
	env: {
		ANTHROPIC_AUTH_TOKEN: TEST_AUTH_TOKEN,
		ANTHROPIC_BASE_URL: "https://api.z.ai/api/anthropic",
		API_TIMEOUT_MS: "3000000",
		MY_CUSTOM_VAR: "custom-value",
	},
};

/**
 * Empty settings (minimal valid JSON)
 */
export const emptySettings: ClaudeSettings = {};

/**
 * In-memory settings store for testing
 * Simulates file operations without touching disk
 */
export class MemorySettingsStore {
	private data: ClaudeSettings = emptySettings;

	async read(): Promise<ClaudeSettings> {
		return { ...this.data };
	}

	async write(settings: ClaudeSettings): Promise<void> {
		this.data = { ...settings };
	}

	async clear(): Promise<void> {
		this.data = emptySettings;
	}

	async set(settings: ClaudeSettings): Promise<void> {
		this.data = { ...settings };
	}

	get current(): ClaudeSettings {
		return { ...this.data };
	}
}

/**
 * Create a test settings ops object using a memory store
 */
export function createTestOps(store?: MemorySettingsStore) {
	const settingsStore = store ?? new MemorySettingsStore();
	let counter = 0;

	return {
		path: () => Promise.resolve(`/tmp/test-settings-${++counter}.json`),
		read: (_path: string) => settingsStore.read(),
		write: (_path: string, settings: ClaudeSettings) =>
			settingsStore.write(settings),
		store: settingsStore,
	};
}

/**
 * Create test ops from initial settings
 */
export function createTestOpsFrom(initialSettings: ClaudeSettings) {
	const store = new MemorySettingsStore();
	store.set(initialSettings);
	return createTestOps(store);
}
