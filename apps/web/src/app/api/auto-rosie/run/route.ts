import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db, actions, autoRosieRuns, metricsSnapshots, businessProfile, tenants, sql } from "@rosie/db";
import { eq } from "@rosie/db";
import { explainAction } from "@rosie/ai";
import { ALL_RULES } from "@/lib/auto-rosie/rules";
import { computeGaugeCluster } from "@/lib/gauges/compute";
import { loadActiveSession } from "@/lib/active-tenant";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface RunSummary {
  tenantId: string;
  ruleResults: Array<{
    rule: string;
    emitted: number;
    durationMs: number;
    skipped?: string;
  }>;
  actionsCreated: number;
  snapshotId: string | null;
}

async function authorize(req: Request): Promise<{ tenantId: string; useExplain: boolean }> {
  // Cron path: `Authorization: Bearer <CRON_SECRET>` + body `{ tenantId }`.
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    const body = (await req.clone().json().catch(() => ({}))) as { tenantId?: string };
    if (!body.tenantId) throw new Error("cron run requires tenantId in body");
    return { tenantId: body.tenantId, useExplain: true };
  }
  // Operator path: session-authenticated, runs on the current tenant.
  const session = await loadActiveSession();
  return { tenantId: session.tenant.id, useExplain: true };
}

export async function POST(req: Request) {
  let tenantId: string;
  let useExplain = true;
  try {
    const auth = await authorize(req);
    tenantId = auth.tenantId;
    useExplain = auth.useExplain;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unauthorized" },
      { status: 401 },
    );
  }

  // Pull minimal tenant context for the explainer.
  const [tenantRow] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!tenantRow) return NextResponse.json({ error: "unknown tenant" }, { status: 404 });
  const [profileRow] = await db
    .select({
      category: businessProfile.category,
      address: businessProfile.address,
      services: businessProfile.services,
    })
    .from(businessProfile)
    .where(eq(businessProfile.tenantId, tenantId))
    .limit(1);

  const ctx = {
    tenantName: tenantRow.name,
    category: profileRow?.category ?? undefined,
    city: profileRow?.address?.city ?? undefined,
    services: profileRow?.services ?? undefined,
  };

  const summary: RunSummary = {
    tenantId,
    ruleResults: [],
    actionsCreated: 0,
    snapshotId: null,
  };
  const now = new Date();

  // 1) Run rules. Each rule logs its own row in auto_rosie_runs.
  for (const rule of ALL_RULES) {
    const result = await rule.run({ tenantId, now });
    let createdCount = 0;
    for (const emission of result.emissions) {
      const draft = emission.action;
      let body = draft.body;
      if (useExplain && process.env.ANTHROPIC_API_KEY) {
        try {
          const explained = await explainAction({
            context: ctx,
            signal: {
              rule: result.rule,
              inputs: result.inputs,
              relatedEntity:
                draft.relatedEntityId && draft.relatedEntityType
                  ? { type: draft.relatedEntityType, id: draft.relatedEntityId }
                  : null,
            },
            draft: { title: draft.title, body: draft.body },
          });
          if (explained.body) body = explained.body;
          if (explained.why) {
            draft.metadata = { ...(draft.metadata ?? {}), why: explained.why };
          }
        } catch {
          // fall back silently to the rule's default body
        }
      }

      const [row] = await db
        .insert(actions)
        .values({
          tenantId,
          source: draft.source,
          title: draft.title,
          body,
          priority: draft.priority,
          relatedEntityType: draft.relatedEntityType,
          relatedEntityId: draft.relatedEntityId,
          metadata: draft.metadata,
        })
        .returning({ id: actions.id });

      await db.insert(autoRosieRuns).values({
        tenantId,
        ruleName: result.rule,
        status: "success",
        inputs: result.inputs,
        outputs: { actionId: row?.id, title: draft.title },
        diff: result.diff,
        undoToken: randomUUID(),
        relatedEntityType: draft.relatedEntityType,
        relatedEntityId: draft.relatedEntityId,
        actionId: row?.id,
        durationMs: result.durationMs.toString(),
      });
      createdCount += 1;
    }

    // If the rule emitted nothing, still log a "skipped" row so the audit log is complete.
    if (result.emissions.length === 0) {
      await db.insert(autoRosieRuns).values({
        tenantId,
        ruleName: result.rule,
        status: "skipped",
        inputs: result.inputs,
        error: result.skipReason ?? null,
        durationMs: result.durationMs.toString(),
      });
    }

    summary.ruleResults.push({
      rule: result.rule,
      emitted: createdCount,
      durationMs: result.durationMs,
      skipped: result.emissions.length === 0 ? result.skipReason ?? "no emissions" : undefined,
    });
    summary.actionsCreated += createdCount;
  }

  // 2) Snapshot today's gauges (upsert on (tenant_id, snapshot_date)).
  const cluster = await computeGaugeCluster(tenantId, now);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);

  await db
    .insert(metricsSnapshots)
    .values({
      tenantId,
      snapshotDate: today,
      paidScore: cluster.paid.score,
      paidStatus: cluster.paid.status,
      organicScore: cluster.organic.score,
      organicStatus: cluster.organic.status,
      websiteScore: cluster.website.score,
      websiteStatus: cluster.website.status,
      kpisScore: cluster.kpis.score,
      kpisStatus: cluster.kpis.status,
      compositeScore: cluster.composite,
      compositeGrade: cluster.grade,
      pacingHeadline: cluster.pacingHeadline,
      breakdown: {
        paid: cluster.paid,
        organic: cluster.organic,
        website: cluster.website,
        kpis: cluster.kpis,
      },
    })
    .onConflictDoUpdate({
      target: [metricsSnapshots.tenantId, metricsSnapshots.snapshotDate],
      set: {
        paidScore: cluster.paid.score,
        paidStatus: cluster.paid.status,
        organicScore: cluster.organic.score,
        organicStatus: cluster.organic.status,
        websiteScore: cluster.website.score,
        websiteStatus: cluster.website.status,
        kpisScore: cluster.kpis.score,
        kpisStatus: cluster.kpis.status,
        compositeScore: cluster.composite,
        compositeGrade: cluster.grade,
        pacingHeadline: cluster.pacingHeadline,
        breakdown: {
          paid: cluster.paid,
          organic: cluster.organic,
          website: cluster.website,
          kpis: cluster.kpis,
        },
      },
    });

  const [snap] = await db
    .select({ id: metricsSnapshots.id })
    .from(metricsSnapshots)
    .where(eq(metricsSnapshots.tenantId, tenantId))
    .orderBy(sql`${metricsSnapshots.snapshotDate} desc`)
    .limit(1);
  summary.snapshotId = snap?.id ?? null;

  return NextResponse.json({ ok: true, summary, cluster });
}

export async function GET(req: Request) {
  // GET form for cron schedulers that prefer GET; same behaviour.
  return POST(req);
}
