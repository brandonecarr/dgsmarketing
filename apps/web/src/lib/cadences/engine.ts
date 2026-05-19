import {
  db,
  cadences,
  cadenceRuns,
  leads,
  conversations,
  messages,
  actions,
  integrations,
  type CadenceStep,
} from "@rosie/db";
import { and, asc, desc, eq, gte, isNotNull, lte, or, sql } from "@rosie/db";
import { getProvider } from "@rosie/messaging";
import { decryptJson } from "@/lib/crypto";
import { recordUsage } from "@/lib/usage";
import { isOptedOut } from "@/lib/compliance/sms";

/**
 * Substitute simple template tokens. Keep tight — anything fancier should
 * route through the Rosie agent instead.
 */
function renderTemplate(template: string, leadRow: { name: string | null }): string {
  const first = leadRow.name?.split(" ")[0] ?? "";
  return template
    .replaceAll("{{firstName}}", first)
    .replaceAll("{{name}}", leadRow.name ?? "");
}

/**
 * Enrolls a lead into all cadences matching the given trigger. No-op if there's
 * already an open run for that (cadence, lead). Fires from the lead webhook +
 * the stage-change endpoint.
 */
export async function enrollLead(opts: {
  tenantId: string;
  leadId: string;
  trigger: "lead_created" | "stage_change";
  stage?: string;
}) {
  const matching = await db
    .select()
    .from(cadences)
    .where(
      and(
        eq(cadences.tenantId, opts.tenantId),
        eq(cadences.enabled, true),
        eq(cadences.trigger, opts.trigger),
        opts.trigger === "stage_change" && opts.stage
          ? eq(cadences.triggerStage, opts.stage)
          : sql`true`,
      ),
    );

  const now = new Date();
  for (const cad of matching) {
    if (!cad.steps?.[0]) continue;
    const nextRunAt = new Date(now.getTime() + cad.steps[0].delayHours * 60 * 60 * 1000);
    try {
      await db.insert(cadenceRuns).values({
        tenantId: opts.tenantId,
        cadenceId: cad.id,
        leadId: opts.leadId,
        stepIndex: 0,
        status: "scheduled",
        nextRunAt,
      });
    } catch (e) {
      // Unique index on (cadence_id, lead_id) prevents duplicates. Swallow.
    }
  }
}

/** Stops every running cadence for a lead after a reply arrives. */
export async function stopCadencesForLeadOnReply(tenantId: string, leadId: string) {
  await db
    .update(cadenceRuns)
    .set({ status: "stopped", updatedAt: new Date(), completedAt: new Date() })
    .where(
      and(
        eq(cadenceRuns.tenantId, tenantId),
        eq(cadenceRuns.leadId, leadId),
        or(eq(cadenceRuns.status, "scheduled"), eq(cadenceRuns.status, "running")),
      ),
    );
}

interface ProcessResult {
  processed: number;
  completed: number;
  errored: number;
}

/**
 * Drains the queue of cadence_runs whose `next_run_at` has passed. Runs one
 * step per run, advances or completes. Designed for a cron tick every minute.
 */
