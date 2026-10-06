/** Shown instantly while a page loads — a branded spinner instead of a blank white flash. */
export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f5f4ff]" role="status" aria-label="Loading">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
    </div>
  );
}
