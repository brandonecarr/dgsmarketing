import { db, memberships, users, invitations } from "@rosie/db";
import { and, desc, eq, isNull } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { PeopleView } from "./view";

export default async function PeoplePage() {
  const session = await loadActiveSession();

  const members = await db
    .select({
      userId: memberships.userId,
      role: memberships.role,
      email: users.email,
      fullName: users.fullName,
      createdAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.tenantId, session.tenant.id))
    .orderBy(desc(memberships.createdAt));

  const pendingInvites = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.tenantId, session.tenant.id),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
      ),
    )
    .orderBy(desc(invitations.createdAt));

  return (
    <PeopleView
      currentUserId={session.user.id}
      currentUserRole={session.role}
      members={members.map((m) => ({
        userId: m.userId,
        email: m.email,
        fullName: m.fullName,
        role: m.role,
        joinedAt: m.createdAt.toISOString(),
      }))}
      pendingInvites={pendingInvites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt.toISOString(),
      }))}
    />
  );
}
