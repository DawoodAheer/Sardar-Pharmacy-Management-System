import { lazy, Suspense } from 'react';
export default function lazyPanel(loader) {
  const Component = lazy(loader);
  return function DeferredPanel(props) {
    if (props.isOpen === false) return null;
    return <Suspense fallback={<p className="p-3 text-sm" role="status">Loading panel…</p>}><Component {...props} /></Suspense>;
  };
}
