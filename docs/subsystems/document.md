# Submitted documents

English | [中文](document.zh.md)

Types for a successful `present_document` call: the replay snapshot stored on `tool/result` `meta`, the host projection record, and the live-read Remote. Tool behavior lives on [`dsh-tool-present-document`](../../packages/document/tool-present-document/README.md); containment reads live on [`dsh-document-core`](../../packages/document/document-core/README.md); the Host Remote and image Fetch live on [`dsh-document-host`](../../packages/document/document-host/README.md). The [submitted-document Agent Note](../../.agents/notes/implemented/feature/2026-08-28-submitted-document-view.md) owns why the tool is the product and why the Report tab stays hidden until success.

Source: [`packages/document/document-core/src/types.ts`](../../packages/document/document-core/src/types.ts) and [`packages/document/document-host/src/types.ts`](../../packages/document/document-host/src/types.ts)

## Snapshot and projection

There is no new session event type. A successful present is a standard `tool/result` whose `meta.kind` is `submitted-document`. Absolute host paths never appear in the snapshot. The projection remembers call identity and image refs; the Markdown body stays on `meta` or is re-read live.

```ts type-equiv
/** Discriminator stored in `tool/result` `meta` for a successful present. */
type SubmittedDocumentKind = 'submitted-document'
```

```ts type-equiv
/** One workspace-relative image referenced from a submitted Markdown file. */
interface SubmittedDocumentImage {
  /** Workspace-relative POSIX logical path; never an absolute host path. */
  readonly ref: string
  /** MIME type derived from the file extension. */
  readonly mediaType: string
}
```

```ts type-equiv
/**
 * Durable presentation snapshot for one successful `present_document` call.
 * Absolute host paths and display spellings are forbidden here.
 */
interface SubmittedDocumentMeta {
  /** Discriminator stored in `tool/result` `meta`. */
  readonly kind: SubmittedDocumentKind
  /** Human title shown in the document view and tool card. */
  readonly title: string
  /** Workspace-relative POSIX path of the Markdown file. */
  readonly logicalPath: string
  /** UTF-8 byte length of the file at submit time. */
  readonly byteLength: number
  /**
   * Markdown source captured at submit time. Omitted when the serialized
   * snapshot would exceed the configured byte cap.
   */
  readonly content?: string
  /** Workspace-relative images extracted from the Markdown at submit time. */
  readonly images: readonly SubmittedDocumentImage[]
  /** True when `content` (and possibly trailing images) were dropped to honor the byte cap. */
  readonly truncated: boolean
}
```

```ts type-equiv
/** Model-facing success value; never includes the Markdown body. */
interface PresentDocumentValue {
  /** Fixed success tag. */
  readonly status: 'presented'
  /** Human title shown in the Report view and tool card. */
  readonly title: string
  /** Workspace-relative POSIX path of the Markdown file. */
  readonly logicalPath: string
  /** UTF-8 byte length of the file at submit time. */
  readonly byteLength: number
}
```

```ts type-equiv
/** One submitted document remembered by the host projection (no Markdown body). */
interface SubmittedDocumentRecord {
  /** Tool-call identity of the successful present. */
  readonly callId: string
  /** Session-log seq of the successful `tool/result`. */
  readonly seq: number
  /** Human title shown in the Report view. */
  readonly title: string
  /** Workspace-relative POSIX path of the Markdown file. */
  readonly logicalPath: string
  /** Workspace-relative images extracted at submit time. */
  readonly images: readonly SubmittedDocumentImage[]
}
```

The execute confirmation also carries an opaque `snapshotId` so `presentationMeta` can recover the snapshot after the value is JSON-cloned. That handle is not a field of `PresentDocumentValue` and is not a durable document identity.

## Live read

`submittedDocument.read` prefers a fresh contained workspace read and falls back to `meta.content` when the file is gone or unreadable. A missing session `cwd` fails closed unless the submit-time body is present. Image Fetch is a separate authenticated `/api/submitted-document-image` route; it never returns Markdown.

```ts type-equiv
/** Live Markdown read for one successful present_document call. */
interface ReadSubmittedDocumentRequest {
  /** Session that owns the successful present. */
  readonly sessionId: SessionId
  /** Tool-call identity of that present. */
  readonly documentCallId: string
}
```

```ts type-equiv
/** Markdown currently on disk, or the submit-time snapshot when the file is gone. */
interface ReadSubmittedDocumentValue {
  /** Human title shown in the Report view. */
  readonly title: string
  /** Workspace-relative POSIX path of the Markdown file. */
  readonly logicalPath: string
  /** Markdown to render. */
  readonly markdown: string
  /** Live is a fresh workspace read; snapshot is the submit-time body. */
  readonly source: 'live' | 'snapshot'
  /** Workspace-relative images named by this document. */
  readonly images: readonly SubmittedDocumentImage[]
}
```

```ts type-equiv
/** Why a live Markdown read did not yield a document. */
type ReadSubmittedDocumentFailureCode =
  | 'session-not-found'
  | 'document-not-found'
  | 'missing-cwd'
  | 'unreadable'
```

```ts type-equiv
/** Business failure for one live Markdown read. */
interface ReadSubmittedDocumentFailure {
  /** Stable failure identity. */
  readonly code: ReadSubmittedDocumentFailureCode
}
```

```ts type-equiv
/** Success or business failure of `submittedDocument.read`. */
type ReadSubmittedDocumentResult =
  | { readonly ok: true; readonly value: ReadSubmittedDocumentValue }
  | { readonly ok: false; readonly error: ReadSubmittedDocumentFailure }
```

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxdocumenthost--documenthost"></a>

### `ctx.documentHost` — `DocumentHost`

Host service backing `ctx.remote.submittedDocument`.

```ts cordis-catalog
/**
 * Read the Markdown for one successful present_document call.
 * Prefers a fresh contained workspace read; falls back to the submit-time snapshot.
 * @param request - session and tool-call identity.
 * @returns live or snapshot Markdown, or a business failure.
 */
@Remote('read') async read(request: ReadSubmittedDocumentRequest): Promise<ReadSubmittedDocumentResult>
```

Source: [`packages/document/document-host/src/index.ts`](../../packages/document/document-host/src/index.ts)
<!-- END GENERATED cordis-surface -->
