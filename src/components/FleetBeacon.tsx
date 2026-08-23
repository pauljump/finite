"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

/**
 * FleetBeacon — factory-standard first-party analytics (pulse).
 *
 * Canonical copy: packages/web-templates/components/fleet-beacon.tsx
 * This fork only reports from the hosted demo so GitHub clones do not
 * phone home to pulse.polyfeeds.dev.
 */
const INGEST = "https://pulse.polyfeeds.dev/api/ingest"
const VISITOR_KEY = "pulse_visitor_id"
const LANDING_KEY = "pulse_landing_path"
const HOSTS = new Set(["finite.polyfeeds.dev", "deslop.polyfeeds.dev"])

let firedOnce = false

function cleanPath(path: string): string {
  return (path || "/").split("?")[0].split("#")[0] || "/"
}

function cleanReferrer(referrer: string): string | undefined {
  if (!referrer) return undefined
  try {
    const url = new URL(referrer)
    return `${url.origin}${cleanPath(url.pathname)}`
  } catch {
    return undefined
  }
}

function visitorId(): string | undefined {
  try {
    let id = window.localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
      window.localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    return undefined
  }
}

function landingPath(): string {
  try {
    const current = cleanPath(window.location.pathname)
    const stored = window.sessionStorage.getItem(LANDING_KEY)
    if (stored) return stored
    window.sessionStorage.setItem(LANDING_KEY, current)
    return current
  } catch {
    return cleanPath(window.location.pathname)
  }
}

function attribution() {
  const params = new URLSearchParams(window.location.search)
  return {
    source: params.get("utm_source") || undefined,
    medium: params.get("utm_medium") || undefined,
    campaign: params.get("utm_campaign") || undefined,
    term: params.get("utm_term") || undefined,
    content: params.get("utm_content") || undefined,
  }
}

export function FleetBeacon() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    if (typeof window === "undefined") return
    if (!HOSTS.has(window.location.hostname)) return
    const w = window as unknown as { __pulse?: boolean }
    const inlineBeatUs = !firedOnce && w.__pulse === true
    firedOnce = true
    w.__pulse = true
    const enteredAt = Date.now()
    const payload = (event: string, extra?: Record<string, unknown>) =>
      JSON.stringify({
        event,
        path: cleanPath(pathname),
        referrer: cleanReferrer(document.referrer),
        landingPath: landingPath(),
        visitorId: visitorId(),
        screen: `${window.innerWidth}x${window.innerHeight}`,
        ...attribution(),
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
    const onClick = (event: MouseEvent) => {
      const el = (event.target as Element | null)?.closest<HTMLElement>("[data-analytics-event]")
      if (!el) return
      const target = el.getAttribute("href") || el.dataset.analyticsTarget || undefined
      try {
        fetch(INGEST, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          keepalive: true,
          body: payload(el.dataset.analyticsEvent || "cta_click", {
            targetPath: target ? cleanPath(target) : undefined,
          }),
        }).catch(() => {})
      } catch {}
    }
    document.addEventListener("visibilitychange", onHide)
    document.addEventListener("click", onClick)
    window.addEventListener("pagehide", sendDwell)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      document.removeEventListener("click", onClick)
      window.removeEventListener("pagehide", sendDwell)
    }
  }, [pathname])

  return null
}
