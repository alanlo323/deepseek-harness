# Browser Session

English | [中文](browser.zh.md)

Types for the headless Chromium Browser Session: the live occupancy on `ctx.browser`, the durable `tool/result` `meta` snapshot, the in-memory JPEG screencast frame, and the watch-only Host Remote request. Tool behavior lives on [`dsh-tool-browser`](../../packages/browser/tool-browser/README.md); the Playwright child lives on [`dsh-browser-playwright`](../../packages/browser/browser-playwright/README.md); the Host Remote lives on [`dsh-browser-host`](../../packages/browser/browser-host/README.md). The [browser viewport Agent Note](../../.agents/notes/implemented/feature/2026-09-03-browser-viewport-sidebar.md) owns why frames never enter the session log and why the Web column is not a conversation view.

Source: [`packages/browser/browser/src/types.ts`](../../packages/browser/browser/src/types.ts) and [`packages/browser/browser-host/src/types.ts`](../../packages/browser/browser-host/src/types.ts)

## Session snapshot

There is no new session event type. A successful browser tool result is a standard `tool/result` whose `meta.kind` is `browser-session`. JPEG frames never appear in that snapshot.

```ts type-equiv
/** Opaque identity of one live Browser Session; never a DSH Session id. */
type BrowserSessionId = Branded<'BrowserSessionId'>
```

```ts type-equiv
/** Lifecycle of the single v1 Browser Session. */
type BrowserSessionStatus = 'open' | 'closed'
```

```ts type-equiv
/**
 * Durable presentation snapshot on `tool/result` `meta` for browser tools.
 * Frames never appear here.
 */
interface BrowserSessionMeta {
  /** Discriminator stored in `tool/result` `meta`. */
  readonly kind: 'browser-session'
  /** Live Browser Session identity. */
  readonly browserSessionId: string
  /** Owning DSH Session identity. */
  readonly dshSessionId: string
  /** Open after `browser_open`; closed after `browser_close`. */
  readonly status: BrowserSessionStatus
}
```

```ts type-equiv
/** Client-visible Browser Session snapshot. Frames never appear here. */
interface BrowserSessionView {
  readonly browserSessionId: string
  readonly dshSessionId: string
  readonly status: BrowserSessionStatus
}
```

## Screencast

Frames are JSON items on the existing Remote mux. The runtime keeps a ring of one pending frame per subscriber.

```ts type-equiv
/** One JPEG screencast frame. JSON-only: never a raw byte array. */
interface ScreencastFrame {
  /** Browser Session that produced the frame. */
  readonly browserSessionId: string
  /** DSH Session the preview is bound to. */
  readonly dshSessionId: string
  /** Image MIME type. v1 is always JPEG. */
  readonly mime: 'image/jpeg'
  /** JPEG bytes as unpadded-or-padded base64. */
  readonly dataBase64: string
  /** Host milliseconds since epoch when the frame was accepted. */
  readonly timestamp: number
}
```

```ts type-equiv
/** Live JPEG screencast subscription. */
interface ScreencastRequest {
  /** DSH Session that owns the preview. */
  readonly sessionId: SessionId
  /** Live Browser Session identity. */
  readonly browserSessionId: string
}
```

## Provider

```ts type-equiv
/**
 * One Browser Session backend. Registered with `ctx.browser.registerProvider`.
 * Isolation of the engine process is not a security boundary.
 */
interface BrowserProvider {
  /** Stable registry id, unique among browser providers. */
  readonly id: string
  /**
   * Launch the engine. Honor `signal`. Failure must throw; the seam then
   * stays closed so a later `open` may retry.
   * @param signal - cooperative cancellation for launch.
   */
  open(signal: AbortSignal): Promise<void>
  /**
   * Run one script against the open session's shared context and page.
   * @param script - Playwright script body (`page`, `browser`, `context`, `playwright` in scope).
   * @param signal - cooperative cancellation for this run only.
   * @returns JSON-serializable script result.
   */
  run(script: string, signal: AbortSignal): Promise<JsonValue>
  /**
   * Tear down the engine. Must return after the child is killed even when the
   * close RPC fails, so a later `open` may retry.
   * @returns nothing; the provider occupancy is cleared.
   */
  close(): Promise<void>
  /**
   * Subscribe to screencast JPEG frames. The runtime keeps a ring of one
   * pending frame per subscriber.
   * @param onFrame - latest-frame callback.
   * @returns disposer.
   */
  subscribeFrames(onFrame: (frame: ScreencastFrameInput) => void): () => void
  /**
   * Subscribe to engine teardown that was not completed through a still-open
   * `close()` waiter. Unexpected child exit must notify so occupancy can clear.
   * @param onDropped - occupancy is gone.
   * @returns disposer.
   */
  subscribeDropped(onDropped: () => void): () => void
}
```

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxbrowser--browserruntime"></a>

### `ctx.browser` — `BrowserRuntime`

The Browser Session service. Registered as `ctx.browser` (one instance per context).

```ts cordis-catalog
/**
 * Register a Browser Session provider. Duplicate ids throw.
 * @param provider - backend that owns Chromium lifecycle.
 * @returns disposer that unregisters the provider.
 */
registerProvider(provider: BrowserProvider): () => void

/**
 * Open the single v1 Browser Session.
 * @param signal - cooperative cancellation for launch.
 * @returns the new Browser Session id.
 */
async open(signal: AbortSignal): Promise<BrowserSessionId>

/**
 * Run a script against the open session's shared page.
 * @param script - Playwright script body.
 * @param signal - cooperative cancellation for this run.
 * @returns JSON-serializable script result.
 */
async run(script: string, signal: AbortSignal): Promise<JsonValue>

/**
 * Close the open Browser Session. Occupancy stays until provider teardown
 * finishes; a failed teardown still clears occupancy so `open` may retry.
 * @returns the closed Browser Session id.
 */
async close(): Promise<BrowserSessionId>

/**
 * Identity of the open Browser Session, or `undefined` when closed.
 * @returns the live id, or `undefined`.
 */
currentSessionId(): BrowserSessionId | undefined

/**
 * Subscribe to screencast JPEG frames for one Browser Session. The queue
 * holds at most one pending frame; a slow consumer drops older frames.
 * @param browserSessionId - must match the open session.
 * @param dshSessionId - stamped onto every yielded frame.
 * @param signal - ends the iterator when aborted.
 * @returns async iterable of JSON screencast items.
 */
subscribeScreencast( browserSessionId: string, dshSessionId: string, signal: AbortSignal, ): AsyncIterable<ScreencastFrame>
```

Source: [`packages/browser/browser/src/index.ts`](../../packages/browser/browser/src/index.ts)

<a id="ctxbrowserhost--browserhost"></a>

### `ctx.browserHost` — `BrowserHost`

Host service backing `ctx.remote.browser`.

```ts cordis-catalog
/**
 * Stream JPEG screencast frames for one Browser Session.
 * Watch-only: this Remote never sends CDP Input commands.
 * @param request - DSH Session and Browser Session identities.
 * @param signal - cancellation owned by the Remote stream carrier.
 * @returns JSON screencast items.
 */
@Remote({ mode: 'stream' }) screencast(request: ScreencastRequest, signal: AbortSignal): AsyncIterable<ScreencastFrame>
```

Source: [`packages/browser/browser-host/src/index.ts`](../../packages/browser/browser-host/src/index.ts)
<!-- END GENERATED cordis-surface -->
