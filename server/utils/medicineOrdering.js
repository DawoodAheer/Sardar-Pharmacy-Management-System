// Case-insensitive company ordering, then medicine name, then stable pagination.
export const MEDICINE_COLLATION = { locale: 'en', strength: 2, numericOrdering: true };
export const MANUFACTURER_SORT = { manufacturer: 1, name: 1, _id: 1 };
