"use client";

import { useEffect, useState } from "react";
import { Copy, Key, Plus, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, Button } from "@rosie/ui";

interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export function ApiKeysCard() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/api-keys");
    const j = await r.json();
    setKeys(j.keys ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name) return;
    setCreating(true);
    setSecret(null);
    try {
      const r = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await r.json();
      if (!r.ok || !j.key) {
        alert(j.error ?? "Create failed");
        return;
      }
      setSecret(j.key.secret);
      setName("");
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this API key? It will stop working immediately.")) return;
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <Card id="api-keys">
      <CardHeader>
        <h3 className="text-base font-semibold">API Keys</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Use these with the public API: send <code>Authorization: Bearer rosie_…</code> to <code>/api/v1/*</code>.
          The plaintext secret is shown <strong>only once</strong> — copy it somewhere safe.
        </p>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Key name (e.g. zapier, internal-import)"
            className="rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
          />
          <Button onClick={create} disabled={creating || !name}>
            <Plus className="h-4 w-4" /> {creating ? "Creating…" : "Create key"}
          </Button>
        </div>

        {secret ? (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs dark:border-emerald-900 dark:bg-emerald-950">
            <div className="mb-1 font-semibold text-emerald-900 dark:text-emerald-100">
              Your new API key (shown once)
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-white/40 px-2 py-1 font-mono">
                {secret}
              </code>
              <button
                onClick={() => navigator.clipboard?.writeText(secret)}
                className="rounded-md border border-emerald-700/20 bg-white/40 px-2 py-1 hover:bg-white/70"
                aria-label="Copy"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}

        {keys.length === 0 ? (
          <div className="rounded-md border border-dashed border-[hsl(var(--border))] p-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
            No API keys yet.
          </div>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border))]">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center gap-3 py-2 text-sm">
                <Key className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">
                    {k.name}
                    {k.revokedAt ? (
                      <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800 dark:bg-red-950 dark:text-red-100">
                        revoked
                      </span>
                    ) : null}
                  </div>
                  <div className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
                    {k.prefix}… · last used{" "}
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "never"}
                  </div>
                </div>
                {!k.revokedAt ? (
                  <button
                    onClick={() => revoke(k.id)}
                    className="rounded-md border border-[hsl(var(--border))] p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    aria-label="Revoke"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
