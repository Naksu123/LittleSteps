"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getDefaultPortalPath } from "@/lib/utils";
import { staffLoginSchema, type StaffLoginFormValues } from "@/lib/validation";
import { ApiError } from "@/services/api";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

export default function StaffGatePage() {
  const router = useRouter();
  const { staffLogin } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StaffLoginFormValues>({
    resolver: zodResolver(staffLoginSchema),
    defaultValues: { email: "", password: "", access_code: "" },
  });

  async function onSubmit(values: StaffLoginFormValues) {
    setServerError(null);
    try {
      const loggedInUser = await staffLogin(
        values.email,
        values.password,
        values.access_code
      );
      router.push(getDefaultPortalPath(loggedInUser.roles));
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError("Unable to reach the LittleSteps server. Please try again.");
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#FFF9F0] flex flex-col justify-center py-10 px-4">
      <div className="mx-auto w-full max-w-md space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#24334D]/70 hover:text-[#24334D]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        <div className="flex flex-col items-center gap-3">
          <BrandLogo size="md" />
          <Badge variant="lavender" className="px-3.5 py-1 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            Restricted Staff Portal
          </Badge>
        </div>

        <Card className="border-2 border-[#24334D]/12">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Lock className="h-5 w-5 text-[#24334D]" />
              Authorized Staff Sign In
            </CardTitle>
            <CardDescription>
              Private access for verified LittleSteps teachers and school administrators only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {serverError && (
              <Alert tone="warning" title="Access Denied">
                {serverError}
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="staff_email" className="text-sm font-bold">
                  Email Address
                </label>
                <Input
                  id="staff_email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@school.edu"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs font-bold text-[#8E3022]">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="staff_password" className="text-sm font-bold">
                  Password
                </label>
                <PasswordInput
                  id="staff_password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-xs font-bold text-[#8E3022]">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="staff_access_code" className="text-sm font-bold">
                  Staff Access Code
                </label>
                <PasswordInput
                  id="staff_access_code"
                  autoComplete="off"
                  placeholder="Enter private access code"
                  showLabel="Show staff access code"
                  hideLabel="Hide staff access code"
                  {...register("access_code")}
                />
                {errors.access_code && (
                  <p className="text-xs font-bold text-[#8E3022]">
                    {errors.access_code.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Verifying Access..." : "Enter Staff Portal"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
