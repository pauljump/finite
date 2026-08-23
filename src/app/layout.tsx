import type { Metadata, Viewport } from "next"
import { Fraunces, Figtree, IBM_Plex_Mono } from "next/font/google"
import { FleetBeacon } from "@/components/FleetBeacon"
import "./globals.css"

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
})

const body = Figtree({
  subsets: ["latin"],
  variable: "--font-body",
})

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Finite",
  description: "A short reading list with a stop condition. A demo — clone it to run yours.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg" },
  appleWebApp: { capable: true, title: "Finite", statusBarStyle: "default" },
}

export const viewport: Viewport = {
  themeColor: "#F3EEE4",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        {children}
        <FleetBeacon />
      </body>
    </html>
  )
}
