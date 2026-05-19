import { db, posts } from "@rosie/db";
import { desc, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { PostScheduler } from "./scheduler";

export default async function PostsPage() {
  const session = await loadActiveSession();
  const recent = await db
    .select()
    .from(posts)
    .where(eq(posts.tenantId, session.tenant.id))
    .orderBy(desc(posts.createdAt))
    .limit(50);

  const characters =
    session.profile?.brandVoice?.recurringCharacters?.map((c) => c.name).filter(Boolean) ?? [];

  return (
    <PostScheduler
      hasBrandVoice={Boolean(session.profile?.brandVoice?.storytellingStrategy)}
      tenantName={session.tenant.name}
      characters={characters}
      scheduled={recent
        .filter((p) => p.status === "scheduled" || p.status === "draft")
        .map((p) => ({
          id: p.id,
          platform: p.platform,
          status: p.status,
          body: p.body,
          scheduledFor: p.scheduledFor ? p.scheduledFor.toISOString() : null,
          createdAt: p.createdAt.toISOString(),
        }))}
    />
  );
}
