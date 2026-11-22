"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Save, Search, Settings, Shield } from "lucide-react";
import { formatShortDate } from "@/lib/utils";
import { adminApi, ApiError } from "@/services/api";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PortalShell } from "@/components/layout/PortalShell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuditLogItem, PlatformSetting } from "@/types";

function AdminSettingsAuditPageContent() {
  const [settingsList, setSettingsList] = useState<PlatformSetting[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Per-setting JSON draft edits
  const [jsonDrafts, setJsonDrafts] = useState<Record<string, string>>({});
  const [descDrafts, setDescDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // New setting form
  const [newKey, setNewKey] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newJson, setNewJson] = useState('{"enabled": true}');

  // Audit filters
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [limit, setLimit] = useState(30);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [s, logs] = await Promise.all([
        adminApi.settings(),
        adminApi.auditLogs({
          limit,
          action: actionFilter || undefined,
          resource_type: resourceFilter || undefined,
        }),
      ]);
      setSettingsList(s);
      const nextJson: Record<string, string> = {};
      const nextDesc: Record<string, string> = {};
      for (const item of s) {
        nextJson[item.key] = JSON.stringify(item.value_json, null, 2);
        nextDesc[item.key] = item.description ?? "";
      }
      setJsonDrafts(nextJson);
      setDescDrafts(nextDesc);
      setAuditLogs(logs);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not load platform settings and audit logs."
      );
    } finally {
      setLoading(false);
    }
  }, [actionFilter, limit, resourceFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function saveSettingObject(
    key: string,
    valueObj: Record<string, unknown>,
    description?: string
  ) {
    setSavingKey(key);
    setError(null);
    setToast(null);
    try {
      await adminApi.upsertSetting(key, {
        value_json: valueObj,
        description,
      });
      setToast(`Saved setting "${key}".`);
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : `Could not save setting "${key}".`
      );
    } finally {
      setSavingKey(null);
    }
  }

  async function handleSaveSettingJson(key: string) {
    try {
      const parsed = JSON.parse(jsonDrafts[key] || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setError(`Setting "${key}" must be a valid JSON object.`);
        return;
      }
      await saveSettingObject(
        key,
        parsed as Record<string, unknown>,
        descDrafts[key] || undefined
      );
    } catch {
      setError(`Invalid JSON format for "${key}".`);
    }
  }

  async function handleCreateSetting(e: React.FormEvent) {
    e.preventDefault();
    const cleanedKey = newKey.trim().toLowerCase();
    if (!/^[a-z0-9_.-]{2,100}$/.test(cleanedKey)) {
      setError(
        "Setting key must use 2-100 lowercase letters, numbers, dots, dashes, or underscores."
      );
      return;
    }
    try {
      const parsed = JSON.parse(newJson);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setError("Setting value must be a JSON object.");
        return;
      }
      await saveSettingObject(
        cleanedKey,
        parsed as Record<string, unknown>,
        newDesc.trim() || undefined
      );
      setNewKey("");
      setNewDesc("");
      setNewJson('{"enabled": true}');
    } catch {
      setError("New setting JSON is invalid.");
    }
  }

  const privacySetting = settingsList.find(
    (s) => s.key === "child_privacy_mode"
  );
  const uploadSetting = settingsList.find((s) => s.key === "max_upload_mb");

  return (
    <PortalShell
      title="Platform Settings & Security Audit"
      subtitle="Manage school-wide child privacy defaults, upload policies, and filter immutable audit logs."
    >
      {error && (
        <Alert tone="warning" title="Notice">
          {error}
        </Alert>
      )}
      {toast && (
        <Alert tone="success" title="Saved">
          {toast}
        </Alert>
      )}

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          {/* Quick Policy Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {privacySetting && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="h-5 w-5 text-[#166041]" />
                    Child Privacy & RA 10173 Guard
                  </CardTitle>
                  <CardDescription>
                    {privacySetting.description ||
                      "Enforce child PII minimization and guardian consent."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="flex items-center justify-between rounded-2xl bg-[#FFF9F0] px-4 py-3 text-sm font-bold border border-[#24334D]/8 cursor-pointer">
                    <span>Strict Child Privacy Mode</span>
                    <input
                      type="checkbox"
                      checked={Boolean(privacySetting.value_json.strict)}
                      disabled={savingKey === "child_privacy_mode"}
                      onChange={(e) =>
                        saveSettingObject(
                          "child_privacy_mode",
                          {
                            ...privacySetting.value_json,
                            strict: e.target.checked,
                          },
                          privacySetting.description ?? undefined
                        )
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-2xl bg-[#FFF9F0] px-4 py-3 text-sm font-bold border border-[#24334D]/8 cursor-pointer">
                    <span>RA 10173 Guardian Consent Enforcement</span>
                    <input
                      type="checkbox"
                      checked={Boolean(
                        privacySetting.value_json.ra_10173_compliant
                      )}
                      disabled={savingKey === "child_privacy_mode"}
                      onChange={(e) =>
                        saveSettingObject(
                          "child_privacy_mode",
                          {
                            ...privacySetting.value_json,
                            ra_10173_compliant: e.target.checked,
                          },
                          privacySetting.description ?? undefined
                        )
                      }
                    />
                  </label>
                </CardContent>
              </Card>
            )}

            {uploadSetting && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings className="h-5 w-5 text-[#175B82]" />
                    Media Upload Limit Policy
                  </CardTitle>
                  <CardDescription>
                    {uploadSetting.description ||
                      "Maximum size (MB) for teacher lesson media uploads."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-[#24334D]/75 block mb-1">
                      Max Upload Size (MB)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={Number(uploadSetting.value_json.limit ?? 10)}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 10;
                        setSettingsList((prev) =>
                          prev.map((item) =>
                            item.key === "max_upload_mb"
                              ? { ...item, value_json: { ...item.value_json, limit: val } }
                              : item
                          )
                        );
                      }}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    disabled={savingKey === "max_upload_mb"}
                    onClick={() =>
                      saveSettingObject(
                        "max_upload_mb",
                        uploadSetting.value_json,
                        uploadSetting.description ?? undefined
                      )
                    }
                  >
                    <Save className="h-4 w-4" />
                    Update Limit
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* All Platform Settings JSON Editor & Create */}
          <Card>
            <CardHeader>
              <CardTitle>All Configuration Keys</CardTitle>
              <CardDescription>
                Create or fine-tune JSON configuration values stored in PostgreSQL.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settingsList.map((setting) => (
                <div
                  key={setting.key}
                  className="rounded-3xl border border-[#24334D]/10 bg-[#FFF9F0] p-4 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="lavender">{setting.key}</Badge>
                    <span className="text-xs text-[#24334D]/60">
                      Updated {formatShortDate(setting.updated_at)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                    <Input
                      value={descDrafts[setting.key] ?? ""}
                      placeholder="Description..."
                      onChange={(e) =>
                        setDescDrafts((prev) => ({
                          ...prev,
                          [setting.key]: e.target.value,
                        }))
                      }
                    />
                    <textarea
                      rows={2}
                      value={jsonDrafts[setting.key] ?? "{}"}
                      onChange={(e) =>
                        setJsonDrafts((prev) => ({
                          ...prev,
                          [setting.key]: e.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 py-2 text-xs font-mono"
                    />
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={savingKey === setting.key}
                        onClick={() => handleSaveSettingJson(setting.key)}
                      >
                        <Save className="h-3.5 w-3.5" />
                        Save JSON
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              <form
                onSubmit={handleCreateSetting}
                className="rounded-3xl border border-dashed border-[#24334D]/20 bg-white p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
              >
                <div>
                  <label className="text-xs font-bold block mb-1">
                    New Setting Key
                  </label>
                  <Input
                    placeholder="daily_star_cap"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">
                    Description
                  </label>
                  <Input
                    placeholder="Optional description"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">
                    JSON Object Value
                  </label>
                  <Input
                    value={newJson}
                    onChange={(e) => setNewJson(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <Button type="submit" variant="secondary">
                  <Plus className="h-4 w-4" />
                  Add / Upsert Setting
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Filterable Audit Logs */}
          <Card>
            <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-[#4C328B]" />
                  Security Audit Logs ({auditLogs.length})
                </CardTitle>
                <CardDescription>
                  Filter administrative actions, logins, content changes, and policy edits.
                </CardDescription>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void loadData();
                }}
                className="flex flex-wrap items-center gap-2"
              >
                <div className="relative w-full sm:w-48">
                  <Search className="h-4 w-4 absolute left-3.5 top-3.5 text-[#24334D]/50" />
                  <Input
                    placeholder="Action (e.g. admin.)"
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <select
                  aria-label="Filter by resource type"
                  value={resourceFilter}
                  onChange={(e) => setResourceFilter(e.target.value)}
                  className="h-11 rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
                >
                  <option value="">All Resources</option>
                  <option value="user">user</option>
                  <option value="class">class</option>
                  <option value="subject">subject</option>
                  <option value="lesson">lesson</option>
                  <option value="theme">theme</option>
                  <option value="platform_setting">platform_setting</option>
                  <option value="child_artwork">child_artwork</option>
                  <option value="lesson_resource">lesson_resource</option>
                </select>
                <select
                  aria-label="Audit log limit"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="h-11 rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
                >
                  <option value={30}>30 rows</option>
                  <option value={50}>50 rows</option>
                  <option value={100}>100 rows</option>
                </select>
                <Button type="submit" variant="secondary">
                  Apply Filters
                </Button>
              </form>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {auditLogs.length === 0 ? (
                <p className="text-sm text-[#24334D]/65 py-6 text-center">
                  No audit events match your current filters.
                </p>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl bg-[#FFF9F0] px-4 py-3 text-xs border border-[#24334D]/8"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="sky">{log.action}</Badge>
                        <span className="font-bold text-[#24334D]">
                          {log.actor_email || "system"}
                        </span>
                        <span className="text-[#24334D]/65">
                          on {log.resource_type}
                          {log.resource_id ? ` (${log.resource_id})` : ""}
                        </span>
                      </div>
                      {Object.keys(log.details_json || {}).length > 0 && (
                        <p className="font-mono text-[11px] text-[#24334D]/60">
                          {JSON.stringify(log.details_json)}
                        </p>
                      )}
                    </div>
                    <span className="text-[#24334D]/60 shrink-0">
                      {formatShortDate(log.created_at)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PortalShell>
  );
}

export default function AdminSettingsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminSettingsAuditPageContent />
    </ProtectedRoute>
  );
}
