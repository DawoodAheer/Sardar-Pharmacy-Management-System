// Cash is recognized when an online order is accepted. Legacy orders without
// an acceptance timestamp retain their creation date; in-store sales use it too.
export const saleDateFilter = range => ({
  $or: [
    { billType: 'ONLINE', reviewedAt: range },
    { billType: 'ONLINE', reviewedAt: null, createdAt: range },
    { billType: { $ne: 'ONLINE' }, createdAt: range },
  ],
});
