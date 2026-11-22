"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AnimalAudioAuditPanel } from "@/components/admin/AnimalAudioAuditPanel";
import { PortalShell } from "@/components/layout/PortalShell";

export default function AdminAudioAuditPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "teacher"]}>
      <PortalShell
        title="Animal Audio QA & Preview Studio"
        subtitle="Audition every animal sound, check clarity and loudness, and verify assets before publishing."
      >
        <AnimalAudioAuditPanel />
      </PortalShell>
    </ProtectedRoute>
  );
}
