/**
 * Tests for settings operations
 * Uses in-memory fixtures to avoid touching real settings
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { SettingsManager, type SettingsOps } from "./settings.ts";
import {
	createTestOpsFrom,
	customProviderSettings,
	emptySettings,
	mixedEnvSettings,
	officialSettings,
	TEST_AUTH_TOKEN,
	zaiEnabledSettings,
} from "./test/fixtures.ts";
import { ZAI_CONFIG } from "./types.ts";

describe("SettingsManager", () => {
	let ops: SettingsOps;
	let manager: SettingsManager;

	beforeEach(() => {
		// Fresh ops and manager for each test
		ops = createTestOpsFrom(emptySettings);
		manager = new SettingsManager(ops);
	});

	describe("getStatus", () => {
		test("returns official when no env vars exist", async () => {
			ops = createTestOpsFrom(officialSettings);
			manager = new SettingsManager(ops);

			const status = await manager.getStatus();

			expect(status.enabled).toBe(false);
			expect(status.provider).toBe("official");
		});

		test("returns zai when Z.ai env vars are set", async () => {
			ops = createTestOpsFrom(zaiEnabledSettings);
			manager = new SettingsManager(ops);

			const status = await manager.getStatus();

			expect(status.enabled).toBe(true);
			expect(status.provider).toBe("zai");
		});

		test("returns null when custom provider is set", async () => {
			ops = createTestOpsFrom(customProviderSettings);
			manager = new SettingsManager(ops);

			const status = await manager.getStatus();

			expect(status.enabled).toBe(false);
			expect(status.provider).toBe(null);
		});

		test("returns zai when Z.ai base URL matches", async () => {
			ops = createTestOpsFrom({
				...officialSettings,
				env: {
					ANTHROPIC_AUTH_TOKEN: TEST_AUTH_TOKEN,
					ANTHROPIC_BASE_URL: ZAI_CONFIG.ANTHROPIC_BASE_URL,
				},
			});
			manager = new SettingsManager(ops);

			const status = await manager.getStatus();

			expect(status.enabled).toBe(true);
			expect(status.provider).toBe("zai");
		});

		test("returns null when base URL doesn't match Z.ai", async () => {
			ops = createTestOpsFrom({
				...officialSettings,
				env: {
					ANTHROPIC_AUTH_TOKEN: TEST_AUTH_TOKEN,
					ANTHROPIC_BASE_URL: "https://other.api.com",
				},
			});
			manager = new SettingsManager(ops);

			const status = await manager.getStatus();

			expect(status.enabled).toBe(false);
			expect(status.provider).toBe(null);
		});

		test("returns null when only auth token is set", async () => {
			ops = createTestOpsFrom({
				...officialSettings,
				env: {
					ANTHROPIC_AUTH_TOKEN: TEST_AUTH_TOKEN,
				},
			});
			manager = new SettingsManager(ops);

			const status = await manager.getStatus();

			expect(status.enabled).toBe(false);
			expect(status.provider).toBe(null);
		});

		test("returns null when only base URL is set", async () => {
			ops = createTestOpsFrom({
				...officialSettings,
				env: {
					ANTHROPIC_BASE_URL: ZAI_CONFIG.ANTHROPIC_BASE_URL,
				},
			});
			manager = new SettingsManager(ops);

			const status = await manager.getStatus();

			expect(status.enabled).toBe(false);
			expect(status.provider).toBe(null);
		});
	});

	describe("enableZai", () => {
		test("adds Z.ai env vars to empty settings", async () => {
			const result = await manager.enableZai(TEST_AUTH_TOKEN);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.provider).toBe("zai");
				expect(result.previous).toBe("official");
			}

			// Verify the settings were updated
			const status = await manager.getStatus();
			expect(status.enabled).toBe(true);
			expect(status.provider).toBe("zai");
		});

		test("preserves existing env vars when enabling Z.ai", async () => {
			ops = createTestOpsFrom({
				...officialSettings,
				env: {
					MY_CUSTOM_VAR: "custom-value",
				},
			});
			manager = new SettingsManager(ops);

			await manager.enableZai(TEST_AUTH_TOKEN);

			const status = await manager.getStatus();
			expect(status.enabled).toBe(true);

			// Check that custom var is preserved
			const currentSettings = await ops.path().then(async (p) => ops.read(p));
			expect(currentSettings.env?.MY_CUSTOM_VAR).toBe("custom-value");
		});

		test("overwrites existing Z.ai env vars", async () => {
			ops = createTestOpsFrom(zaiEnabledSettings);
			manager = new SettingsManager(ops);

			const newToken = "new-token-123";
			const result = await manager.enableZai(newToken);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.provider).toBe("zai");
				expect(result.previous).toBe("zai");
			}

			const currentSettings = await ops.path().then(async (p) => ops.read(p));
			expect(currentSettings.env?.ANTHROPIC_AUTH_TOKEN).toBe(newToken);
		});

		test("sets all required Z.ai env vars", async () => {
			await manager.enableZai(TEST_AUTH_TOKEN);

			const currentSettings = await ops.path().then(async (p) => ops.read(p));
			const env = currentSettings.env ?? {};

			expect(env.ANTHROPIC_AUTH_TOKEN).toBe(TEST_AUTH_TOKEN);
			expect(env.ANTHROPIC_BASE_URL).toBe(ZAI_CONFIG.ANTHROPIC_BASE_URL);
			expect(env.API_TIMEOUT_MS).toBe(ZAI_CONFIG.API_TIMEOUT_MS);
		});
	});

	describe("disableZai", () => {
		test("removes Z.ai env vars when enabled", async () => {
			ops = createTestOpsFrom(zaiEnabledSettings);
			manager = new SettingsManager(ops);

			const result = await manager.disableZai();

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.provider).toBe("official");
				expect(result.previous).toBe("zai");
			}

			const status = await manager.getStatus();
			expect(status.enabled).toBe(false);
			expect(status.provider).toBe("official");
		});

		test("preserves other env vars when disabling Z.ai", async () => {
			ops = createTestOpsFrom(mixedEnvSettings);
			manager = new SettingsManager(ops);

			await manager.disableZai();

			const currentSettings = await ops.path().then(async (p) => ops.read(p));
			expect(currentSettings.env?.MY_CUSTOM_VAR).toBe("custom-value");
			expect(currentSettings.env?.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
			expect(currentSettings.env?.ANTHROPIC_BASE_URL).toBeUndefined();
		});

		test("removes env key entirely when no other vars exist", async () => {
			ops = createTestOpsFrom(zaiEnabledSettings);
			manager = new SettingsManager(ops);

			await manager.disableZai();

			const currentSettings = await ops.path().then(async (p) => ops.read(p));
			expect(currentSettings.env).toBeUndefined();
		});

		test("handles already disabled state", async () => {
			const result = await manager.disableZai();

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.provider).toBe("official");
				expect(result.previous).toBe("official");
			}
		});

		test("handles settings with no env property", async () => {
			ops = createTestOpsFrom(emptySettings);
			manager = new SettingsManager(ops);

			const result = await manager.disableZai();

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.provider).toBe("official");
			}
		});
	});

	describe("toggleProvider", () => {
		test("enables Z.ai when currently disabled", async () => {
			const result = await manager.toggleProvider(TEST_AUTH_TOKEN);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.provider).toBe("zai");
			}

			const status = await manager.getStatus();
			expect(status.enabled).toBe(true);
		});

		test("disables Z.ai when currently enabled", async () => {
			ops = createTestOpsFrom(zaiEnabledSettings);
			manager = new SettingsManager(ops);

			const result = await manager.toggleProvider(TEST_AUTH_TOKEN);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.provider).toBe("official");
			}

			const status = await manager.getStatus();
			expect(status.enabled).toBe(false);
		});
	});
});
