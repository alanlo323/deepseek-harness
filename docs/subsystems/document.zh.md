# 已提交文档

[English](document.md) | 中文

一次成功 `present_document` 调用的类型：存放在 `tool/result` `meta` 上的回放快照、宿主投影记录，以及实时读取 Remote。工具行为见 [`dsh-tool-present-document`](../../packages/document/tool-present-document/README.zh.md)；包含性读取见 [`dsh-document-core`](../../packages/document/document-core/README.zh.md)；Host Remote 与图片 Fetch 见 [`dsh-document-host`](../../packages/document/document-host/README.zh.md)。[已提交文档 Agent Note](../../.agents/notes/implemented/feature/2026-08-28-submitted-document-view.zh.md) 说明为何工具即产品，以及报告标签页为何在成功之前保持隐藏。

源码：[`packages/document/document-core/src/types.ts`](../../packages/document/document-core/src/types.ts) 与 [`packages/document/document-host/src/types.ts`](../../packages/document/document-host/src/types.ts)

## 快照与投影

没有新的会话事件类型。成功的 present 是标准 `tool/result`，其 `meta.kind` 为 `submitted-document`。绝对宿主路径从不出现在快照中。投影记住调用身份与图片引用；Markdown 正文留在 `meta` 上，或实时重读。

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

execute 确认还携带不透明的 `snapshotId`，以便 `presentationMeta` 在值被 JSON 克隆后取回快照。该句柄不是 `PresentDocumentValue` 的字段，也不是持久的文档身份。

## 实时读取

`submittedDocument.read` 优先做一次新的包含性工作区读取，并在文件消失或不可读时回退到 `meta.content`。缺少会话 `cwd` 时故障关闭，除非提交时正文仍在。图片 Fetch 是另一条已认证的 `/api/submitted-document-image` 路由；它从不返回 Markdown。

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

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

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
