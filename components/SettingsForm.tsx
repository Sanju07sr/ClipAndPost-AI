"use client";

import { useEffect, useState } from "react";
import { Brain, CircleCheck, ExternalLink, Eye, EyeOff, KeyRound, LoaderCircle, Trash2, TriangleAlert } from "lucide-react";
import { VideoGlyph } from "./Logo";

interface Settings {
  anthropic: { source: "website" | "env" | null; hint: string | null; model: string };
  google: {
    clientId: string | null;
    clientIdSource: "website" | "env" | null;
    secretSource: "website" | "env" | null;
    secretHint: string | null;
    redirectUri: string;
  };
}

type Msg = { kind: "ok" | "error"; text: string } | null;

async function save(body: Record<string, string>): Promise<Settings> {
  const res = await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Couldn't save");
  return data as Settings;
}

export function SettingsForm() {
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then(setS)
      .catch(() => undefined);
  }, []);

  if (!s) return <div className="skeleton h-64 rounded-3xl" />;
  return (
    <div className="space-y-6">
      <AnthropicCard s={s} onSaved={setS} />
      <GoogleCard s={s} onSaved={setS} />
    </div>
  );
}

function Card(props: { icon: React.ReactNode; title: string; subtitle: string; status: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="glass rounded-3xl p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">{props.icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold text-white">{props.title}</h2>
          <p className="text-sm text-ink-300">{props.subtitle}</p>
        </div>
        {props.status}
      </div>
      <div className="mt-5">{props.children}</div>
    </section>
  );
}

function StatusPill({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex ${
        on ? "bg-lime-400/10 text-lime-200 ring-1 ring-lime-400/25" : "bg-white/5 text-ink-300 ring-1 ring-white/10"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-lime-400" : "bg-ink-400"}`} />
      {label}
    </span>
  );
}

function Notice({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p className={`mt-3 flex items-start gap-2 text-sm ${msg.kind === "ok" ? "text-lime-200" : "text-rose-300"}`} role="status">
      {msg.kind === "ok" ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
      {msg.text}
    </p>
  );
}

function SecretInput(props: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative flex-1">
      <input
        type={show ? "text" : "password"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        aria-label={props.label}
        autoComplete="off"
        spellCheck={false}
        className="h-11 w-full rounded-xl bg-ink-950/70 pl-3.5 pr-10 font-mono text-sm text-white ring-1 ring-white/10 placeholder:font-sans placeholder:text-ink-400 focus:outline-none focus:ring-brand-pink/60"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-400 hover:text-white"
        aria-label={show ? "Hide" : "Show"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function AnthropicCard({ s, onSaved }: { s: Settings; onSaved: (s: Settings) => void }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const a = s.anthropic;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      onSaved(await save({ anthropicApiKey: key }));
      setKey("");
      setMsg({ kind: "ok", text: "Key checked and saved. AI moment picking, speaker framing and YouTube titles are on." });
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Remove the saved Anthropic API key?")) return;
    setBusy(true);
    try {
      onSaved(await save({ anthropicApiKey: "" }));
      setMsg({ kind: "ok", text: "Key removed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      icon={<Brain className="h-5 w-5 text-brand-pink" />}
      title="Claude AI"
      subtitle="Picks the best moments, keeps the speaker in frame, and writes YouTube titles & hashtags."
      status={<StatusPill on={Boolean(a.source)} label={a.source ? "AI on" : "AI off"} />}
    >
      {a.source && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-white/[0.03] px-3.5 py-2.5 text-sm ring-1 ring-white/5">
          <KeyRound className="h-4 w-4 text-ink-400" />
          <span className="font-mono text-ink-100">{a.hint}</span>
          <span className="text-ink-400">{a.source === "env" ? "from .env.local" : "saved on this computer"}</span>
          {a.source === "website" && (
            <button onClick={remove} disabled={busy} className="ml-auto inline-flex items-center gap-1 text-xs text-ink-400 hover:text-rose-300">
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          )}
        </div>
      )}
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <SecretInput value={key} onChange={setKey} placeholder={a.source ? "Paste a new key to replace it" : "sk-ant-…"} label="Anthropic API key" />
        <button
          type="submit"
          disabled={!key.trim() || busy}
          className="bg-brand flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Checking…" : "Save key"}
        </button>
      </form>
      <Notice msg={msg} />
      <p className="mt-4 text-xs leading-relaxed text-ink-400">
        Get a key at{" "}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand-pink underline">
          console.anthropic.com <ExternalLink className="h-3 w-3" />
        </a>{" "}
        (add a little credit under Billing first). Usage is billed by Anthropic; each video typically costs a few cents. Model: {a.model}.
      </p>
    </Card>
  );
}

function GoogleCard({ s, onSaved }: { s: Settings; onSaved: (s: Settings) => void }) {
  const g = s.google;
  const [clientId, setClientId] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const ready = Boolean(g.clientId && g.secretSource);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, string> = {};
    if (clientId.trim()) body.googleClientId = clientId;
    if (secret.trim()) body.googleClientSecret = secret;
    if (!Object.keys(body).length) return;
    setBusy(true);
    setMsg(null);
    try {
      const next = await save(body);
      onSaved(next);
      setClientId("");
      setSecret("");
      setMsg(
        next.google.clientId && next.google.secretSource
          ? { kind: "ok", text: "Saved. Open any finished video and click Connect YouTube." }
          : { kind: "ok", text: "Saved. Add the other value too to finish." },
      );
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Remove the saved Google client ID and secret?")) return;
    setBusy(true);
    try {
      onSaved(await save({ googleClientId: "", googleClientSecret: "" }));
      setMsg({ kind: "ok", text: "Removed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      icon={<VideoGlyph className="h-5 w-5 text-red-500" />}
      title="YouTube publishing"
      subtitle="A Google OAuth client lets the site upload Shorts to your channel."
      status={<StatusPill on={ready} label={ready ? "Ready" : "Not set up"} />}
    >
      {(g.clientId || g.secretHint) && (
        <div className="mb-4 space-y-1.5 rounded-xl bg-white/[0.03] px-3.5 py-2.5 text-sm ring-1 ring-white/5">
          {g.clientId && (
            <p className="truncate">
              <span className="text-ink-400">Client ID: </span>
              <span className="font-mono text-ink-100">{g.clientId}</span>
            </p>
          )}
          {g.secretHint && (
            <p>
              <span className="text-ink-400">Secret: </span>
              <span className="font-mono text-ink-100">{g.secretHint}</span>
            </p>
          )}
          {(g.clientIdSource === "website" || g.secretSource === "website") && (
            <button onClick={remove} disabled={busy} className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-rose-300">
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          )}
        </div>
      )}
      <form onSubmit={submit} className="space-y-2">
        <input
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder={g.clientId ? "New client ID (optional)" : "Client ID: 1234…apps.googleusercontent.com"}
          aria-label="Google client ID"
          autoComplete="off"
          spellCheck={false}
          className="h-11 w-full rounded-xl bg-ink-950/70 px-3.5 font-mono text-sm text-white ring-1 ring-white/10 placeholder:font-sans placeholder:text-ink-400 focus:outline-none focus:ring-brand-pink/60"
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SecretInput value={secret} onChange={setSecret} placeholder={g.secretHint ? "New client secret (optional)" : "Client secret: GOCSPX-…"} label="Google client secret" />
          <button
            type="submit"
            disabled={(!clientId.trim() && !secret.trim()) || busy}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
          >
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Save
          </button>
        </div>
      </form>
      <Notice msg={msg} />
      <details className="mt-4 text-sm text-ink-300">
        <summary className="cursor-pointer text-ink-200 hover:text-white">How to get these (about 5 minutes)</summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 leading-relaxed marker:text-ink-400">
          <li>
            In{" "}
            <a className="text-brand-pink underline" href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">
              Google Cloud Console
            </a>
            , create a project.
          </li>
          <li>
            Enable the{" "}
            <a className="text-brand-pink underline" href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer">
              YouTube Data API v3
            </a>
            .
          </li>
          <li>
            Under <b>Google Auth Platform</b>, set up the consent screen as <b>External</b> and add your Google account as a <b>Test user</b>.
          </li>
          <li>
            Under <b>Clients</b>, create a <b>Web application</b> client with this authorised redirect URI:
            <code className="mt-1 block w-fit rounded-lg bg-black/40 px-2 py-1 text-xs text-ink-100">{g.redirectUri}</code>
          </li>
          <li>Copy the client ID and secret into the boxes above.</li>
        </ol>
      </details>
    </Card>
  );
}
