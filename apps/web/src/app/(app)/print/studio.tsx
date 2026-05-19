"use client";

import { useMemo, useRef, useState } from "react";
import { Download, Printer } from "lucide-react";
import { Card, CardBody, CardHeader, Button, cn } from "@rosie/ui";

type Template = "yard_sign" | "business_card" | "sticker";

interface TemplateDef {
  key: Template;
  label: string;
  dimensions: string;
  printSize: string;
  /** Canvas pixel dimensions for the export. */
  export: { width: number; height: number };
}

const TEMPLATES: TemplateDef[] = [
  { key: "yard_sign", label: "Yard sign", dimensions: "24×18 in", printSize: "Landscape", export: { width: 2400, height: 1800 } },
  { key: "business_card", label: "Business card", dimensions: "3.5×2 in", printSize: "Landscape", export: { width: 1050, height: 600 } },
  { key: "sticker", label: "Sticker", dimensions: "3×3 in", printSize: "Square", export: { width: 900, height: 900 } },
];

interface Defaults {
  category: string;
  phone: string;
  website: string;
  city: string;
  primaryColor: string;
  accentColor: string;
}

export function PrintStudio({ tenantName, defaults }: { tenantName: string; defaults: Defaults }) {
  const [template, setTemplate] = useState<Template>("yard_sign");
  const [name, setName] = useState(tenantName);
  const [headline, setHeadline] = useState("FREE Quote");
  const [subhead, setSubhead] = useState(defaults.category || "Professional service");
  const [cta, setCta] = useState("Call now");
  const [phone, setPhone] = useState(defaults.phone);
  const [website, setWebsite] = useState(defaults.website);
  const [primary, setPrimary] = useState(defaults.primaryColor);
  const [accent, setAccent] = useState(defaults.accentColor);

  const svgRef = useRef<SVGSVGElement>(null);

  const def = useMemo(() => TEMPLATES.find((t) => t.key === template)!, [template]);

  async function downloadPng() {
    if (!svgRef.current) return;
    const xml = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = def.export.width;
      canvas.height = def.export.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${name.toLowerCase().replace(/\s+/g, "-")}-${def.key}.png`;
        a.click();
      }, "image/png");
    };
    img.src = url;
  }

  function downloadSvg() {
    if (!svgRef.current) return;
    const xml = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name.toLowerCase().replace(/\s+/g, "-")}-${def.key}.svg`;
    a.click();
  }

  function printIt() {
    window.print();
  }

  return (
    <div className="space-y-4 print:space-y-0">
      <Card className="print:hidden">
        <CardHeader>
          <h2 className="text-xl font-bold">Print Studio</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Branded yard signs, business cards, and stickers. Download as PNG (high-res) or SVG for
            your printer.
          </p>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-4 print:gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <Card className="print:hidden">
          <CardHeader>
            <h3 className="text-base font-semibold">Template</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTemplate(t.key)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-center text-xs transition",
                    template === t.key
                      ? "border-rosie-600 bg-rosie-50 dark:bg-rosie-950"
                      : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]",
                  )}
                >
                  <div className="font-semibold">{t.label}</div>
                  <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {t.dimensions}
                  </div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Business name" value={name} onChange={setName} />
              <Field label="Headline" value={headline} onChange={setHeadline} />
              <Field label="Sub-headline" value={subhead} onChange={setSubhead} />
              <Field label="CTA" value={cta} onChange={setCta} />
              <Field label="Phone" value={phone} onChange={setPhone} />
              <Field label="Website" value={website} onChange={setWebsite} />
              <ColorField label="Primary color" value={primary} onChange={setPrimary} />
              <ColorField label="Accent color" value={accent} onChange={setAccent} />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={downloadPng}>
                <Download className="h-4 w-4" /> Download PNG
              </Button>
              <Button variant="outline" onClick={downloadSvg}>
                Download SVG
              </Button>
              <Button variant="outline" onClick={printIt}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="print:hidden">
            <h3 className="text-base font-semibold">Preview · {def.label}</h3>
          </CardHeader>
          <CardBody className="flex items-center justify-center bg-neutral-100 p-3 dark:bg-neutral-950 print:bg-white print:p-0">
            <div className="w-full">
              {template === "yard_sign" ? (
                <YardSign
                  ref={svgRef}
                  name={name}
                  headline={headline}
                  subhead={subhead}
                  cta={cta}
                  phone={phone}
                  website={website}
                  primary={primary}
                  accent={accent}
                />
              ) : null}
              {template === "business_card" ? (
                <BusinessCard
                  ref={svgRef}
                  name={name}
                  headline={headline}
                  subhead={subhead}
                  cta={cta}
                  phone={phone}
                  website={website}
                  primary={primary}
                  accent={accent}
                />
              ) : null}
              {template === "sticker" ? (
                <Sticker
                  ref={svgRef}
                  name={name}
                  headline={headline}
                  primary={primary}
                  accent={accent}
                />
              ) : null}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Field({
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
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
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

interface CommonProps {
  name: string;
  headline: string;
  subhead: string;
  cta: string;
  phone: string;
  website: string;
  primary: string;
  accent: string;
}

const YardSign = ({
  name,
  headline,
  subhead,
  cta,
  phone,
  website,
  primary,
  accent,
  ref,
}: CommonProps & { ref: React.Ref<SVGSVGElement> }) => (
  <svg
    ref={ref}
    viewBox="0 0 2400 1800"
    xmlns="http://www.w3.org/2000/svg"
    className="h-auto w-full"
  >
    <rect width="2400" height="1800" fill="#ffffff" />
    <rect x="60" y="60" width="2280" height="1680" rx="40" fill={primary} />
    <rect x="120" y="120" width="2160" height="1560" rx="24" fill="#ffffff" />
    <text
      x="1200"
      y="350"
      textAnchor="middle"
      fontSize="160"
      fontWeight="900"
      fill={primary}
      fontFamily="Inter, system-ui, sans-serif"
    >
      {name}
    </text>
    <rect x="320" y="500" width="1760" height="500" rx="24" fill={accent} />
    <text
      x="1200"
      y="780"
      textAnchor="middle"
      fontSize="260"
      fontWeight="900"
      fill="#ffffff"
      fontFamily="Inter, system-ui, sans-serif"
    >
      {headline}
    </text>
    <text
      x="1200"
      y="950"
      textAnchor="middle"
      fontSize="80"
      fontWeight="700"
      fill="#ffffff"
      fontFamily="Inter, system-ui, sans-serif"
    >
      {subhead}
    </text>
    <text
      x="1200"
      y="1200"
      textAnchor="middle"
      fontSize="140"
      fontWeight="800"
      fill={primary}
      fontFamily="Inter, system-ui, sans-serif"
    >
      {cta}
    </text>
    {phone ? (
      <text
        x="1200"
        y="1380"
        textAnchor="middle"
        fontSize="120"
        fontWeight="800"
        fill="#0b0b14"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {phone}
      </text>
    ) : null}
    {website ? (
      <text
        x="1200"
        y="1560"
        textAnchor="middle"
        fontSize="70"
        fontWeight="600"
        fill="#0b0b14"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {website}
      </text>
    ) : null}
  </svg>
);

const BusinessCard = ({
  name,
  headline,
  subhead,
  cta,
  phone,
  website,
  primary,
  accent,
  ref,
}: CommonProps & { ref: React.Ref<SVGSVGElement> }) => (
  <svg
    ref={ref}
    viewBox="0 0 1050 600"
    xmlns="http://www.w3.org/2000/svg"
    className="h-auto w-full max-w-2xl"
  >
    <rect width="1050" height="600" fill="#ffffff" />
    <rect width="350" height="600" fill={primary} />
    <text
      x="175"
      y="290"
      textAnchor="middle"
      fontSize="48"
      fontWeight="900"
      fill="#ffffff"
      fontFamily="Inter, system-ui, sans-serif"
    >
      {name.split(" ").slice(0, 2).join(" ")}
    </text>
    <rect x="40" y="340" width="270" height="6" fill={accent} />
    <text
      x="175"
      y="400"
      textAnchor="middle"
      fontSize="22"
      fill="rgba(255,255,255,0.85)"
      fontFamily="Inter, system-ui, sans-serif"
    >
      {subhead}
    </text>
    <text
      x="400"
      y="160"
      fontSize="72"
      fontWeight="900"
      fill="#0b0b14"
      fontFamily="Inter, system-ui, sans-serif"
    >
      {headline}
    </text>
    <text
      x="400"
      y="220"
      fontSize="26"
      fill="#52525b"
      fontFamily="Inter, system-ui, sans-serif"
    >
      {cta}
    </text>
    {phone ? (
      <text
        x="400"
        y="380"
        fontSize="36"
        fontWeight="700"
        fill={primary}
        fontFamily="Inter, system-ui, sans-serif"
      >
        {phone}
      </text>
    ) : null}
    {website ? (
      <text
        x="400"
        y="430"
        fontSize="26"
        fill="#0b0b14"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {website}
      </text>
    ) : null}
    <rect x="400" y="500" width="220" height="6" fill={accent} />
  </svg>
);

const Sticker = ({
  name,
  headline,
  primary,
  accent,
  ref,
}: Pick<CommonProps, "name" | "headline" | "primary" | "accent"> & {
  ref: React.Ref<SVGSVGElement>;
}) => (
  <svg
    ref={ref}
    viewBox="0 0 900 900"
    xmlns="http://www.w3.org/2000/svg"
    className="h-auto w-full max-w-md"
  >
    <rect width="900" height="900" fill="#ffffff" />
    <circle cx="450" cy="450" r="430" fill={primary} />
    <circle cx="450" cy="450" r="380" fill="none" stroke={accent} strokeWidth="18" />
    <text
      x="450"
      y="380"
      textAnchor="middle"
      fontSize="100"
      fontWeight="900"
      fill="#ffffff"
      fontFamily="Inter, system-ui, sans-serif"
    >
      {name.split(" ").slice(0, 2).join(" ")}
    </text>
    <rect x="200" y="430" width="500" height="6" fill={accent} />
    <text
      x="450"
      y="560"
      textAnchor="middle"
      fontSize="76"
      fontWeight="800"
      fill={accent}
      fontFamily="Inter, system-ui, sans-serif"
    >
      {headline}
    </text>
  </svg>
);
