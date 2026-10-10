/** Escape text for an HTML text node. */
export const escapeHtml = (text) =>
    String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Escape text for a double-quoted HTML attribute value. */
export const escapeAttr = (text) => escapeHtml(text).replace(/"/g, '&quot;')