export async function processDueCadenceRuns(now = new Date()): Promise<ProcessResult> {
  const due = await db
    .select()
    .from(cadenceRuns)
    .where(
      and(
        eq(cadenceRuns.status, "scheduled"),
        isNotNull(cadenceRuns.nextRunAt),
        lte(cadenceRuns.nextRunAt, now),
      ),
    )
    .orderBy(asc(cadenceRuns.nextRunAt))
    .limit(50);

  const summary: ProcessResult = { processed: 0, completed: 0, errored: 0 };

  for (const run of due) {
    summary.processed += 1;
    try {
      const [cadence] = await db.select().from(cadences).where(eq(cadences.id, run.cadenceId)).limit(1);
      const [lead] = await db.select().from(leads).where(eq(leads.id, run.leadId)).limit(1);
      if (!cadence?.enabled || !lead) {
        await db
          .update(cadenceRuns)
          .set({ status: "stopped", completedAt: now, updatedAt: now })
          .where(eq(cadenceRuns.id, run.id));
        continue;
      }

      // Stop if a reply has come in since the cadence started.
      if (cadence.stopOnReply) {
        const [recentInbound] = await db
          .select({ id: messages.id })
          .from(messages)
          .innerJoin(conversations, eq(conversations.id, messages.conversationId))
          .where(
            and(
              eq(conversations.leadId, lead.id),
              eq(messages.direction, "inbound"),
              gte(messages.createdAt, run.createdAt),
            ),
          )
          .limit(1);
        if (recentInbound) {
          await db
            .update(cadenceRuns)
            .set({ status: "stopped", completedAt: now, updatedAt: now })
            .where(eq(cadenceRuns.id, run.id));
          summary.completed += 1;
          continue;
        }
      }

      const step = cadence.steps?.[run.stepIndex];
      if (!step) {
        await db
          .update(cadenceRuns)
          .set({ status: "completed", completedAt: now, updatedAt: now })
          .where(eq(cadenceRuns.id, run.id));
        summary.completed += 1;
        continue;
      }

      const body = renderTemplate(step.body, { name: lead.name });
      if (step.action === "send_sms") {
        await sendCadenceSms({
          tenantId: run.tenantId,
          lead: { id: lead.id, name: lead.name, phone: lead.phone },
          body,
        });
      } else {
        await db.insert(actions).values({
          tenantId: run.tenantId,
          source: "rosie_suggestion",
          title: body.slice(0, 140),
          body: `Cadence "${cadence.name}" step ${run.stepIndex + 1}`,
          priority: step.priority ?? 5,
          relatedEntityType: "lead",
          relatedEntityId: lead.id,
        });
      }

      const nextStepIndex = run.stepIndex + 1;
      const nextStep: CadenceStep | undefined = cadence.steps?.[nextStepIndex];
      if (!nextStep) {
        await db
          .update(cadenceRuns)
          .set({
            status: "completed",
            completedAt: now,
            lastStepRanAt: now,
            stepIndex: nextStepIndex,
            updatedAt: now,
          })
          .where(eq(cadenceRuns.id, run.id));
        summary.completed += 1;
      } else {
        await db
          .update(cadenceRuns)
          .set({
            status: "scheduled",
            stepIndex: nextStepIndex,
            lastStepRanAt: now,
            nextRunAt: new Date(now.getTime() + nextStep.delayHours * 60 * 60 * 1000),
            updatedAt: now,
          })
          .where(eq(cadenceRuns.id, run.id));
      }
    } catch (e) {
      summary.errored += 1;
      await db
        .update(cadenceRuns)
        .set({
          status: "failed",
          error: e instanceof Error ? e.message : String(e),
          updatedAt: now,
        })
        .where(eq(cadenceRuns.id, run.id));
    }
  }

  return summary;
}

async function sendCadenceSms(opts: {
  tenantId: string;
  lead: { id: string; name: string | null; phone: string | null };
  body: string;
}): Promise<void> {
  if (!opts.lead.phone) throw new Error(`lead ${opts.lead.id} has no phone`);
  if (await isOptedOut(opts.tenantId, opts.lead.phone)) {
    // Silently skip — the cadence run is marked completed so we don't keep retrying.
    return;
  }

  // Find-or-create the conversation for this lead.
  const [conv] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.tenantId, opts.tenantId),
        eq(conversations.leadId, opts.lead.id),
      ),
    )
    .orderBy(desc(conversations.lastMessageAt))
    .limit(1);

  // Pull provider creds.
  const [integ] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.tenantId, opts.tenantId),
        or(eq(integrations.provider, "quo"), eq(integrations.provider, "openphone")),
      ),
    )
    .limit(1);
  if (!integ) throw new Error("no messaging provider connected");

  const providerName = integ.provider as "quo" | "openphone";
  const creds =
    decryptJson<{ apiKey?: string; fromId?: string; fromNumber?: string }>(integ.secrets) ?? {};

  let externalId: string | null = null;
  const sentAt = new Date();
  if (creds.apiKey) {
    const sent = await getProvider(providerName).sendSms(
      { to: opts.lead.phone, body: opts.body },
      { apiKey: creds.apiKey, fromId: creds.fromId, fromNumber: creds.fromNumber },
    );
    externalId = sent.externalId;
  }

  let conversationId = conv?.id;
  if (!conversationId) {
    const [newConv] = await db
      .insert(conversations)
      .values({
        tenantId: opts.tenantId,
        leadId: opts.lead.id,
        channel: "sms",
        provider: providerName,
        participantPhone: opts.lead.phone,
        participantName: opts.lead.name ?? null,
        lastMessageAt: sentAt,
        lastMessagePreview: opts.body.slice(0, 140),
      })
      .returning({ id: conversations.id });
    conversationId = newConv?.id;
  }

  if (!conversationId) throw new Error("could not resolve conversation");

  await db.insert(messages).values({
    tenantId: opts.tenantId,
    conversationId,
    direction: "outbound",
    senderType: "rosie",
    body: opts.body,
    externalId,
    deliveredAt: sentAt,
  });

  await db
    .update(conversations)
    .set({
      lastMessageAt: sentAt,
      lastMessagePreview: opts.body.slice(0, 140),
      unreadCount: 0,
      updatedAt: sentAt,
    })
    .where(eq(conversations.id, conversationId));

  await db
    .update(leads)
    .set({ lastMessageAt: sentAt, updatedAt: sentAt })
    .where(eq(leads.id, opts.lead.id));

  await recordUsage({
    tenantId: opts.tenantId,
    kind: "sms_sent",
    units: 1,
    costUsd: externalId ? Number(process.env.ROSIE_SMS_UNIT_COST_USD ?? 0.01) : 0,
    source: "cadence",
  });
}
