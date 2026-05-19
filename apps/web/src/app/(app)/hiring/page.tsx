import { db, jobs, jobApplicants } from "@rosie/db";
import { desc, eq, sql } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { HiringView } from "./view";

export default async function HiringPage() {
  const session = await loadActiveSession();
  const rows = await db
    .select()
    .from(jobs)
    .where(eq(jobs.tenantId, session.tenant.id))
    .orderBy(desc(jobs.createdAt));

  const counts = await db
    .select({ jobId: jobApplicants.jobId, count: sql<number>`count(*)::int` })
    .from(jobApplicants)
    .where(eq(jobApplicants.tenantId, session.tenant.id))
    .groupBy(jobApplicants.jobId);
  const countsById = new Map(counts.map((c) => [c.jobId, c.count]));

  return (
    <HiringView
      jobs={rows.map((j) => ({
        id: j.id,
        title: j.title,
        description: j.description,
        compensation: j.compensation,
        status: j.status,
        applicantCount: countsById.get(j.id) ?? 0,
        createdAt: j.createdAt.toISOString(),
      }))}
    />
  );
}
