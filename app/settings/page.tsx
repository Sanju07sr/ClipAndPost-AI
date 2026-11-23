import { SettingsForm } from "@/components/SettingsForm";

export const metadata = { title: "Settings · ClipAndPost AI" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-tight text-white">Settings</h1>
      <p className="mt-2 text-ink-300">
        Keys are saved on this computer only, in <code className="rounded bg-white/5 px-1 text-ink-200">data/settings.json</code>.
        They are never shown again in full or uploaded anywhere else.
      </p>
      <div className="mt-8">
        <SettingsForm />
      </div>
    </div>
  );
}
