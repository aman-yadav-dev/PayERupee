/**
 * Centralized reference-counted body scroll lock manager.
 * Guarantees document.body.style.overflow is never permanently locked to "hidden"
 * when multiple modals or drawers open and close.
 */

let lockCount = 0;
let originalOverflow = "";

export function lockScroll(): void {
  if (typeof document === "undefined") return;
  if (lockCount === 0) {
    const current = document.body.style.overflow;
    originalOverflow = current === "hidden" ? "" : current;
    document.body.style.overflow = "hidden";
  }
  lockCount++;
}

export function unlockScroll(): void {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = originalOverflow || "";
    originalOverflow = "";
  }
}
