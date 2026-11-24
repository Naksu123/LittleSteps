"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV === "test"
    ) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-blocking fallback when offline or restricted
    });
  }, []);

  return null;
}
