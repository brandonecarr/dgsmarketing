/**
 * Plain-string HTML templates. We keep them in code (not react-email) to
 * avoid a heavy build dep; if we add more than 4–5 templates, swap to
 * @react-email/components.
 */

interface Brand {
  primary?: string;
  displayName: string;
  hidePoweredBy?: boolean;
}

function wrap(brand: Brand, content: string): string {
  const primary = brand.primary ?? "#5b21b6";
  const poweredBy = brand.hidePoweredBy
    ? ""
    : `<p style="margin-top:32px;font-size:11px;color:#9ca3af;text-align:center">Powered by Rosie</p>`;
  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;font-family:-apple-system,Segoe UI,Inter,sans-serif;background:#f7f7fb;color:#0b0b14">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:32px;border:1px solid #e7e7ee">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">
      <div style="width:32px;height:32px;border-radius:8px;background:${primary};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:800">R</div>
      <strong>${escapeHtml(brand.displayName)}</strong>
    </div>
    ${content}
    ${poweredBy}
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function newLeadEmail(opts: {
  brand: Brand;
  leadName: string | null;
  leadPhone: string | null;
  leadEmail: string | null;
  source: string;
  metadata: Record<string, unknown> | null;
  inboxUrl: string;
}): { subject: string; html: string; text: string } {
  const name = opts.leadName ?? opts.leadPhone ?? opts.leadEmail ?? "Unknown";
  const subject = `New lead — ${name}`;
  const meta = opts.metadata
    ? Object.entries(opts.metadata)
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v))}</li>`)
        .join("")
    : "";
  const html = wrap(
    opts.brand,
    `<h1 style="margin:0 0 8px;font-size:22px">New lead from ${escapeHtml(name)}</h1>
     <p style="margin:0 0 16px;color:#52525b">Source: <strong>${escapeHtml(opts.source)}</strong></p>
     <ul style="margin:0 0 16px;padding-left:18px;line-height:1.6">
       ${opts.leadPhone ? `<li><strong>Phone:</strong> ${escapeHtml(opts.leadPhone)}</li>` : ""}
       ${opts.leadEmail ? `<li><strong>Email:</strong> ${escapeHtml(opts.leadEmail)}</li>` : ""}
       ${meta}
     </ul>
     <p><a href="${escapeHtml(opts.inboxUrl)}" style="display:inline-block;background:${opts.brand.primary ?? "#5b21b6"};color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Open in Rosie</a></p>`,
  );
  const text = `New lead from ${name} (source: ${opts.source}).
${opts.leadPhone ? `Phone: ${opts.leadPhone}\n` : ""}${opts.leadEmail ? `Email: ${opts.leadEmail}\n` : ""}
Open: ${opts.inboxUrl}`;
  return { subject, html, text };
}

export function weeklyDigestEmail(opts: {
  brand: Brand;
  rangeLabel: string;
  stats: {
    newLeads: number;
    wonLeads: number;
    inbound: number;
    outbound: number;
    activeActions: number;
  };
  composite: { score: number | null; grade: string | null; pacing: string | null };
  overviewUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `Rosie weekly recap — ${opts.rangeLabel}`;
  const grade = opts.composite.grade ?? "—";
  const html = wrap(
    opts.brand,
    `<h1 style="margin:0 0 8px;font-size:22px">Week in review · ${escapeHtml(opts.rangeLabel)}</h1>
     <p style="margin:0 0 16px;color:#52525b">Composite grade: <strong>${escapeHtml(grade)}</strong></p>
     ${opts.composite.pacing ? `<p style="margin:0 0 16px">${escapeHtml(opts.composite.pacing)}</p>` : ""}
     <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
       ${row("New leads", String(opts.stats.newLeads))}
       ${row("Won leads", String(opts.stats.wonLeads))}
       ${row("Inbound msgs", String(opts.stats.inbound))}
       ${row("Outbound msgs", String(opts.stats.outbound))}
       ${row("Open Action Plan", String(opts.stats.activeActions))}
     </table>
     <p><a href="${escapeHtml(opts.overviewUrl)}" style="display:inline-block;background:${opts.brand.primary ?? "#5b21b6"};color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Open Rosie</a></p>`,
  );
  const text = `Rosie weekly recap — ${opts.rangeLabel}
Grade: ${grade}
New leads: ${opts.stats.newLeads}, Won: ${opts.stats.wonLeads}
Inbound: ${opts.stats.inbound}, Outbound: ${opts.stats.outbound}
Open actions: ${opts.stats.activeActions}
Open: ${opts.overviewUrl}`;
  return { subject, html, text };
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #f1f1f5;color:#52525b">${escapeHtml(label)}</td>
    <td style="padding:8px 0;border-bottom:1px solid #f1f1f5;text-align:right;font-weight:700">${escapeHtml(value)}</td>
  </tr>`;
}
