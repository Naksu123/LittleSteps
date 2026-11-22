"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getDefaultPortalPath } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserRole } from "@/types";

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl p-4 sm:p-8 space-y-6">
        <Skeleton className="h-14 w-56 sm:w-64 max-w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const hasPermission = user.roles.some((r) => allowedRoles.includes(r));
  if (!hasPermission) {
    const portalHome = getDefaultPortalPath(user.roles);
    return (
      <div className="min-h-dvh flex items-center justify-center p-4 sm:p-6 bg-[#FFF9F0]">
        <Card className="max-w-md w-full border-2 border-[#FF9C8C]/50">
          <CardContent className="p-6 sm:p-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FFE3DE] text-[#8E3022]">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h1 className="font-display text-2xl font-semibold">
              Portal Access Restricted
            </h1>
            <p className="text-sm text-[#24334D]/75">
              Your account ({user.roles.join(", ")}) does not have access to this
              section. Let&apos;s head back to your dashboard.
            </p>
            <Link href={portalHome} className="inline-block">
              <Button variant="secondary">Go to My Portal</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
