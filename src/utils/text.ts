/** Lowercase, accent-free, single-spaced: for comparing names typed or dictated by users. */
export const normalizeName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Removes control characters and collapses whitespace in free text sent to the AI. */
export const sanitizeFreeText = (value: string, maxLength: number) =>
  value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
