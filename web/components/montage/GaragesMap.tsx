"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { GarageNearby } from "@/lib/api";

/**
 * Carte des garages partenaires (Leaflet auto-hébergé — aucun script
 * externe, conforme à la CSP stricte du site). Les tuiles OpenStreetMap
 * sont chargées en <img> (couvertes par img-src https:). Leaflet est
 * importé dynamiquement dans l'effet pour ne jamais s'exécuter côté serveur.
 */
export function GaragesMap({ garages }: { garages: GarageNearby[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Typé en unknown : Leaflet n'est chargé qu'au runtime navigateur.
  const mapRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    const withCoords = garages.filter(
      (g) => g.lat != null && g.lng != null,
    );
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        scrollWheelZoom: false,
      }).setView([46.6, 2.5], 5); // France par défaut
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const pin = L.divIcon({
        className: "",
        html:
          '<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;' +
          "background:#e11d2a;border:2px solid #fff;transform:rotate(-45deg);" +
          'box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 22],
        popupAnchor: [0, -20],
      });

      const markers = withCoords.map((g) => {
        const m = L.marker([g.lat as number, g.lng as number], {
          icon: pin,
          title: g.name,
        });
        const dist =
          g.distance_km != null
            ? `<br><span style="color:#6b7280">à ${g.distance_km} km</span>`
            : "";
        m.bindPopup(
          `<strong>${escapeHtml(g.name)}</strong><br>` +
            `${escapeHtml(g.address)}, ${escapeHtml(g.postal_code)} ${escapeHtml(g.city)}${dist}` +
            `<br><a href="/garages/${encodeURIComponent(g.slug)}" style="color:#e11d2a;font-weight:600">Voir la fiche</a>`,
        );
        return m;
      });

      if (markers.length) {
        const group = L.featureGroup(markers).addTo(map);
        map.fitBounds(group.getBounds().pad(0.25), { maxZoom: 14 });
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [garages]);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Carte des garages partenaires"
      className="h-[420px] w-full overflow-hidden rounded-2xl border border-line shadow-card"
    />
  );
}

/** Échappe le texte injecté dans le HTML des popups Leaflet. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
