/**
 * Modal berbasis `<dialog>` + `showModal()`: Esc menutup, fokus terjebak di dalam modal,
 * dan fokus dikembalikan ke pemicu setelah ditutup (DESIGN_SYSTEM §8, §11).
 */
export function createDialogs() {
    const returnFocus = new WeakMap();

    function open(dialog, initialFocus) {
        if (dialog.open) return;
        returnFocus.set(dialog, document.activeElement);
        dialog.showModal();
        (initialFocus ?? dialog.querySelector(".btn--primary"))?.focus();
    }

    function close(dialog) {
        if (dialog.open) dialog.close();
    }

    for (const dialog of document.querySelectorAll("dialog")) {
        dialog.addEventListener("close", () => {
            const target = returnFocus.get(dialog);
            if (target instanceof HTMLElement && document.contains(target)) target.focus();
        });
        // Klik di backdrop menutup modal.
        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) close(dialog);
        });
    }

    return {
        open,
        close,
        anyOpen: () => Boolean(document.querySelector("dialog[open]")),
    };
}
