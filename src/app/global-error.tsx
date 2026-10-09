"use client";

/**
 * Last-resort screen: only shown if the root layout itself crashes (route errors use app/error.tsx).
 * It must render its own <html>/<body>, so it uses plain inline styles and no app components.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f5f4ff", color: "#211b3d" }}>
        <main style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 360 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Qubit Learn hit a problem</h1>
            <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
              Nothing you saved on this device was lost. Reload to continue.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{ marginTop: 12, height: 48, padding: "0 28px", border: 0, borderRadius: 16, background: "#6557d9", color: "#fff", fontWeight: 700, fontSize: 14 }}
            >
              Reload
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
