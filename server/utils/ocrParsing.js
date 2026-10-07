export const parseExplicitDecimalPrice = (text, kind) => {
  const labels = {
    purchase: '(?:purchase\\s*(?:price|cost)|buying\\s*price)',
    sale: '(?:sale\\s*(?:price|cost)|selling\\s*price)',
    mrp: 'mrp',
  };
  const label = labels[kind];
  if (!label) {
    throw new Error(`Unsupported OCR price label: ${kind}`);
  }

  const match = String(text || '').match(
    new RegExp(
      `\\b${label}\\b\\s*(?:[:=-]\\s*)?(?:rs\\.?\\s*|pkr\\s*)?([0-9]{1,8}\\.[0-9]{1,2})\\b`,
      'i'
    )
  );
  return match ? Number(match[1]) : null;
};
