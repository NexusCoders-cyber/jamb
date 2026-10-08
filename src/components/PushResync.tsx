"use client";

import { useEffect } from "react";
import { useUser } from "@/lib/useUser";
import { resyncPush } from "@/lib/pushClient";

/** Invisible. Keeps a phone's notification registration attached to whoever is signed in on it. */
export default function PushResync() {
  const { user } = useUser();
  useEffect(() => {
    if (!user) return;
    const t = window.setTimeout(() => void resyncPush(), 4000);
    return () => window.clearTimeout(t);
  }, [user]);
  return null;
}
