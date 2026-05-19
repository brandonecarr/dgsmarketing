import { Card, CardBody, CardHeader } from "@rosie/ui";
import { loadActiveSession } from "@/lib/active-tenant";
import { CoachingChat } from "./chat";

const PROMPTS = [
  "What's the highest-leverage thing I should focus on this week?",
  "Walk me through my funnel — where am I losing leads?",
  "My CPL is up — diagnose what's likely happening.",
  "Help me think through scaling — what should I do before adding budget?",
];

export default async function CoachingPage() {
  const session = await loadActiveSession();
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Coaching</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Strategic chat with Rosie scoped to one big question at a time. Different from "Talk
            to Rosie" — this is for the back-of-napkin conversation, not the in-line task.
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">Common starters</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {PROMPTS.map((p) => (
              <a
                key={p}
                href={`/coaching?q=${encodeURIComponent(p)}`}
                className="rounded-md border border-[hsl(var(--border))] p-3 text-left text-sm hover:bg-[hsl(var(--muted))]"
              >
                {p}
              </a>
            ))}
          </div>
        </CardBody>
      </Card>

      <CoachingChat tenantName={session.tenant.name} />
    </div>
  );
}
