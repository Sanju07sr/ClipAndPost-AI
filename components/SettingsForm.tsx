"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Brain,
  CircleCheck,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LogOut,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type { PlatformId } from "@/lib/types";
import { PlatformBadge } from "./PlatformBadge";

interface Settings {
  anthropic: { source: "website" | "env" | null; hint: string | null; model: string };
  google: { clientId: string | null; secretHint: string | null; clientIdSource: string | null; secretSource: string | null; redirectUri: string };
  meta: { appId: string | null; secretHint: string | null; configId: string | null; saved: boolean };
}

interface Connections {
  platforms: Record<PlatformId, { configured: boolean; connected: boolean; account: string | null; problem?: string | null }>;
  meta: { pages: { id: string; name: string; instagram: string | null }[]; selectedPageId: string | null; redirectUri: string };
  youtube: { redirectUri: string };
}

type Msg = { kind: "ok" | "error"; text: string } | null;

async function saveSettings(body: Record<string, string>): Promise<Settings> {
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
  const [c, setC] = useState<Connections | null>(null);
  const [banner, setBanner] = useState<Msg>(null);

  const reload = useCallback(() => {
    fetch("/api/settings", { cache: "no-store" }).then((r) => r.json()).then(setS).catch(() => undefined);
    fetch("/api/connections", { cache: "no-store" }).then((r) => r.json()).then(setC).catch(() => undefined);
  }, []);
  useEffect(reload, [reload]);

  // Result of a Meta/YouTube sign-in redirect.
  useEffect(() => {
    const url = new URL(window.location.href);
    const provider = url.searchParams.get("connect") || (url.searchParams.get("youtube") ? "youtube" : null);
    if (!provider) return;
    const err = url.searchParams.get("connect_error") || url.searchParams.get("youtube_error");
    const name = provider === "meta" ? "Instagram & Facebook" : "YouTube";
    setBanner(
      err
        ? { kind: "error", text: err === "not-configured" ? `Add the ${name} app keys below first.` : `${name}: ${err}` }
        : { kind: "ok", text: `${name} connected.` },
    );
    window.history.replaceState(null, "", url.pathname);
  }, []);

  if (!s || !c) return <div className="skeleton h-80 rounded-3xl" />;
  return (
    <div className="space-y-10">
      {banner && (
        <div
          className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm ${
            banner.kind === "ok" ? "bg-lime-400/10 text-lime-100 ring-1 ring-lime-400/25" : "bg-rose-500/10 text-rose-100 ring-1 ring-rose-400/25"
          }`}
        >
          {banner.kind === "ok" ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
          <p className="flex-1">{banner.text}</p>
          <button onClick={() => setBanner(null)} className="text-xs opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      <section>
        <SectionTitle title="AI" subtitle="Claude picks the moments, frames the speaker and writes titles." />
        <AnthropicCard s={s} onSaved={setS} />
      </section>

      <section>
        <SectionTitle
          title="Connected accounts"
          subtitle="Connect once, then publish a Short to every platform with one click. Each platform needs a free developer app (one-time setup)."
        />
        <div className="space-y-5">
          <YouTubeCard s={s} c={c} onChange={reload} />
          <MetaCard s={s} c={c} onChange={reload} />
        </div>
      </section>
    </div>
  );
}

// ------------------------------------------------------------ shared UI

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-xl font-semibold text-white">{title}</h2>
      <p className="mt-1 text-ink-300">{subtitle}</p>
    </div>
  );
}

function Card(props: { icon: React.ReactNode; title: string; subtitle: string; status: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass rounded-3xl p-5 sm:p-6">
      <div className="flex items-start gap-3.5">
        {props.icon}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold text-white">{props.title}</h3>
          <p className="text-sm text-ink-300">{props.subtitle}</p>
        </div>
        {props.status}
      </div>
      <div className="mt-5">{props.children}</div>
    </div>
  );
}

function StatusPill({ tone, label }: { tone: "on" | "off" | "warn"; label: string }) {
  const cls =
    tone === "on"
      ? "bg-lime-400/10 text-lime-200 ring-lime-400/25"
      : tone === "warn"
        ? "bg-amber-400/10 text-amber-200 ring-amber-300/25"
        : "bg-white/5 text-ink-300 ring-white/10";
  const dot = tone === "on" ? "bg-lime-400" : tone === "warn" ? "bg-amber-300" : "bg-ink-400";
  return (
    <span className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 sm:inline-flex ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
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

const inputCls =
  "h-11 w-full rounded-xl bg-ink-950/70 px-3.5 font-mono text-sm text-white ring-1 ring-white/10 placeholder:font-sans placeholder:text-ink-400 focus:outline-none focus:ring-brand-pink/60";

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
        className={`${inputCls} pr-10`}
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

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <p className="truncate text-sm">
      <span className="text-ink-400">{label}: </span>
      <span className="font-mono text-ink-100">{value}</span>
    </p>
  );
}

function RedirectUri({ uri }: { uri: string }) {
  return <code className="mt-1 block w-fit max-w-full break-all rounded-lg bg-black/40 px-2 py-1 text-xs text-ink-100">{uri}</code>;
}

/** Two-field app key form (public id + secret) used by every platform card. */
function AppKeys(props: {
  idLabel: string;
  idPlaceholder: string;
  secretLabel: string;
  secretPlaceholder: string;
  idField: string;
  secretField: string;
  currentId: string | null;
  currentSecretHint: string | null;
  removable: boolean;
  onSaved: () => void;
}) {
  const [id, setId] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const hasKeys = Boolean(props.currentId && props.currentSecretHint);
  const [editing, setEditing] = useState(false);
  const showForm = !hasKeys || editing;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, string> = {};
    if (id.trim()) body[props.idField] = id;
    if (secret.trim()) body[props.secretField] = secret;
    if (!Object.keys(body).length) return;
    setBusy(true);
    setMsg(null);
    try {
      await saveSettings(body);
      setId("");
      setSecret("");
      setMsg({ kind: "ok", text: "Saved." });
      setEditing(false);
      props.onSaved();
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Remove these saved app keys?")) return;
    await saveSettings({ [props.idField]: "", [props.secretField]: "" });
    props.onSaved();
  }

  return (
    <div>
      {(props.currentId || props.currentSecretHint) && (
        <div className="mb-3 space-y-1 rounded-xl bg-white/[0.03] px-3.5 py-2.5 ring-1 ring-white/5">
          {props.currentId && <KeyValue label={props.idLabel} value={props.currentId} />}
          {props.currentSecretHint && <KeyValue label={props.secretLabel} value={props.currentSecretHint} />}
          <div className="flex gap-4 pt-1">
            {hasKeys && (
              <button onClick={() => setEditing((e) => !e)} className="text-xs text-ink-300 hover:text-white">
                {editing ? "Cancel" : "Change keys"}
              </button>
            )}
            {props.removable && (
              <button onClick={remove} className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-rose-300">
                <Trash2 className="h-3.5 w-3.5" /> Remove keys
              </button>
            )}
          </div>
        </div>
      )}
      {showForm && (
      <form onSubmit={submit} className="space-y-2">
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder={props.currentId ? `New ${props.idLabel.toLowerCase()} (optional)` : props.idPlaceholder}
          aria-label={props.idLabel}
          autoComplete="off"
          spellCheck={false}
          className={inputCls}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SecretInput
            value={secret}
            onChange={setSecret}
            placeholder={props.currentSecretHint ? `New ${props.secretLabel.toLowerCase()} (optional)` : props.secretPlaceholder}
            label={props.secretLabel}
          />
          <button
            type="submit"
            disabled={(!id.trim() && !secret.trim()) || busy}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-ink-950 transition hover:bg-ink-100 disabled:opacity-40"
          >
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Save keys
          </button>
        </div>
      </form>
      )}
      <Notice msg={msg} />
    </div>
  );
}

function ConnectRow(props: {
  connected: boolean;
  configured: boolean;
  account: string | null;
  problem?: string | null;
  connectHref: string;
  onDisconnect: () => Promise<void>;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  if (!props.configured && !props.connected) {
    return <p className="mt-4 text-sm text-ink-400">Save the app keys above, then connect your account.</p>;
  }
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/5">
      {props.connected ? (
        <>
          <CircleCheck className="h-5 w-5 text-lime-400" />
          <p className="min-w-0 flex-1 text-sm text-ink-100">
            Connected as <b className="text-white">{props.account}</b>
          </p>
          <button
            onClick={async () => {
              if (!confirm(`Disconnect ${props.label}?`)) return;
              setBusy(true);
              await props.onDisconnect();
              setBusy(false);
            }}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-ink-300 ring-1 ring-white/10 transition hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Disconnect
          </button>
        </>
      ) : (
        <>
          <p className="min-w-0 flex-1 text-sm text-ink-300">{props.problem || "Not connected yet."}</p>
          <a
            href={props.connectHref}
            className="bg-brand inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-pink/20 transition hover:brightness-110"
          >
            Connect {props.label}
          </a>
        </>
      )}
    </div>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return (
    <details className="mt-4 text-sm text-ink-300">
      <summary className="cursor-pointer font-medium text-ink-200 hover:text-white">How to get these keys</summary>
      <ol className="mt-3 list-decimal space-y-2 pl-5 leading-relaxed marker:text-ink-400">{children}</ol>
    </details>
  );
}

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a className="inline-flex items-center gap-0.5 text-brand-pink underline" href={href} target="_blank" rel="noreferrer">
    {children} <ExternalLink className="h-3 w-3" />
  </a>
);

// ------------------------------------------------------------ cards

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
      onSaved(await saveSettings({ anthropicApiKey: key }));
      setKey("");
      setMsg({ kind: "ok", text: "Key checked and saved. AI moment picking, speaker framing and titles are on." });
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      icon={
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
          <Brain className="h-5 w-5 text-brand-pink" />
        </span>
      }
      title="Claude AI"
      subtitle="Picks the best moments, keeps the speaker in frame, and writes titles & hashtags."
      status={<StatusPill tone={a.source ? "on" : "off"} label={a.source ? "AI on" : "AI off"} />}
    >
      {a.source && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-white/[0.03] px-3.5 py-2.5 text-sm ring-1 ring-white/5">
          <KeyRound className="h-4 w-4 text-ink-400" />
          <span className="font-mono text-ink-100">{a.hint}</span>
          <span className="text-ink-400">{a.source === "env" ? "from .env.local" : "saved on this computer"}</span>
          {a.source === "website" && (
            <button
              onClick={async () => {
                if (confirm("Remove the saved Anthropic API key?")) onSaved(await saveSettings({ anthropicApiKey: "" }));
              }}
              className="ml-auto inline-flex items-center gap-1 text-xs text-ink-400 hover:text-rose-300"
            >
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
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {busy ? "Checking…" : "Save key"}
        </button>
      </form>
      <Notice msg={msg} />
      <p className="mt-4 text-sm text-ink-400">
        Get a key at <A href="https://console.anthropic.com/settings/keys">console.anthropic.com</A> (add a little credit under Billing first).
        Model: {a.model}.
      </p>
    </Card>
  );
}

function YouTubeCard({ s, c, onChange }: { s: Settings; c: Connections; onChange: () => void }) {
  const p = c.platforms.youtube;
  return (
    <Card
      icon={<PlatformBadge platform="youtube" size="lg" />}
      title="YouTube Shorts"
      subtitle="Uses a Google Cloud OAuth client."
      status={<StatusPill tone={p.connected ? "on" : "off"} label={p.connected ? "Connected" : "Not connected"} />}
    >
      <AppKeys
        idLabel="Client ID"
        idPlaceholder="Client ID: 1234…apps.googleusercontent.com"
        secretLabel="Client secret"
        secretPlaceholder="Client secret: GOCSPX-…"
        idField="googleClientId"
        secretField="googleClientSecret"
        currentId={s.google.clientId}
        currentSecretHint={s.google.secretHint}
        removable={s.google.clientIdSource === "website" || s.google.secretSource === "website"}
        onSaved={onChange}
      />
      <ConnectRow
        label="YouTube"
        configured={p.configured}
        connected={p.connected}
        account={p.account}
        connectHref="/api/youtube/connect?returnTo=/settings"
        onDisconnect={async () => {
          await fetch("/api/youtube/disconnect", { method: "POST" });
          onChange();
        }}
      />
      <Steps>
        <li>
          In <A href="https://console.cloud.google.com/projectcreate">Google Cloud Console</A>, create a project and enable the{" "}
          <A href="https://console.cloud.google.com/apis/library/youtube.googleapis.com">YouTube Data API v3</A>.
        </li>
        <li>
          Under <b>Google Auth Platform</b>, set the consent screen to <b>External</b> and add your Google account as a <b>Test user</b>.
        </li>
        <li>
          Create a <b>Web application</b> OAuth client with this redirect URI:
          <RedirectUri uri={c.youtube.redirectUri} />
        </li>
      </Steps>
    </Card>
  );
}

function ConfigIdField({ current, onSaved }: { current: string | null; onSaved: () => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await saveSettings({ metaConfigId: value });
      setValue("");
      setMsg({ kind: "ok", text: value.trim() ? "Configuration ID saved." : "Configuration ID removed." });
      onSaved();
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-3">
      <label className="mb-1.5 block text-sm text-ink-300">
        Configuration ID <span className="text-ink-400">(from Facebook Login for Business → Configurations; step 6 below)</span>
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={current ? `Current: ${current}. Paste a new one to replace it` : "Configuration ID, e.g. 1234567890123456"}
          aria-label="Configuration ID"
          autoComplete="off"
          spellCheck={false}
          className={inputCls}
        />
        <button
          type="submit"
          disabled={busy || (!value.trim() && !current)}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-ink-950 transition hover:bg-ink-100 disabled:opacity-40"
        >
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {value.trim() || !current ? "Save ID" : "Remove ID"}
        </button>
      </div>
      <Notice msg={msg} />
    </form>
  );
}

/** One numbered step in the Meta setup guide. */
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="relative pl-11">
      <span className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] text-sm font-semibold text-white ring-1 ring-white/15">
        {n}
      </span>
      <p className="font-semibold text-white">{title}</p>
      <div className="mt-1.5 space-y-1.5 leading-relaxed text-ink-300">{children}</div>
    </li>
  );
}

const Btn = ({ children }: { children: React.ReactNode }) => (
  <b className="rounded-md bg-white/[0.07] px-1.5 py-0.5 font-medium text-white ring-1 ring-white/10">{children}</b>
);
const Perm = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-black/40 px-1.5 py-0.5 text-[0.85em] text-pink-200">{children}</code>
);

function MetaGuide({ redirectUri }: { redirectUri: string }) {
  return (
    <details className="group mt-5 rounded-2xl bg-white/[0.02] ring-1 ring-white/[0.07] open:bg-white/[0.03]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3.5 font-medium text-ink-100 hover:text-white">
        Step-by-step setup guide (about 10 minutes)
        <span className="ml-auto text-sm text-ink-400 group-open:hidden">Show</span>
        <span className="ml-auto hidden text-sm text-ink-400 group-open:inline">Hide</span>
      </summary>
      <div className="border-t border-white/[0.06] px-4 pb-5 pt-4">
        <p className="mb-5 text-sm text-ink-400">Based on Meta&apos;s current developer documentation (App Dashboard with use cases, Graph API v27.0).</p>
        <ol className="space-y-6 text-[0.95rem]">
          <Step n={1} title="Get your Instagram ready">
            <p>
              In the Instagram app: <Btn>Settings</Btn> → <Btn>Account type and tools</Btn> → switch to a <b>Professional</b> account
              (Business or Creator). Then link it to your <b>Facebook Page</b> (in the Instagram app under <Btn>Accounts Center</Btn>, or
              from your Facebook Page&apos;s settings → <Btn>Linked accounts</Btn>).
            </p>
          </Step>
          <Step n={2} title="Create the app">
            <p>
              Go to <A href="https://developers.facebook.com/apps">developers.facebook.com/apps</A>, logged in with the Facebook account that
              manages your Page, and click <Btn>Create App</Btn>.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <b>App details:</b> enter an app name (e.g. &quot;My Clipping Site&quot;) and your email → <Btn>Next</Btn>.
              </li>
              <li>
                <b>Use cases:</b> tick <Btn>Manage everything on your Page</Btn> <b>and</b> <Btn>Manage messaging &amp; content on Instagram</Btn> →{" "}
                <Btn>Next</Btn>. (If the second one is greyed out after picking the first, continue with one and add the other later from the
                dashboard&apos;s <Btn>Use cases</Btn> page.)
              </li>
              <li>
                <b>Business:</b> choose <Btn>I don&apos;t want to connect a business portfolio yet</Btn> → <Btn>Next</Btn>.
              </li>
              <li>
                <b>Requirements:</b> <Btn>Next</Btn>. <b>Overview:</b> <Btn>Go to dashboard</Btn>.
              </li>
            </ul>
          </Step>
          <Step n={3} title="Add the Facebook Page permissions">
            <p>
              In the left menu open <Btn>Use cases</Btn>, find <b>Manage everything on your Page</b> and click <Btn>Customize</Btn>. Next to
              these permissions click <Btn>Add</Btn>:
            </p>
            <p className="flex flex-wrap gap-1.5">
              <Perm>pages_manage_posts</Perm>
              <Perm>pages_read_engagement</Perm>
            </p>
            <p className="text-sm text-ink-400">
              <Perm>pages_show_list</Perm> and <Perm>business_management</Perm> are already included.
            </p>
          </Step>
          <Step n={4} title="Add the Instagram permissions">
            <p>
              Back in <Btn>Use cases</Btn>, click <Btn>Customize</Btn> on <b>Manage messaging &amp; content on Instagram</b>. Choose{" "}
              <Btn>API setup with Facebook login</Btn> (not &quot;with Instagram login&quot;), then <Btn>Add</Btn>:
            </p>
            <p className="flex flex-wrap gap-1.5">
              <Perm>instagram_basic</Perm>
              <Perm>instagram_content_publish</Perm>
              <Perm>pages_show_list</Perm>
              <Perm>pages_read_engagement</Perm>
            </p>
          </Step>
          <Step n={5} title="Add the redirect address">
            <p>
              In the left menu open <Btn>Facebook Login for Business</Btn> → <Btn>Settings</Btn>. Under <b>Client OAuth settings</b>, make sure{" "}
              <b>Client OAuth login</b> and <b>Web OAuth login</b> are on, and add this to <b>Valid OAuth redirect URIs</b>, then{" "}
              <Btn>Save changes</Btn>:
            </p>
            <RedirectUri uri={redirectUri} />
            <p className="text-sm text-ink-400">
              If Meta says the address must use https: localhost addresses work while the app is in Development mode, so you can continue.
            </p>
          </Step>
          <Step n={6} title="Create a login configuration">
            <p>
              Open <Btn>Facebook Login for Business</Btn> → <Btn>Configurations</Btn> → <Btn>+ Create configuration</Btn>:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Name it (e.g. &quot;Publish Reels&quot;).</li>
              <li>
                Access token: <Btn>User access token</Btn>, expiration <b>Never</b> (or 60 days).
              </li>
              <li>
                Assets: select <b>Pages</b> and <b>Instagram accounts</b>.
              </li>
              <li>
                Permissions: tick <Perm>pages_show_list</Perm> <Perm>pages_read_engagement</Perm> <Perm>pages_manage_posts</Perm>{" "}
                <Perm>business_management</Perm> <Perm>instagram_basic</Perm> <Perm>instagram_content_publish</Perm> → <Btn>Create</Btn>.
              </li>
            </ul>
            <p>
              Copy the <b>Configuration ID</b> it shows and paste it into the Configuration ID box above.
            </p>
          </Step>
          <Step n={7} title="Copy the App ID and App secret">
            <p>
              Left menu → <Btn>App settings</Btn> → <Btn>Basic</Btn>. Copy the <b>App ID</b> and click <Btn>Show</Btn> next to{" "}
              <b>App secret</b>. Paste both into the boxes above and click <Btn>Save keys</Btn>.
            </p>
          </Step>
          <Step n={8} title="Connect">
            <p>
              Click <Btn>Connect Instagram &amp; Facebook</Btn> above. In Meta&apos;s window, select your Page and Instagram account and allow every
              permission (Meta grants none if any is unticked). You&apos;ll come back here showing your Page and @username.
            </p>
          </Step>
          <Step n={9} title="Make your posts visible to everyone">
            <p>
              New apps start in <b>Development</b> mode, and Meta shows posts made by an app in Development mode only to people with a
              role on the app (you). Post one test Short, then check it from another account. If others can&apos;t see it, switch the app to{" "}
              <b>Live</b> with the <Btn>App Mode</Btn> switch at the top of the dashboard; Meta lists anything still missing there (usually a
              Privacy Policy URL, and for some apps business verification). Posting to your own Page and Instagram doesn&apos;t need App Review.
            </p>
          </Step>
        </ol>
      </div>
    </details>
  );
}

function MetaCard({ s, c, onChange }: { s: Settings; c: Connections; onChange: () => void }) {
  const ig = c.platforms.instagram;
  const fb = c.platforms.facebook;
  const connected = fb.connected || ig.connected;
  const [pageBusy, setPageBusy] = useState(false);

  async function choosePage(pageId: string) {
    setPageBusy(true);
    await fetch("/api/connect/meta/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId }),
    });
    setPageBusy(false);
    onChange();
  }

  return (
    <Card
      icon={
        <span className="flex shrink-0 -space-x-2">
          <PlatformBadge platform="instagram" size="lg" />
          <PlatformBadge platform="facebook" size="lg" />
        </span>
      }
      title="Instagram Reels & Facebook Reels"
      subtitle="One Meta developer app covers both. Instagram must be a Business or Creator account linked to a Facebook Page."
      status={<StatusPill tone={connected ? (ig.connected ? "on" : "warn") : "off"} label={connected ? (ig.connected ? "Connected" : "Facebook only") : "Not connected"} />}
    >
      <AppKeys
        idLabel="App ID"
        idPlaceholder="App ID: 1234567890123456"
        secretLabel="App secret"
        secretPlaceholder="App secret"
        idField="metaAppId"
        secretField="metaAppSecret"
        currentId={s.meta.appId}
        currentSecretHint={s.meta.secretHint}
        removable={s.meta.saved}
        onSaved={onChange}
      />
      {(s.meta.appId || s.meta.configId) && <ConfigIdField current={s.meta.configId} onSaved={onChange} />}
      <ConnectRow
        label="Instagram & Facebook"
        configured={fb.configured}
        connected={connected}
        account={[fb.account, ig.account].filter(Boolean).join(" · ")}
        problem={fb.problem}
        connectHref="/api/connect/meta?returnTo=/settings"
        onDisconnect={async () => {
          await fetch("/api/connect/meta/disconnect", { method: "POST" });
          onChange();
        }}
      />
      {connected && c.meta.pages.length > 0 && (
        <label className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-300">
          Post as
          <select
            value={c.meta.selectedPageId || ""}
            disabled={pageBusy}
            onChange={(e) => choosePage(e.target.value)}
            className="h-10 rounded-xl bg-ink-950/70 px-3 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-brand-pink/60"
          >
            {c.meta.pages.map((pg) => (
              <option key={pg.id} value={pg.id}>
                {pg.name}
                {pg.instagram ? ` + @${pg.instagram}` : " (no Instagram linked)"}
              </option>
            ))}
          </select>
        </label>
      )}
      {ig.problem && connected && <p className="mt-3 text-sm text-amber-200">{ig.problem}</p>}
      <MetaGuide redirectUri={c.meta.redirectUri} />
    </Card>
  );
}
