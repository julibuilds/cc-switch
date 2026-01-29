/**
 * Zod schema for Claude Code settings.json validation
 * Based on official schema from cli/claude-code-settings.json
 */

import { z } from "zod";

/**
 * Environment variables schema for Claude Code settings
 * Only includes variables we care about for provider switching
 */
const EnvSchema = z
	.record(
		z.string().regex(/^[A-Z_][A-Z0-9_]*$/, "Invalid env variable name"),
		z.string(),
	)
	.optional()
	.describe("Environment variables to set for Claude Code sessions");

/**
 * Core Claude Code settings schema (minimal subset for our use case)
 * Uses looseObject to allow unknown properties without stripping them
 */
const ClaudeSettingsSchema = z.looseObject({
	$schema: z.string().optional(),
	env: EnvSchema,
});

/**
 * Z.ai provider configuration
 */
export const ZAI_CONFIG = {
	ANTHROPIC_BASE_URL: "https://api.z.ai/api/anthropic",
	API_TIMEOUT_MS: "3000000",
} as const;

/**
 * Provider configuration
 */
export type Provider = "official" | "zai";

/**
 * Parsed Claude Code settings
 */
export type ClaudeSettings = z.infer<typeof ClaudeSettingsSchema>;

/**
 * Provider switch result
 */
export type SwitchResult =
	| { success: true; provider: Provider; previous: Provider | null }
	| { success: false; error: string };

/**
 * Provider status
 */
export type ProviderStatus =
	| { enabled: true; provider: "zai" }
	| { enabled: false; provider: "official" }
	| { enabled: false; provider: null };

/**
 * Export the schema for use in validation
 */
export { ClaudeSettingsSchema };
