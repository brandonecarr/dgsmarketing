"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CirclePlus, Copy, QrCode as QrIcon } from "lucide-react";
import { Card, CardBody, CardHeader, Button } from "@rosie/ui";

interface QrRow {
  id: string;
  code: string;
  name: string;
  destinationUrl: string;
  scanCount: number;
  lastScanAt: string | null;
  trackingUrl: string;
  pngUrl: string | null;
}

export function QrStudio({ recent }: { recent: QrRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("Review request card");
  const [destinationUrl, setDestinationUrl] = useState("https://example.com/reviews");
  const [color, setColor] = useState("#0b0b14");
  const [background, setBackground] = useState("#ffffff");
  const [frameText, setFrameText] = useState("Scan for a free quote");
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<QrRow | null>(recent[0] ?? null);

  async function create() {
    if (!name || !destinationUrl) return;
    setCreating(true);
    try {
      const res = await fetch("/api/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, destinationUrl, color, background, frameText }),
      });
      const json = (await res.json()) as { qr?: QrRow; error?: string };
      if (!res.ok || !json.qr) {
        alert(json.error ?? `Create failed (${res.status})`);
        return;
      }
      setPreview(json.qr);
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">QR Studio</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Create branded QR codes for print materials, leave-behinds, cards, signs, wraps, and
            takeaways. Every scan redirects through Rosie so performance is tracked.
          </p>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Create QR Code</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            <Field label="Name" value={name} onChange={setName} />
            <Field
              label="Destination URL"
              value={destinationUrl}
              onChange={setDestinationUrl}
              placeholder="https://example.com/reviews"
            />
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              The QR points to a Rosie tracking URL, then redirects here.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <ColorField label="QR Color" value={color} onChange={setColor} />
              <ColorField label="Background" value={background} onChange={setBackground} />
            </div>
            <Field
              label="Frame Text"
              value={frameText}
              onChange={setFrameText}
              placeholder="Scan for a free quote"
            />
            <Button onClick={create} disabled={creating} className="w-full">
              <CirclePlus className="h-4 w-4" />
              {creating ? "Generating…" : "Generate Tracked QR"}
            </Button>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardBody>
              {preview?.pngUrl ? (
                <div className="space-y-3">
                  <img
                    src={preview.pngUrl}
                    alt={preview.name}
                    className="mx-auto w-full max-w-md rounded-md border border-[hsl(var(--border))] bg-white p-4"
                  />
                </div>
              ) : (
                <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-[hsl(var(--border))] text-sm text-[hsl(var(--muted-foreground))]">
                  <QrIcon className="mr-2 h-4 w-4" />
                  Create a QR to preview it here.
                </div>
              )}
            </CardBody>
          </Card>

          {preview ? <DetailCard qr={preview} /> : null}
        </div>
      </div>

      {recent.length > 0 ? (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">QR Codes</h3>
          </CardHeader>
          <CardBody>
            <ul className="divide-y divide-[hsl(var(--border))]">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="grid grid-cols-1 items-center gap-3 py-3 md:grid-cols-[48px_1fr_auto_auto]"
                >
                  {r.pngUrl ? (
                    <img
                      src={r.pngUrl}
                      alt=""
                      className="h-12 w-12 rounded border border-[hsl(var(--border))]"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded border border-dashed border-[hsl(var(--border))]" />
                  )}
                  <div className="min-w-0">
                    <button
                      onClick={() => setPreview(r)}
                      className="block text-left text-sm font-semibold text-rosie-700 hover:underline"
                    >
                      {r.name}
                    </button>
                    <div className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">
                      {r.destinationUrl}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{r.scanCount}</div>
                    <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                      scans
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <a
                      href={r.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-[hsl(var(--border))] px-2 py-1 text-xs hover:bg-[hsl(var(--muted))]"
                    >
                      Test
                    </a>
                    {r.pngUrl ? (
                      <a
                        href={r.pngUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md bg-rosie-600 px-2 py-1 text-xs font-semibold text-white"
                      >
                        PNG
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function DetailCard({ qr }: { qr: QrRow }) {
  return (
    <Card>
      <CardBody className="space-y-2 text-sm">
        <div className="font-semibold">{qr.name}</div>
        <div className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100 w-fit">
          {qr.scanCount} scan{qr.scanCount === 1 ? "" : "s"}
        </div>
        <Detail label="Tracking URL" value={qr.trackingUrl} copyable />
        <Detail label="Destination" value={qr.destinationUrl} />
        {qr.lastScanAt ? (
          <Detail
            label="Last scan"
            value={new Date(qr.lastScanAt).toLocaleString()}
          />
        ) : null}
      </CardBody>
    </Card>
  );
}

function Detail({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="break-all font-mono text-xs">{value}</div>
        {copyable ? (
          <button
            onClick={() => navigator.clipboard?.writeText(value)}
            className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
            aria-label="Copy"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 cursor-pointer rounded-md border border-[hsl(var(--border))] bg-transparent"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-rosie-500"
        />
      </div>
    </label>
  );
}
