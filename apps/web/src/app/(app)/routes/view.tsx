"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Route, Loader2, MapPin, ListOrdered } from "lucide-react";
import { Card, CardBody, CardHeader, Button, cn } from "@rosie/ui";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Day = (typeof DAYS)[number];

const DAY_LABEL: Record<Day, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

interface Stop {
  id: string;
  name: string;
  phone?: string | null;
  city?: string | null;
  lat: number | null;
  lng: number | null;
  hasGeocode: boolean;
  serviceWindow?: string | null;
  zone?: string | null;
  notes?: string | null;
}

interface OptimizedResponse {
  ok: true;
  day: Day;
  stops: Array<{ id: string; name: string; lat: number; lng: number }>;
  distanceMeters: number;
  durationSeconds: number;
  geometry: { type: "LineString"; coordinates: Array<[number, number]> } | null;
  approximate: boolean;
  totalSkipped: number;
  reason?: string;
}

export function RoutesView({ mapboxToken }: { mapboxToken: string | null }) {
  const [day, setDay] = useState<Day>(currentDay());
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimized, setOptimized] = useState<OptimizedResponse | null>(null);

  useEffect(() => {
    loadDay(day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  async function loadDay(d: Day) {
    setLoading(true);
    setOptimized(null);
    try {
      const res = await fetch(`/api/routes/${d}`);
      const j = await res.json();
      setStops(j.stops ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function optimize() {
    setOptimizing(true);
    try {
      const res = await fetch("/api/routes/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, roundtrip: true }),
      });
      const j = (await res.json()) as OptimizedResponse;
      if (!j.ok) {
        alert("Optimize failed");
        return;
      }
      setOptimized(j);
    } finally {
      setOptimizing(false);
    }
  }

  const mappable = stops.filter((s) => s.hasGeocode);
  const unmappable = stops.filter((s) => !s.hasGeocode);

  // Display order: optimized result if we have one, else original load order.
  const displayStops: Array<Stop | (OptimizedResponse["stops"][number] & { fromOpt: true })> =
    optimized
      ? optimized.stops.map((s) => {
          const original = stops.find((x) => x.id === s.id);
          if (original) return { ...original, lat: s.lat, lng: s.lng };
          return { ...s, hasGeocode: true, fromOpt: true } as Stop & { fromOpt: true };
        })
      : stops;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Day</h3>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-1">
              {DAYS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDay(d)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase",
                    d === day
                      ? "border-rosie-600 bg-rosie-600 text-white"
                      : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]",
                  )}
                >
                  {DAY_LABEL[d]}
                </button>
              ))}
            </div>
            <div className="mt-3 text-[11px] text-[hsl(var(--muted-foreground))]">
              {loading
                ? "Loading…"
                : stops.length === 0
                  ? "No customers scheduled for this day."
                  : `${stops.length} stop${stops.length === 1 ? "" : "s"}` +
                    (unmappable.length > 0
                      ? ` · ${unmappable.length} missing coordinates`
                      : "")}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Optimize</h3>
          </CardHeader>
          <CardBody className="space-y-2">
            <Button
              onClick={optimize}
              disabled={optimizing || mappable.length < 2}
              className="w-full"
            >
              {optimizing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Route className="h-3.5 w-3.5" />
              )}
              {optimizing ? "Optimizing…" : "Optimize this day"}
            </Button>
            {mappable.length < 2 ? (
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                Need at least two geocoded customers on this day to optimize.
              </p>
            ) : null}
            {optimized ? (
              <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-2 text-[11px]">
                <div>
                  <strong>{(optimized.distanceMeters / 1609.34).toFixed(1)} mi</strong>{" "}
                  total · ≈ {Math.round(optimized.durationSeconds / 60)} min drive
                </div>
                {optimized.approximate ? (
                  <div className="mt-1 text-amber-700 dark:text-amber-300">
                    Approximate (Mapbox unavailable or &gt;12 stops). Set
                    NEXT_PUBLIC_MAPBOX_TOKEN + MAPBOX_TOKEN for road-aware routing.
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="p-0">
          {mapboxToken ? (
            <RouteMap
              token={mapboxToken}
              stops={mappable}
              line={optimized?.geometry ?? null}
              order={optimized?.stops.map((s) => s.id) ?? null}
            />
          ) : (
            <div className="px-5 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
              <MapPin className="mx-auto mb-2 h-5 w-5" />
              No <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> set — showing list view only. Add the token
              under Vercel → Environment Variables to enable the map.
            </div>
          )}

          <div className="border-t border-[hsl(var(--border))]">
            <div className="flex items-center gap-2 px-5 py-3">
              <ListOrdered className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <h3 className="text-sm font-semibold">Visit order</h3>
            </div>
            {displayStops.length === 0 ? (
              <div className="px-5 py-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
                Nothing to render yet.
              </div>
            ) : (
              <ol className="divide-y divide-[hsl(var(--border))]">
                {displayStops.map((s, i) => (
                  <li key={s.id} className="px-5 py-2 text-sm">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rosie-600 text-[11px] font-bold text-white">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{s.name}</div>
                        <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                          {[
                            "city" in s ? s.city : null,
                            "zone" in s ? s.zone : null,
                            "serviceWindow" in s ? s.serviceWindow : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </div>
                        {"notes" in s && s.notes ? (
                          <div className="mt-0.5 text-[11px] italic text-[hsl(var(--muted-foreground))]">
                            {s.notes}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {unmappable.length > 0 ? (
              <div className="border-t border-[hsl(var(--border))] px-5 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Skipped — no coordinates
                </div>
                <ul className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
                  {unmappable.map((s) => (
                    <li key={s.id}>· {s.name}</li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                  Edit these customers and re-save their address — geocoding happens on save when
                  <code> MAPBOX_TOKEN</code> is set.
                </p>
              </div>
            ) : null}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/**
 * Mapbox GL JS rendered by injecting the CDN script + CSS at runtime — no
 * mapbox-gl npm dependency, no bundle bloat for tenants without the token.
 *
 * Types are intentionally loose (`any`) at the boundary because we don't pull
 * in @types/mapbox-gl. The surface we use is small and stable across v3.x.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    mapboxgl?: any;
  }
}

let _mapboxLoader: Promise<any> | null = null;
function loadMapbox(token: string): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (window.mapboxgl) {
    window.mapboxgl.accessToken = token;
    return Promise.resolve(window.mapboxgl);
  }
  if (_mapboxLoader) return _mapboxLoader;
  _mapboxLoader = new Promise((resolve, reject) => {
    if (!document.querySelector("link[data-mapbox-css]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://api.mapbox.com/mapbox-gl-js/v3.7.0/mapbox-gl.css";
      link.setAttribute("data-mapbox-css", "1");
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.7.0/mapbox-gl.js";
    script.async = true;
    script.onload = () => {
      if (!window.mapboxgl) {
        reject(new Error("mapbox-gl failed to attach"));
        return;
      }
      window.mapboxgl.accessToken = token;
      resolve(window.mapboxgl);
    };
    script.onerror = () => reject(new Error("mapbox-gl script blocked"));
    document.head.appendChild(script);
  });
  return _mapboxLoader;
}

function RouteMap({
  token,
  stops,
  line,
  order,
}: {
  token: string;
  stops: Stop[];
  line: { type: "LineString"; coordinates: Array<[number, number]> } | null;
  order: string[] | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const moduleRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadMapbox(token)
      .then((mod) => {
        if (cancelled) return;
        moduleRef.current = mod;
        setReady(true);
      })
      .catch((e) => console.warn("[routes] mapbox load failed", e));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const center = useMemo<[number, number]>(() => {
    if (stops.length === 0) return [-98, 39]; // continental-US fallback.
    const sLng = stops.reduce((acc, s) => acc + (s.lng ?? 0), 0) / stops.length;
    const sLat = stops.reduce((acc, s) => acc + (s.lat ?? 0), 0) / stops.length;
    return [sLng, sLat];
  }, [stops]);

  useEffect(() => {
    if (!ready || !moduleRef.current || !containerRef.current || mapRef.current) return;
    const mapboxgl = moduleRef.current;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center,
      zoom: stops.length > 0 ? 10 : 4,
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Re-render markers + route line on every stops/order change.
  useEffect(() => {
    const mapboxgl = moduleRef.current;
    const map = mapRef.current;
    if (!mapboxgl || !map) return;

    // Clear previous markers.
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const orderedStops = order
      ? order
          .map((id) => stops.find((s) => s.id === id))
          .filter((s): s is Stop => Boolean(s))
      : stops;

    orderedStops.forEach((s, i) => {
      if (s.lng == null || s.lat == null) return;
      const el = document.createElement("div");
      el.style.cssText =
        "width:26px;height:26px;border-radius:50%;background:#5b21b6;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;box-shadow:0 1px 6px rgba(0,0,0,0.25);border:2px solid #fff;cursor:pointer;";
      el.textContent = String(i + 1);
      const marker = new mapboxgl.Marker(el)
        .setLngLat([s.lng, s.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 18 }).setHTML(
            `<div style="font-size:13px;font-weight:700;margin-bottom:2px">${escapeHtml(s.name)}</div>` +
              (s.city ? `<div style="font-size:11px;color:#52525b">${escapeHtml(s.city)}</div>` : ""),
          ),
        )
        .addTo(map);
      markersRef.current.push(marker);
    });

    // Fit bounds.
    if (orderedStops.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      orderedStops.forEach((s) => {
        if (s.lng != null && s.lat != null) bounds.extend([s.lng, s.lat]);
      });
      map.fitBounds(bounds, { padding: 40, maxZoom: 13, duration: 600 });
    }

    // Route line.
    const addOrUpdateLine = () => {
      const existing = map.getSource("route-line");
      if (line) {
        const feature = {
          type: "Feature" as const,
          properties: {},
          geometry: line,
        };
        if (existing) {
          existing.setData(feature);
        } else {
          map.addSource("route-line", { type: "geojson", data: feature });
          map.addLayer({
            id: "route-line",
            type: "line",
            source: "route-line",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#5b21b6", "line-width": 4, "line-opacity": 0.7 },
          });
        }
      } else if (existing) {
        if (map.getLayer("route-line")) map.removeLayer("route-line");
        map.removeSource("route-line");
      }
    };

    if (map.isStyleLoaded()) addOrUpdateLine();
    else map.once("style.load", addOrUpdateLine);
  }, [stops, line, order]);

  return <div ref={containerRef} className="h-[520px] w-full" />;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

function currentDay(): Day {
  const idx = new Date().getDay();
  // JS: 0=Sun..6=Sat. Map to our enum order (mon=0..sun=6).
  const map: Day[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[idx] ?? "mon";
}
