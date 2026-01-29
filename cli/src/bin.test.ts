/**
 * Tests for CLI command functions
 * Tests the user-facing CLI behavior
 */

import { describe, expect, test } from "bun:test";
import { SettingsManager } from "./settings.ts";
import {
	createTestOpsFrom,
	customProviderSettings,
	officialSettings,
	TEST_AUTH_TOKEN,
	zaiEnabledSettings,
} from "./test/fixtures.ts";
import { ZAI_CONFIG } from "./types.ts";

describe("CLI Commands", () => {
	describe("printStatus", () => {
		test("displays official provider status", async () => {
			const ops = createTestOpsFrom(officialSettings);
			const localManager = new SettingsManager(ops);

			const status = await localManager.getStatus();
			expect(status.enabled).toBe(false);
			expect(status.provider).toBe("official");
		});

		test("displays zai provider status", async () => {
			const ops = createTestOpsFrom(zaiEnabledSettings);
			const localManager = new SettingsManager(ops);

			const status = await localManager.getStatus();
			expect(status.enabled).toBe(true);
			expect(status.provider).toBe("zai");
		});

		test("displays custom provider status", async () => {
			const ops = createTestOpsFrom(customProviderSettings);
			const localManager = new SettingsManager(ops);

			const status = await localManager.getStatus();
			expect(status.enabled).toBe(false);
			expect(status.provider).toBe(null);
		});
	});

	describe("enableProvider", () => {
		test("enables Z.ai provider", async () => {
			const ops = createTestOpsFrom(officialSettings);
			const testManager = new SettingsManager(ops);

			const result = await testManager.enableZai(TEST_AUTH_TOKEN);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.provider).toBe("zai");
			}
		});

		test("preserves existing env vars", async () => {
			const ops = createTestOpsFrom({
				...officialSettings,
				env: {
					MY_CUSTOM_VAR: "custom-value",
				},
			});
			const testManager = new SettingsManager(ops);

			await testManager.enableZai(TEST_AUTH_TOKEN);

			const settings = await ops.path().then(async (p) => ops.read(p));
			expect(settings.env?.MY_CUSTOM_VAR).toBe("custom-value");
		});
	});

	describe("disableProvider", () => {
		test("removes Z.ai configuration", async () => {
			const ops = createTestOpsFrom(zaiEnabledSettings);
			const testManager = new SettingsManager(ops);

			const result = await testManager.disableZai();

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.provider).toBe("official");
				expect(result.previous).toBe("zai");
			}

			const status = await testManager.getStatus();
			expect(status.enabled).toBe(false);
			expect(status.provider).toBe("official");
		});

		test("handles already disabled state", async () => {
			const ops = createTestOpsFrom(officialSettings);
			const testManager = new SettingsManager(ops);

			const result = await testManager.disableZai();

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.provider).toBe("official");
				expect(result.previous).toBe("official");
			}
		});
	});

	describe("toggle behavior", () => {
		test("enables when disabled", async () => {
			const ops = createTestOpsFrom(officialSettings);
			const testManager = new SettingsManager(ops);

			const result = await testManager.toggleProvider(TEST_AUTH_TOKEN);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.provider).toBe("zai");
			}

			const status = await testManager.getStatus();
			expect(status.enabled).toBe(true);
		});

		test("disables when enabled", async () => {
			const ops = createTestOpsFrom(zaiEnabledSettings);
			const testManager = new SettingsManager(ops);

			const result = await testManager.toggleProvider(TEST_AUTH_TOKEN);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.provider).toBe("official");
			}

			const status = await testManager.getStatus();
			expect(status.enabled).toBe(false);
		});
	});

	describe("env var configuration", () => {
		test("sets all required env vars", async () => {
			const ops = createTestOpsFrom(officialSettings);
			const testManager = new SettingsManager(ops);

			await testManager.enableZai(TEST_AUTH_TOKEN);

			const settings = await ops.path().then(async (p) => ops.read(p));
			const env = settings.env ?? {};

			expect(env.ANTHROPIC_AUTH_TOKEN).toBe(TEST_AUTH_TOKEN);
			expect(env.ANTHROPIC_BASE_URL).toBe(ZAI_CONFIG.ANTHROPIC_BASE_URL);
			expect(env.API_TIMEOUT_MS).toBe(ZAI_CONFIG.API_TIMEOUT_MS);
		});

		test("removes only Z.ai env vars, preserves others", async () => {
			const ops = createTestOpsFrom({
				...officialSettings,
				env: {
					ANTHROPIC_AUTH_TOKEN: TEST_AUTH_TOKEN,
					ANTHROPIC_BASE_URL: ZAI_CONFIG.ANTHROPIC_BASE_URL,
					API_TIMEOUT_MS: ZAI_CONFIG.API_TIMEOUT_MS,
					MY_CUSTOM_VAR: "keep-this",
				},
			});
			const testManager = new SettingsManager(ops);

			await testManager.disableZai();

			const settings = await ops.path().then(async (p) => ops.read(p));

			expect(settings.env?.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
			expect(settings.env?.ANTHROPIC_BASE_URL).toBeUndefined();
			expect(settings.env?.API_TIMEOUT_MS).toBeUndefined();
			expect(settings.env?.MY_CUSTOM_VAR).toBe("keep-this");
		});
	});
});
