"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

const INGEST = "https://pulse.polyfeeds.dev/api/ingest"
let firedOnce = false

export function FleetBeacon() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    if (typeof window === "undefined") return
    if (!["finite.polyfeeds.dev", "deslop.polyfeeds.dev"].includes(window.location.hostname)) return
    const w = window as unknown as { __pulse?: boolean }
    const inlineBeatUs = !firedOnce && w.__pulse === true
    firedOnce = true
    w.__pulse = true
    const enteredAt = Date.now()
    const payload = (event: string, extra?: Record<string, unknown>) =>
      JSON.stringify({
        event,
        path: pathname,
        referrer: document.referrer || undefined,
        screen: `${window.innerWidth}x${window.innerHeight}`,
        ...extra,
      })

    try {
      if (!inlineBeatUs)
        fetch(INGEST, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          keepalive: true,
          body: payload("page_view"),
        }).catch(() => {})
    } catch {}

    const sendDwell = () => {
      try {
        navigator.sendBeacon(
          INGEST,
          new Blob([payload("page_dwell", { dwellMs: Date.now() - enteredAt })], { type: "text/plain" }),
        )
      } catch {}
    }
    const onHide = () => {
      if (document.visibilityState === "hidden") sendDwell()
    }
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", sendDwell)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", sendDwell)
    }
  }, [pathname])

  return null
}
