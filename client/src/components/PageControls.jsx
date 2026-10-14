export default function PageControls({ page, pages, onChange, total }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 my-3 text-sm">
    <span>{total ?? 0} records · Page {page} of {Math.max(1, pages)}</span>
    <div className="flex gap-2">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-lg border px-3 py-1 disabled:opacity-40">Previous</button>
      <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} className="rounded-lg border px-3 py-1 disabled:opacity-40">Next</button>
    </div>
  </div>;
}
