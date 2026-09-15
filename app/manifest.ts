import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ShiftBook: Roster & Pay",
    short_name: "ShiftBook",
    description: "Track shifts across casual jobs, expected pay and unpaid wages.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f1f5f9",
    theme_color: "#1e3a5f",
    lang: "en-AU",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Add shift", url: "/shifts/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Unpaid shifts", url: "/unpaid", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
