"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Route,
  Loader2,
  MapPin,
  ListOrdered,
  CalendarDays,
  Sparkles,
  Save,
  Check,
} from "lucide-react";
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

// Discriminable palette for up to 7 days.
const DAY_COLOR: Record<Day, string> = {
  mon: "#5b21b6", // rosie violet
  tue: "#0891b2", // cyan
  wed: "#16a34a", // green
  thu: "#ea580c", // orange
  fri: "#db2777", // pink
  sat: "#0ea5e9", // sky
  sun: "#a855f7", // purple
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
}

interface Proposal {
  customerId: string;
  name: string;
  fromDays: Day[];
  toDay: Day;
  lat: number;
  lng: number;
}

interface PlanResponse {
  ok: true;
  proposals: Proposal[];
  perDay: Array<{
    day: Day;
    count: number;
    centroidLat: number;
    centroidLng: number;
    spreadKm: number;
  }>;
  unmappable: Array<{ id: string; name: string; reason: string }>;
  summary: {
    totalCustomers: number;
    mappable: number;
    unmappable: number;
    iterations: number;
    converged: boolean;
  };
}

export function RoutesView({
  mapboxToken,
  initialWorkingDays,
}: {
  mapboxToken: string | null;
  initialWorkingDays: Day[];
}) {
  const [mode, setMode] = useState<"today" | "plan">("plan");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <ModeButton active={mode === "plan"} onClick={() => setMode("plan")}>
          <Sparkles className="h-3.5 w-3.5" /> Weekly planner
        </ModeButton>
        <ModeButton active={mode === "today"} onClick={() => setMode("today")}>
          <CalendarDays className="h-3.5 w-3.5" /> Today&apos;s route
        </ModeButton>
      </div>
      {mode === "plan" ? (
        <WeeklyPlanner mapboxToken={mapboxToken} initialWorkingDays={initialWorkingDays} />
      ) : (
        <TodayRoute mapboxToken={mapboxToken} />
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold",
        active
          ? "border-rosie-600 bg-rosie-600 text-white"
          : "border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]",
      )}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Weekly planner — k-means assignment of every customer to one working day
// ─────────────────────────────────────────────────────────────────────────────

function WeeklyPlanner({
  mapboxToken,
  initialWorkingDays,
}: {
  mapboxToken: string | null;
  initialWorkingDays: Day[];
}) {
  const router = useRouter();
  const [workingDays, setWorkingDays] = useState<Day[]>(initialWorkingDays);
  const [savingDays, setSavingDays] = useState(false);
  const [savedDaysAt, setSavedDaysAt] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  function toggleDay(d: Day) {
    setPlan(null);
    setApplied(false);
    setWorkingDays((prev) => {
      const has = prev.includes(d);
      if (has) {
        if (prev.length === 1) return prev; // need at least one
        return prev.filter((x) => x !== d);
      }
      return [...prev, d].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b));
    });
  }

  async function saveWorkingDays() {
    setSavingDays(true);
    setSavedDaysAt(null);
    try {
      const res = await fetch("/api/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workingDays }),
      });
      if (res.ok) setSavedDaysAt(new Date().toLocaleTimeString());
    } finally {
      setSavingDays(false);
    }
  }

  async function runPlanner() {
    setPlanning(true);
    setApplied(false);
    try {
      const res = await fetch("/api/routes/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workingDays }),
      });
      const j = (await res.json()) as PlanResponse;
      if (!j.ok) {
        alert("Planner failed.");
        return;
      }
      setPlan(j);
    } finally {
      setPlanning(false);
    }
  }

  async function applyPlan() {
    if (!plan) return;
    if (
      !confirm(
        `Apply this plan to ${plan.proposals.length} customers? Each customer's existing service days will be replaced with the proposed day.`,
      )
    )
      return;
    setApplying(true);
    try {
      const res = await fetch("/api/customers/batch-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: plan.proposals.map((p) => ({
            customerId: p.customerId,
            serviceDays: [p.toDay],
          })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Apply failed");
        return;
      }
      setApplied(true);
      router.refresh();
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Working days</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Days you actually run routes. The planner will only assign customers to selected
              days.
            </p>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={cn(
                    "rounded-md border px-1.5 py-1 text-[11px] font-bold uppercase",
                    workingDays.includes(d)
                      ? "border-rosie-600 bg-rosie-50 text-rosie-700 dark:bg-rosie-950 dark:text-rosie-200"
                      : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]",
                  )}
                >
                  {DAY_LABEL[d]}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                onClick={saveWorkingDays}
                disabled={savingDays}
                className="text-xs"
              >
                <Save className="h-3 w-3" /> {savingDays ? "Saving…" : "Save"}
              </Button>
              {savedDaysAt ? (
                <span className="text-[10px] text-emerald-600">Saved {savedDaysAt}</span>
              ) : null}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Run planner</h3>
          </CardHeader>
          <CardBody className="space-y-2">
            <Button
              onClick={runPlanner}
              disabled={planning || workingDays.length === 0}
              className="w-full"
            >
              {planning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {planning ? "Planning…" : "Generate weekly plan"}
            </Button>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              Clusters every active customer geographically into{" "}
              <strong>{workingDays.length}</strong> route
              {workingDays.length === 1 ? "" : "s"}. Sizes are balanced so no single day gets
              dramatically more stops than the others.
            </p>
          </CardBody>
        </Card>

        {plan ? (
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold">Proposed day breakdown</h3>
            </CardHeader>
            <CardBody className="space-y-2">
              <ul className="space-y-1">
                {plan.perDay.map((p) => (
                  <li
                    key={p.day}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-3 w-3 rounded-full border-2 border-white shadow"
                        style={{ backgroundColor: DAY_COLOR[p.day] }}
                      />
                      <strong>{DAY_LABEL[p.day]}</strong>
                    </span>
                    <span className="font-mono text-[hsl(var(--muted-foreground))]">
                      {p.count} stop{p.count === 1 ? "" : "s"} · ~
                      {(p.spreadKm * 0.621).toFixed(1)} mi spread
                    </span>
                  </li>
                ))}
              </ul>
              {plan.unmappable.length > 0 ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                  {plan.unmappable.length} customer{plan.unmappable.length === 1 ? "" : "s"}{" "}
                  couldn&apos;t be planned — their addresses aren&apos;t geocoded yet. Open the
                  customer in /customers and re-save with Mapbox configured.
                </div>
              ) : null}
              <Button
                onClick={applyPlan}
                disabled={applying || applied || plan.proposals.length === 0}
                className="w-full"
              >
                {applied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : applying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {applied ? "Applied" : applying ? "Applying…" : "Apply to all customers"}
              </Button>
              {!applied ? (
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  This replaces each customer&apos;s existing service days. You can hand-edit
                  individuals after applying.
                </p>
              ) : null}
            </CardBody>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardBody className="p-0">
          {mapboxToken ? (
            <PlannerMap token={mapboxToken} plan={plan} />
          ) : (
            <div className="px-5 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
              <MapPin className="mx-auto mb-2 h-5 w-5" />
              No <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> set — list view only. The plan still runs
              and applies; you just can&apos;t visualize the clusters yet.
            </div>
          )}
          {plan ? (
            <div className="border-t border-[hsl(var(--border))]">
              <div className="flex items-center gap-2 px-5 py-3">
                <ListOrdered className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                <h3 className="text-sm font-semibold">All proposed assignments</h3>
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  {plan.summary.mappable} mappable · {plan.summary.iterations} iter
                </span>
              </div>
              <ul className="max-h-[360px] divide-y divide-[hsl(var(--border))] overflow-y-auto">
                {plan.proposals.map((p) => (
                  <li
                    key={p.customerId}
                    className="flex items-center justify-between gap-2 px-5 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{p.name}</div>
                      <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                        from{" "}
                        {p.fromDays.length === 0
                          ? "unscheduled"
                          : p.fromDays.map((d) => DAY_LABEL[d]).join(", ")}
                      </div>
                    </div>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                      style={{ backgroundColor: DAY_COLOR[p.toDay] }}
                    >
                      {DAY_LABEL[p.toDay]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Today's route — per-day optimizer (preserved from V1)
// ─────────────────────────────────────────────────────────────────────────────

function TodayRoute({ mapboxToken }: { mapboxToken: string | null }) {
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
  const displayStops = optimized
    ? optimized.stops.map((s) => {
        const original = stops.find((x) => x.id === s.id);
        if (original) return { ...original, lat: s.lat, lng: s.lng };
        return { id: s.id, name: s.name, lat: s.lat, lng: s.lng, hasGeocode: true } as Stop;
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
            <h3 className="text-base font-semibold">Optimize visit order</h3>
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
            {optimized ? (
              <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-2 text-[11px]">
                <div>
                  <strong>{(optimized.distanceMeters / 1609.34).toFixed(1)} mi</strong>{" "}
                  total · ≈ {Math.round(optimized.durationSeconds / 60)} min drive
                </div>
                {optimized.approximate ? (
                  <div className="mt-1 text-amber-700 dark:text-amber-300">
                    Approximate (Mapbox unavailable or &gt;12 stops).
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
            <SingleDayMap
              token={mapboxToken}
              day={day}
              stops={mappable}
              line={optimized?.geometry ?? null}
              order={optimized?.stops.map((s) => s.id) ?? null}
            />
          ) : (
            <div className="px-5 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
              <MapPin className="mx-auto mb-2 h-5 w-5" />
              No <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> set — list view only.
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
                      <span
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ backgroundColor: DAY_COLOR[day] }}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{s.name}</div>
                        <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                          {["city" in s ? s.city : null, "zone" in s ? s.zone : null]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Mapbox loader (shared) + helpers
// ─────────────────────────────────────────────────────────────────────────────

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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Planner map — every customer as a marker colored by proposed day
// ─────────────────────────────────────────────────────────────────────────────

function PlannerMap({ token, plan }: { token: string; plan: PlanResponse | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const moduleRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);
  const [previewStops, setPreviewStops] = useState<
    Array<{ id: string; name: string; lat: number; lng: number; day: Day | null }>
  >([]);

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

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.data) return;
        const out: Array<{ id: string; name: string; lat: number; lng: number; day: Day | null }> =
          [];
        for (const c of j.data as Array<{
          id: string;
          name: string;
          address: { lat?: number; lng?: number } | null;
          serviceDays: Day[];
          status: string;
        }>) {
          if (c.status !== "active") continue;
          if (c.address?.lat == null || c.address?.lng == null) continue;
          out.push({
            id: c.id,
            name: c.name,
            lat: c.address.lat,
            lng: c.address.lng,
            day: c.serviceDays[0] ?? null,
          });
        }
        setPreviewStops(out);
      })
      .catch(() => {});
  }, []);

  const center = useMemo<[number, number]>(() => {
    const src = plan?.proposals.length
      ? plan.proposals.map((p) => ({ lat: p.lat, lng: p.lng }))
      : previewStops.map((s) => ({ lat: s.lat, lng: s.lng }));
    if (src.length === 0) return [-98, 39];
    const lng = src.reduce((a, s) => a + s.lng, 0) / src.length;
    const lat = src.reduce((a, s) => a + s.lat, 0) / src.length;
    return [lng, lat];
  }, [plan, previewStops]);

  useEffect(() => {
    if (!ready || !moduleRef.current || !containerRef.current || mapRef.current) return;
    const mapboxgl = moduleRef.current;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center,
      zoom: previewStops.length > 0 || plan ? 10 : 4,
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    const mapboxgl = moduleRef.current;
    const map = mapRef.current;
    if (!mapboxgl || !map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const stops = plan
      ? plan.proposals.map((p) => ({
          id: p.customerId,
          name: p.name,
          lat: p.lat,
          lng: p.lng,
          day: p.toDay,
        }))
      : previewStops;

    stops.forEach((s) => {
      const color = s.day ? DAY_COLOR[s.day] : "#9ca3af";
      const el = document.createElement("div");
      el.style.cssText = `width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:pointer;`;
      const marker = new mapboxgl.Marker(el)
        .setLngLat([s.lng, s.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 14 }).setHTML(
            `<div style="font-size:13px;font-weight:700;margin-bottom:2px">${escapeHtml(s.name)}</div>` +
              (s.day
                ? `<div style="font-size:11px;color:${color};font-weight:700">→ ${DAY_LABEL[s.day]}</div>`
                : `<div style="font-size:11px;color:#52525b">unscheduled</div>`),
          ),
        )
        .addTo(map);
      markersRef.current.push(marker);
    });

    if (stops.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      stops.forEach((s) => bounds.extend([s.lng, s.lat]));
      map.fitBounds(bounds, { padding: 40, maxZoom: 13, duration: 500 });
    }
  }, [plan, previewStops]);

  return (
    <div className="relative">
      <div ref={containerRef} className="h-[560px] w-full" />
      {plan ? (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2 text-[11px] shadow">
          <div className="mb-1 font-semibold">Legend</div>
          <div className="flex flex-col gap-0.5">
            {plan.perDay.map((p) => (
              <div key={p.day} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full border-2 border-white shadow"
                  style={{ backgroundColor: DAY_COLOR[p.day] }}
                />
                <span>
                  <strong>{DAY_LABEL[p.day]}</strong> · {p.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Single-day map (today's-route mode)
// ─────────────────────────────────────────────────────────────────────────────

function SingleDayMap({
  token,
  day,
  stops,
  line,
  order,
}: {
  token: string;
  day: Day;
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
    if (stops.length === 0) return [-98, 39];
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

  useEffect(() => {
    const mapboxgl = moduleRef.current;
    const map = mapRef.current;
    if (!mapboxgl || !map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const orderedStops = order
      ? order.map((id) => stops.find((s) => s.id === id)).filter((s): s is Stop => Boolean(s))
      : stops;
    const color = DAY_COLOR[day];

    orderedStops.forEach((s, i) => {
      if (s.lng == null || s.lat == null) return;
      const el = document.createElement("div");
      el.style.cssText = `width:26px;height:26px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;box-shadow:0 1px 6px rgba(0,0,0,0.25);border:2px solid #fff;cursor:pointer;`;
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

    if (orderedStops.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      orderedStops.forEach((s) => {
        if (s.lng != null && s.lat != null) bounds.extend([s.lng, s.lat]);
      });
      map.fitBounds(bounds, { padding: 40, maxZoom: 13, duration: 600 });
    }

    const addOrUpdateLine = () => {
      const existing = map.getSource("route-line");
      if (line) {
        const feature = { type: "Feature" as const, properties: {}, geometry: line };
        if (existing) {
          existing.setData(feature);
        } else {
          map.addSource("route-line", { type: "geojson", data: feature });
          map.addLayer({
            id: "route-line",
            type: "line",
            source: "route-line",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": color, "line-width": 4, "line-opacity": 0.7 },
          });
        }
      } else if (existing) {
        if (map.getLayer("route-line")) map.removeLayer("route-line");
        map.removeSource("route-line");
      }
    };

    if (map.isStyleLoaded()) addOrUpdateLine();
    else map.once("style.load", addOrUpdateLine);
  }, [stops, line, order, day]);

  return <div ref={containerRef} className="h-[520px] w-full" />;
}

function currentDay(): Day {
  const idx = new Date().getDay();
  const map: Day[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[idx] ?? "mon";
}
