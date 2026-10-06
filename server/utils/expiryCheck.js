/**
 * Check the status of a medicine based on its expiry date.
 * @param {Date|string} expiryDate - The expiry date of the medicine.
 * @returns {string} The status of the medicine: EXPIRED, CRITICAL, WARNING, CAUTION, SAFE
 */
export const getExpiryDaysLeft = (expiryDate, today = new Date()) => {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate);
  const currentDay = new Date(today);
  if (Number.isNaN(expiry.getTime()) || Number.isNaN(currentDay.getTime())) return null;

  currentDay.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - currentDay.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Check the status of a medicine based on its expiry date.
 * CAUTION marks medicines expiring within the next 180 days.
 */
export const checkExpiryStatus = (expiryDate, today = new Date()) => {
  const diffDays = getExpiryDaysLeft(expiryDate, today);
  if (diffDays === null) return 'SAFE';

  /*
   * Retain a stable classification while expanding the advance warning window:
   * <=30 critical, <=60 warning, <=180 caution, otherwise safe.
   */
  if (diffDays < 0) {
    return 'EXPIRED';
  } else if (diffDays <= 30) {
    return 'CRITICAL';
  } else if (diffDays <= 60) {
    return 'WARNING';
  } else if (diffDays <= 180) {
    return 'CAUTION';
  } else {
    return 'SAFE';
  }
};
