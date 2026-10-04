"use client";

import { useCallback, useEffect, useState } from "react";
import { knownRoute, preloadImage, proxiedUrl } from "@/lib/imagePreload";
import { ImageOff, Maximize2, Minus, Plus, RotateCw, X } from "lucide-react";

type Props = {
  src: string;
  alt?: string;
  /** Tap the picture to open a full-screen viewer with zoom. Turn off inside buttons (e.g. answer options). */
  zoomable?: boolean;
  /** Smaller frame, used for image answer options */
  compact?: boolean;
  className?: string;
};

/**
 * Diagram / picture for a question.
 *  • skeleton while loading, so the layout does not jump
 *  • a clear "couldn't load" state with Retry + Open image (a silently missing diagram
 *    makes a Biology question unanswerable)
 *  • tap to zoom (pinch is disabled app-wide, so the viewer has its own +/- controls)
 * Render it with `key={src}` so state resets when the question changes.
 */
export default function QuestionImage({ src, alt = "Question illustration", zoomable = true, compact = false, className = "" }: Props) {
  // If the picture was already checked (preloaded while the previous question was on screen) it shows at once.
  const initialRoute = knownRoute(src);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    initialRoute === "failed" ? "error" : initialRoute ? "loaded" : "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const [via, setVia] = useState<"direct" | "proxy">(initialRoute === "proxy" ? "proxy" : "direct");
  const [ready, setReady] = useState(initialRoute !== undefined);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Only remote http(s) pictures can be re-fetched through our server; data:/blob:/same-origin cannot.
  const canProxy = /^https?:\/\//i.test(src) && !src.includes("/api/image-proxy");

  // Not checked yet (e.g. the very first question): check it now, then show it from the browser cache.
  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    void preloadImage(src).then((route) => {
      if (cancelled) return;
      if (route === "failed") setStatus("error");
      else setVia(route === "proxy" ? "proxy" : "direct");
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [src, ready]);

  let url = src;
  if (via === "proxy") {
    url = `${proxiedUrl(src)}${attempt > 0 ? `&r=${attempt}` : ""}`;
  } else if (attempt > 0 && !src.startsWith("data:")) {
    // Cache-bust only on retry (and never for data: URIs)
    url = `${src}${src.includes("?") ? "&" : "?"}r=${attempt}`;
  }

  const handleFailure = useCallback(() => {
    if (via === "direct" && canProxy) {
      setVia("proxy");
      setStatus("loading");
    } else {
      setStatus("error");
    }
  }, [via, canProxy]);

  // An image that was already cached can finish loading before React attaches onLoad
  const imgRef = useCallback(
    (node: HTMLImageElement | null) => {
      if (!node || !node.complete) return;
      if (node.naturalWidth > 0) setStatus("loaded");
      else handleFailure();
    },
    [handleFailure],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(4, z + 0.5));
      if (e.key === "-") setZoom((z) => Math.max(1, z - 0.5));
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (status === "error" && compact) {
    // Lives inside an answer-option <button>: no nested buttons/links allowed here
    return (
      <span className={`flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 ${className}`}>
        <ImageOff className="h-4 w-4 shrink-0 text-slate-400" aria-hidden /> Image unavailable
      </span>
    );
  }

  if (status === "error") {
    return (
      <div className={`flex flex-col items-center gap-2 rounded-2xl bg-slate-50 px-4 py-5 text-center ring-1 ring-slate-200 ${className}`} role="group" aria-label="Image failed to load">
        <ImageOff className="h-6 w-6 text-slate-400" aria-hidden />
        <p className="text-xs font-semibold text-slate-500">This diagram could not be loaded.</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              // A manual retry goes through the server, which can reach hosts the phone cannot
              if (canProxy) setVia("proxy");
              setStatus("loading");
              setAttempt((n) => n + 1);
            }}
            className="inline-flex touch-manipulation items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200"
          >
            <RotateCw className="h-3 w-3" aria-hidden /> Retry
          </button>
          <a href={src} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full bg-white px-3 py-1.5 text-xs font-bold text-violet-700 ring-1 ring-slate-200">
            Open image
          </a>
        </div>
      </div>
    );
  }

  const frame = (
    <div className={`keep-light relative overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 ${status === "loading" ? (compact ? "min-h-[64px]" : "min-h-[140px]") : ""} ${className}`}>
      {status === "loading" && <div className="absolute inset-0 animate-pulse bg-slate-100" aria-hidden />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {ready && <img
        ref={imgRef}
        src={url}
        alt={alt}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setStatus("loaded")}
        onError={handleFailure}
        draggable={false}
        className={`mx-auto block h-auto w-auto max-w-full object-contain ${compact ? "max-h-40 p-1" : "max-h-72 p-2 sm:max-h-96"} ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
      />}
      {zoomable && status === "loaded" && (
        <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-1 text-[10px] font-bold text-white">
          <Maximize2 className="h-3 w-3" aria-hidden /> Zoom
        </span>
      )}
    </div>
  );

  if (!zoomable) return frame;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setZoom(1);
          setOpen(true);
        }}
        disabled={status !== "loaded"}
        aria-label="Zoom image"
        className="block w-full touch-manipulation text-left"
      >
        {frame}
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-slate-950/95" role="dialog" aria-modal="true" aria-label="Image viewer">
          <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1} aria-label="Zoom out" className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-40">
                <Minus className="h-5 w-5" aria-hidden />
              </button>
              <span className="min-w-[3rem] text-center text-sm font-bold tabular-nums text-white">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((z) => Math.min(4, z + 0.5))} disabled={zoom >= 4} aria-label="Zoom in" className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-40">
                <Plus className="h-5 w-5" aria-hidden />
              </button>
              {zoom > 1 && (
                <button type="button" onClick={() => setZoom(1)} className="ml-1 h-10 touch-manipulation rounded-full bg-white/10 px-3 text-xs font-bold text-white">
                  Fit
                </button>
              )}
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close image viewer" className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-white/15 text-white">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="flex-1 overflow-auto overscroll-contain px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
            <div className="flex min-h-full items-center justify-center" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={alt}
                referrerPolicy="no-referrer"
                draggable={false}
                className="keep-light rounded-xl bg-white object-contain"
                style={zoom === 1 ? { maxWidth: "100%", maxHeight: "calc(100dvh - 6rem)" } : { width: `${zoom * 100}%`, maxWidth: "none" }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
