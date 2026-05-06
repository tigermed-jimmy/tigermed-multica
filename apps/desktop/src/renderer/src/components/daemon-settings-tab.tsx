import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Button } from "@multica/ui/components/ui/button";
import { Switch } from "@multica/ui/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@multica/ui/components/ui/alert-dialog";
import { cn } from "@multica/ui/lib/utils";
import type { DaemonPrefs, DaemonStatus } from "../../../shared/daemon-types";
import {
  DAEMON_STATE_COLORS,
  DAEMON_STATE_LABELS,
  formatUptime,
} from "../../../shared/daemon-types";

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// One row inside the diagnostics block. Values that are likely to be
// long IDs / URLs render as monospaced + truncated with a tooltip.
function DiagnosticsRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] items-baseline gap-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "min-w-0 truncate text-sm",
          mono && "font-mono text-xs",
        )}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </span>
    </div>
  );
}

export function DaemonSettingsTab() {
  const [prefs, setPrefs] = useState<DaemonPrefs>({ autoStart: true, autoStop: false });
  const [cliInstalled, setCliInstalled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<DaemonStatus>({ state: "stopped" });
  const [confirmNewRoot, setConfirmNewRoot] = useState<string | null>(null);

  useEffect(() => {
    window.daemonAPI.getPrefs().then(setPrefs);
    window.daemonAPI.isCliInstalled().then(setCliInstalled);
    window.daemonAPI.getStatus().then(setStatus);
    return window.daemonAPI.onStatusChange(setStatus);
  }, []);

  const updateBoolPref = useCallback(
    async (key: "autoStart" | "autoStop", value: boolean) => {
      setSaving(true);
      const updated = await window.daemonAPI.setPrefs({ [key]: value });
      setPrefs(updated);
      setSaving(false);
    },
    [],
  );

  const handlePickDirectory = useCallback(async () => {
    const result = await window.daemonAPI.pickDirectory();
    if (result.canceled || !result.path) return;
    setConfirmNewRoot(result.path);
  }, []);

  const handleConfirmRootChange = useCallback(async () => {
    if (!confirmNewRoot) return;
    setSaving(true);
    const updated = await window.daemonAPI.setPrefs({ workspacesRoot: confirmNewRoot });
    setPrefs(updated);
    setConfirmNewRoot(null);
    setSaving(false);
    // Restart the daemon so the new workspaces_root takes effect
    if (status.state === "running") {
      await window.daemonAPI.restart();
    }
  }, [confirmNewRoot, status.state]);

  // The effective workspaces root: from daemon status if running, else from prefs
  const effectiveRoot = status.workspacesRoot ?? prefs.workspacesRoot;

  return (
    <div>
      <h2 className="text-lg font-semibold">Daemon</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Configure how the local agent daemon behaves with the desktop app.
      </p>

      <div className="mt-6 divide-y">
        <SettingRow
          label="Auto-start on launch"
          description="Automatically start the daemon when the app opens and you are logged in."
        >
          <Switch
            checked={prefs.autoStart}
            onCheckedChange={(checked) => updateBoolPref("autoStart", checked)}
            disabled={saving}
          />
        </SettingRow>

        <SettingRow
          label="Auto-stop on quit"
          description="Stop the daemon when the desktop app is closed. Disable this to keep the daemon running in the background."
        >
          <Switch
            checked={prefs.autoStop}
            onCheckedChange={(checked) => updateBoolPref("autoStop", checked)}
            disabled={saving}
          />
        </SettingRow>

        <div className="py-4">
          <p className="text-sm font-medium">Repos Storage Location</p>
          <p className="text-sm text-muted-foreground mt-1">
            Directory where workspace repositories and task environments are stored.
            {effectiveRoot && (
              <span className="block mt-1 font-mono text-xs bg-muted/50 px-2 py-1 rounded truncate" title={effectiveRoot}>
                {effectiveRoot}
              </span>
            )}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePickDirectory}
              disabled={saving}
            >
              Change
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Changing this requires a daemon restart. Existing repos will not be moved automatically.
          </p>
        </div>

        <div className="py-4">
          <p className="text-sm font-medium">CLI Status</p>
          <p className="text-sm text-muted-foreground mt-1">
            {cliInstalled === null
              ? "Checking…"
              : cliInstalled
                ? "multica CLI is installed and available in PATH."
                : "multica CLI not found. Install it to enable daemon management."}
          </p>
          {cliInstalled === false && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() =>
                window.desktopAPI.openExternal(
                  "https://github.com/furtherref/multica#cli-installation",
                )
              }
            >
              Installation Guide
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmNewRoot !== null} onOpenChange={(open) => !open && setConfirmNewRoot(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change repos storage location?</AlertDialogTitle>
            <AlertDialogDescription>
              The daemon will store repos and task environments in:{' '}
              <span className="font-mono text-xs bg-muted/50 px-1.5 py-0.5 rounded break-all">
                {confirmNewRoot}
              </span>
              . The daemon will be restarted to apply this change. Existing repos at the current
              location will not be moved automatically — copy them manually if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRootChange} disabled={saving}>
              Change &amp; Restart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diagnostics — moved out of the logs panel so the panel can focus
          on logs. These fields matter for support tickets and bug reports,
          not for everyday use. */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold">Diagnostics</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Identification and connection details. Useful when filing a bug
          report or investigating why a runtime isn&apos;t showing up.
        </p>
        <div className="mt-3 rounded-lg border bg-muted/20 px-4 py-2">
          <DiagnosticsRow
            label="State"
            value={
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    DAEMON_STATE_COLORS[status.state],
                  )}
                />
                {DAEMON_STATE_LABELS[status.state]}
              </span>
            }
          />
          <DiagnosticsRow
            label="Uptime"
            value={status.uptime ? formatUptime(status.uptime) : "—"}
          />
          <DiagnosticsRow
            label="PID"
            value={status.pid ?? "—"}
            mono={!!status.pid}
          />
          <DiagnosticsRow
            label="Daemon ID"
            value={status.daemonId ?? "—"}
            mono={!!status.daemonId}
          />
          <DiagnosticsRow
            label="Profile"
            value={status.profile || "default"}
          />
          <DiagnosticsRow
            label="Server URL"
            value={status.serverUrl ?? "—"}
            mono={!!status.serverUrl}
          />
          <DiagnosticsRow
            label="Device name"
            value={status.deviceName ?? "—"}
          />
          <DiagnosticsRow
            label="Workspaces"
            value={
              typeof status.workspaceCount === "number"
                ? status.workspaceCount
                : "—"
            }
          />
        </div>
      </div>
    </div>
  );
}
