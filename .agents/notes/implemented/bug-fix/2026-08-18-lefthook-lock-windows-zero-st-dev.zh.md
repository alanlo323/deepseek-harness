# Agent Note: 将 Windows 路径 stat 的零 st_dev 视为同一把 Lefthook 锁

Status: implemented

[English](2026-08-18-lefthook-lock-windows-zero-st-dev.md) | 中文

## 问题

[`scripts/install-lefthook.mjs`](../../../../scripts/install-lefthook.mjs) 通过比较独占创建句柄上的 `fs.fstat` 与关闭后路径上的 `fs.lstat` 来识别仓库锁，并在释放时重复该检查。在 Windows 上，Node 基于路径的 `stat` 将 `st_dev` 报告为 0，而对仍打开的句柄做 `fstat` 则报告卷序列号，因此安装程序会把每一次成功创建都当成文件已被替换，退出后留下 `.git/dsh-lefthook-install.lock`。下一次 `pnpm install` 再把这份残留锁当成过期锁拒绝，并要求人工恢复。

## 决策

锁身份由 [`scripts/install-lefthook-lock-identity.ts`](../../../../scripts/install-lefthook-lock-identity.ts) 中的 `sameInstallLockIdentity` 判定，安装程序套用同一规则：inode 必须相同；仅当两侧 `st_dev` 都非零时才比较卷序列号。零序列号会被忽略，而不是当成另一份文件。所属进程已结束或内容无效的锁仍须人工恢复，该规则由 [worktree 本地 Lefthook](../process/2026-07-27-worktree-local-lefthook.md) 负责。

## 考虑过的替代方案

**放弃 inode 检查，只信任 PID 与 UUID 记录。** 否决：释放时仍须拒绝删除同一路径上已被替换的文件。

**在记录的 PID 已结束时自动删除残留锁。** 否决：显式恢复仍然是规则，以免把崩溃的写入者与仍在初始化的写入者混为一谈。

**一直持有创建句柄直到释放，并通过该句柄删除。** 否决：Windows 的关闭时删除共享是额外的平台行为，而通过对路径做 `lstat` 等待的进程仍然需要路径身份规则。

## 后果

Windows 上的 `pnpm install` 可以完成 Lefthook 安装并删除自己的锁。inode 不同的替换文件仍会拒绝删除。先前误报替换而留下的锁仍须手动删除一次。

## 测试

`scripts/install-lefthook.spec.ts` 锁定了混合 `fstat`／`lstat` 身份，包括一次真实的创建句柄与路径 `lstat` 对比，并仍要求成功安装后不留下锁文件。
