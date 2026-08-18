/**
 * Reports whether two stats name the same Lefthook installer lock file.
 * Path-based `stat` on Windows reports `st_dev` as 0, while `fstat` on the
 * exclusive-create handle reports the volume serial; a zero serial is not a
 * replacement.
 *
 * @param left - one lock `stat`
 * @param right - the other lock `stat`
 * @returns `true` when both name the same inode, ignoring a zero `st_dev`
 */
export function sameInstallLockIdentity(
  left: { readonly dev: number; readonly ino: number },
  right: { readonly dev: number; readonly ino: number },
): boolean {
  if (left.ino !== right.ino) return false
  if (left.dev === right.dev) return true
  return left.dev === 0 || right.dev === 0
}
