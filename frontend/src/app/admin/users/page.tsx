"use client";

import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Edit3, Plus, Search, ShieldAlert, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatShortDate } from "@/lib/utils";
import {
  adminCreateUserSchema,
  type AdminCreateUserFormValues,
} from "@/lib/validation";
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
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminUser, UserRole } from "@/types";

const ALL_ROLES: UserRole[] = ["parent", "teacher", "admin"];

function AdminUsersContent() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Role/name editor modal
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editRoles, setEditRoles] = useState<UserRole[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdminCreateUserFormValues>({
    resolver: zodResolver(adminCreateUserSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      role: "teacher",
    },
  });

  const loadUsers = useCallback(
    async (opts?: { search?: string; role?: string; status?: string }) => {
      setError(null);
      try {
        const s = opts?.search ?? search;
        const r = opts?.role ?? roleFilter;
        const st = opts?.status ?? statusFilter;
        const list = await adminApi.users({
          search: s || undefined,
          role: r || undefined,
          is_active: st === "" ? undefined : st === "true",
        });
        setUsers(list);
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : "Failed to load user directory."
        );
      } finally {
        setLoading(false);
      }
    },
    [roleFilter, search, statusFilter]
  );

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function onCreateUser(values: AdminCreateUserFormValues) {
    setError(null);
    setToast(null);
    try {
      const created = await adminApi.createUser({
        full_name: values.full_name,
        email: values.email,
        password: values.password,
        role: values.role,
        is_active: true,
      });
      reset({ full_name: "", email: "", password: "", role: "teacher" });
      setToast(`Created account for ${created.full_name} (${created.roles.join(", ")}).`);
      await loadUsers();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not create user account."
      );
    }
  }

  async function handleToggleStatus(target: AdminUser) {
    setUpdatingId(target.id);
    setError(null);
    setToast(null);
    try {
      await adminApi.updateUserStatus(target.id, !target.is_active);
      setToast(
        `${target.full_name} is now ${!target.is_active ? "active" : "inactive"}.`
      );
      await loadUsers();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not update account status."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  function openEditModal(target: AdminUser) {
    setEditingUser(target);
    setEditFullName(target.full_name);
    setEditRoles([...target.roles]);
  }

  function toggleEditRole(role: UserRole) {
    if (!editingUser) return;
    if (editingUser.id === currentUser?.id && role === "admin") {
      return;
    }
    setEditRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  async function handleSaveEdit() {
    if (!editingUser) return;
    if (editRoles.length === 0) {
      setError("Each account must have at least one role assigned.");
      return;
    }
    if (editFullName.trim().length < 2) {
      setError("Full name must be at least 2 characters.");
      return;
    }

    setSavingEdit(true);
    setError(null);
    setToast(null);
    try {
      await adminApi.updateUser(editingUser.id, {
        full_name: editFullName.trim(),
        roles: editRoles,
      });
      setToast(`Updated ${editFullName.trim()}'s profile and roles.`);
      setEditingUser(null);
      await loadUsers();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not update user roles."
      );
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <PortalShell
      title="Users & Role Management"
      subtitle="Provision parent, teacher, and administrator accounts cleanly with RBAC safeguards."
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

      {/* Create User Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[#175B82]" />
            Create Staff or Guardian Account
          </CardTitle>
          <CardDescription>
            Role profiles are provisioned automatically upon account creation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onCreateUser)}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-start"
          >
            <div>
              <label className="text-xs font-bold text-[#24334D]/75 block mb-1">
                Full Name
              </label>
              <Input
                placeholder="Teacher Ana Santos"
                {...register("full_name")}
              />
              {errors.full_name && (
                <p className="text-xs text-[#A32E24] mt-1">
                  {errors.full_name.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-[#24334D]/75 block mb-1">
                Email Address
              </label>
              <Input
                type="email"
                placeholder="ana@littlesteps.edu"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-[#A32E24] mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-[#24334D]/75 block mb-1">
                Temporary Password
              </label>
              <PasswordInput
                placeholder="Min 8 characters"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-[#A32E24] mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-[#24334D]/75 block mb-1">
                Primary Role
              </label>
              <select
                {...register("role")}
                className="h-11 w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
              >
                <option value="teacher">Teacher</option>
                <option value="parent">Parent / Guardian</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div className="pt-5">
              <Button
                type="submit"
                variant="secondary"
                disabled={isSubmitting}
                className="w-full"
              >
                <Plus className="h-4 w-4" />
                {isSubmitting ? "Creating..." : "Create Account"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Filter & Directory */}
      <Card>
        <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#175B82]" />
              Account Directory ({users.length})
            </CardTitle>
            <CardDescription>
              Filter accounts by name, email, role, or activation state.
            </CardDescription>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void loadUsers();
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <div className="relative w-full sm:w-56">
              <Search className="h-4 w-4 absolute left-3.5 top-3.5 text-[#24334D]/50" />
              <Input
                placeholder="Search name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                void loadUsers({ role: e.target.value });
              }}
              className="h-11 rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
            >
              <option value="">All Roles</option>
              <option value="parent">Parent</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
            <select
              aria-label="Filter by active status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                void loadUsers({ status: e.target.value });
              }}
              className="h-11 rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
            >
              <option value="">All Statuses</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
            <Button type="submit" variant="secondary" size="md">
              Search
            </Button>
          </form>
        </CardHeader>

        <CardContent className="overflow-x-auto">
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : users.length === 0 ? (
            <p className="text-sm text-[#24334D]/65 py-6 text-center">
              No accounts matched your current search or role filter.
            </p>
          ) : (
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-[#24334D]/10 text-xs uppercase text-[#24334D]/60">
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4">Email</th>
                  <th className="py-3 pr-4">Roles</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Last Login</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-[#24334D]/6 last:border-none"
                    >
                      <td className="py-3 pr-4 font-bold">{u.full_name}</td>
                      <td className="py-3 pr-4 text-[#24334D]/75">{u.email}</td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <Badge key={r} variant="lavender" className="capitalize">
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={u.is_active ? "mint" : "coral"}>
                          {u.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-xs text-[#24334D]/65">
                        {formatShortDate(u.last_login_at)}
                      </td>
                      <td className="py-3 text-right space-x-2 whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(u)}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit Roles
                        </Button>
                        <Button
                          variant={u.is_active ? "outline" : "mint"}
                          size="sm"
                          disabled={isSelf || updatingId === u.id}
                          onClick={() => handleToggleStatus(u)}
                        >
                          {isSelf
                            ? "Current Admin"
                            : u.is_active
                              ? "Deactivate"
                              : "Activate"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Edit Name / Roles Modal */}
      <Dialog
        open={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        title={`Edit Account — ${editingUser?.full_name ?? ""}`}
        description="Update display name and role permissions safely."
      >
        {editingUser && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#24334D]/75 block mb-1">
                Full Name
              </label>
              <Input
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
              />
            </div>

            <div>
              <p className="text-xs font-bold text-[#24334D]/75 mb-2">
                Assigned Roles
              </p>
              <div className="flex flex-wrap gap-3">
                {ALL_ROLES.map((role) => {
                  const checked = editRoles.includes(role);
                  const locked =
                    editingUser.id === currentUser?.id && role === "admin";
                  return (
                    <label
                      key={role}
                      className="flex items-center gap-2 rounded-2xl border-2 border-[#24334D]/10 px-3.5 py-2 text-sm font-bold capitalize cursor-pointer bg-[#FFF9F0]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={locked}
                        onChange={() => toggleEditRole(role)}
                      />
                      {role}
                    </label>
                  );
                })}
              </div>
              {editingUser.id === currentUser?.id && (
                <p className="text-xs text-[#24334D]/65 mt-2 flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5 text-[#9A7100]" />
                  Current administrator role cannot be removed from yourself.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                disabled={savingEdit}
                onClick={handleSaveEdit}
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </PortalShell>
  );
}

export default function AdminUsersPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminUsersContent />
    </ProtectedRoute>
  );
}
