/**
 * Normalize text: Title Case + collapse multiple spaces into one + trim
 * Use for all text fields EXCEPT email addresses
 * Example: "  skillnix  technologies " → "Skillnix Technologies"
 */
const normalizeText = (str) => {
  if (!str || typeof str !== 'string') return str || '';
  return str.trim().replace(/\s+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

module.exports = { normalizeText };
