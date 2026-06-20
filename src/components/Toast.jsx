// Minimal status banner. No drop shadow — a border and the accent dot
// carry enough weight to separate it from the page underneath.
export default function Toast({ toast }) {
  if (!toast.show) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:top-6 sm:bottom-auto sm:right-6 z-50 flex items-center gap-3 px-4 py-3 border text-[11px] font-semibold uppercase bg-neutral-900 border-neutral-700 text-neutral-200 max-w-full sm:max-w-md">
      <span className="w-1.5 h-1.5 bg-orange-500 animate-pulse flex-shrink-0" />
      <span className="break-all">{toast.message}</span>
    </div>
  );
}
