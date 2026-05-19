import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { db, invitations, memberships, tenants } from "@rosie/db";
import { and, eq, gt, isNull } from "@rosie/db";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const [invite] = await db
    .select({
      invite: invitations,
      tenant: tenants,
    })
    .from(invitations)
    .innerJoin(tenants, eq(tenants.id, invitations.tenantId))
    .where(
      and(
        eq(invitations.tokenHash, tokenHash),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!invite) {
    return (
      <div className="grid min-h-screen place-items-center p-8 text-center">
        <div className="max-w-md">
          <h1 className="text-xl font-semibold">This invite isn't valid</h1>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            It may have expired, been revoked, or already been used. Ask the inviter to send a new one.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    // Send the user through sign-in with `?next=` back here.
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  // Email must match the invited address.
  if (data.user.email?.toLowerCase() !== invite.invite.email.toLowerCase()) {
    return (
      <div className="grid min-h-screen place-items-center p-8 text-center">
        <div className="max-w-md">
          <h1 className="text-xl font-semibold">Wrong account</h1>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            This invite is for <strong>{invite.invite.email}</strong>. You're signed in as{" "}
            <strong>{data.user.email}</strong>.
          </p>
          <form action="/auth/signout" method="post" className="mt-4">
            <button className="rounded-md bg-rosie-600 px-4 py-2 text-sm font-semibold text-white">
              Sign out and try again
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Accept: create the membership + mark the invitation used.
  await db
    .insert(memberships)
    .values({
      tenantId: invite.invite.tenantId,
      userId: data.user.id,
      role: invite.invite.role,
    })
    .onConflictDoNothing();
  await db
    .update(invitations)
    .set({ acceptedAt: new Date() })
    .where(eq(invitations.id, invite.invite.id));

  redirect("/overview");
}
