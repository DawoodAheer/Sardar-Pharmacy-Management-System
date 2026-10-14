export function pagination(query = {}) {
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(query.limit) || 50)));
  return { page, limit, skip: (page - 1) * limit };
}

export async function pagedFind(Model, filter, req, options = {}) {
  const { page, limit, skip } = pagination(req.query);
  let query = Model.find(filter).sort(options.sort || { createdAt: -1, _id: -1 }).skip(skip).limit(limit);
  if (options.select) query = query.select(options.select);
  for (const [field, select] of options.populate || []) query = query.populate(field, select);
  const [records, total] = await Promise.all([query.lean(), Model.countDocuments(filter)]);
  return { records, total, page, pages: Math.ceil(total / limit) };
}

export function pageResponse(result, key) {
  const { records, ...metadata } = result;
  return { ...metadata, [key]: records };
}
