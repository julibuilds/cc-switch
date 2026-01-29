# TODO

## Claude Code Provider Switch Utility

**Status: ✅ Complete**

From [z.ai](https://docs.z.ai/devpack/tool/claude#manual-configuration):

```json
# Edit the Claude Code configuration file `~/.claude/settings.json`
# Add or modify the env fields ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN

{
    "env": {
        "ANTHROPIC_AUTH_TOKEN": "your_zai_api_key",
        "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
        "API_TIMEOUT_MS": "3000000"
    }
}
```

The `ANTHROPIC_AUTH_TOKEN` variable has been added to the `cli/.env` file.

A copy of the official schema for Claude Code's `~/.claude/settings.json` file is at `cli/claude-code-settings.json`.

### Implementation

The CLI tool (`ccs`) is a compiled Bun executable that modifies `~/.claude/settings.json` by adding and removing the env snippet.

**Usage:**

```bash
ccs status      # Show current provider status
ccs enable      # Enable Z.ai provider
ccs disable     # Revert to official Anthropic provider
ccs toggle      # Toggle between providers
```

**Files:**
- `src/types.ts` - Zod schemas for settings validation
- `src/settings.ts` - SettingsManager class with dependency injection for testing
- `src/bin.ts` - CLI entry point with commands
- `src/test/fixtures.ts` - Test fixtures and in-memory store
- `src/settings.test.ts` - Settings operations tests (18 tests)
- `src/bin.test.ts` - CLI command tests (11 tests)
- `bin/ccs` - Compiled binary (~56MB includes Bun runtime)

**Build:**
```bash
bun run build
```

**Tests:**
```bash
bun test          # Run all tests (29 tests, all use in-memory fixtures)
bun test src/settings.test.ts  # Run specific test file
```

The binary is optimized for speed (Bun runtime), small size (minified compilation), and ease of use (simple one-command interface).

**Testing:**
- All tests use in-memory fixtures to avoid touching real `~/.claude/settings.json`
- `SettingsManager` class accepts injected `SettingsOps` for testability
- Tests cover: status detection, enable/disable, toggle, env var preservation
