/**
 * Spawn-only child entry. Loads Playwright and drives {@link runChildMain}.
 * @module @deepseek-ai/dsh-browser-playwright/src/worker
 */

/* v8 ignore file -- spawn-only glue; bootWorker and SessionEngine own the behavior */

import playwright from 'playwright-core'
import { bootWorker } from './boot.ts'
import type { PlaywrightLike } from './session-engine.ts'

void bootWorker(process.env, process, playwright as PlaywrightLike)
