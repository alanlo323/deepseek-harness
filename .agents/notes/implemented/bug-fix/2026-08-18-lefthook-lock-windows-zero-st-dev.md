# Agent Note: Treat Windows path-stat zero st_dev as the same Lefthook lock

Status: implemented

English | [中文](2026-08-18-lefthook-lock-windows-zero-st-dev.zh.md)

## Problem

[`scripts/install-lefthook.mjs`](../../../../scripts/install-lefthook.mjs) identifies its repository lock by comparing `fs.fstat` on the exclusive-create handle with `fs.lstat` on the path after close, then repeats that check at release. On Windows, Node's path-based `stat` reports `st_dev` as 0 while `fstat` on the open handle reports the volume serial, so the installer treats every successful create as a replacement, exits, and leaves `.git/dsh-lefthook-install.lock`. The next `pnpm install` then refuses the leftover lock as stale and asks for manual recovery.

## Decision

Lock identity is `sameInstallLockIdentity` in [`scripts/install-lefthook-lock-identity.ts`](../../../../scripts/install-lefthook-lock-identity.ts), which the installer applies: inodes must match, and volume serials must match when both stats report a non-zero `st_dev`. A zero serial is ignored rather than treated as a different file. Dead and invalid locks still require manual recovery, as owned by [worktree-local Lefthook](../process/2026-07-27-worktree-local-lefthook.md).

## Alternatives considered

**Drop the inode check and trust only the PID and UUID record.** Rejected: release must still refuse to unlink a replacement file at the same path.

**Delete leftover locks automatically when the recorded PID is dead.** Rejected: explicit recovery remains the rule so a crashed writer is not confused with a still-initializing one.

**Keep the create handle open until release and unlink through that handle.** Rejected: Windows delete-on-close sharing is extra platform behavior, and waiters that `lstat` the lock still need a path identity rule.

## Consequences

Windows `pnpm install` can finish Lefthook setup and remove its own lock. A replacement with a different inode still refuses unlink. A leftover lock from the previous false replacement still has to be removed once.

## Testing

`scripts/install-lefthook.spec.ts` pins mixed `fstat`/`lstat` identity, including a live create-handle versus path `lstat`, and still requires a successful install to leave no lock file.
