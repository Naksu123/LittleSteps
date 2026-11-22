"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getDefaultPortalPath } from "@/lib/utils";
import { loginSchema, type LoginFormValues } from "@/lib/validation";
import { ApiError } from "@/services/api";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Mascot } from "@/components/brand/Mascot";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    try {
      const loggedInUser = await login(values.email, values.password);
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
    <div className="min-h-dvh bg-[#FFF9F0] flex flex-col justify-center py-6 sm:py-10 px-3.5 sm:px-6">
      <div className="mx-auto w-full max-w-md space-y-5 sm:space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 min-h-10 text-sm font-bold text-[#24334D]/70 hover:text-[#24334D]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        <div className="flex flex-col items-center gap-3">
          <BrandLogo size="md" />
          <Mascot size="sm" message="Welcome back! Sign in to continue." />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">
              Parent &amp; Guardian Sign In
            </CardTitle>
            <CardDescription>
              Sign in to manage your child&apos;s learning and open the child-safe Kids portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {serverError && (
              <Alert tone="warning" title="Sign In Issue">
                {serverError}
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-bold">
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs font-bold text-[#8E3022]">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-bold">
                  Password
                </label>
                <PasswordInput
                  id="password"
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

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing In..." : "Sign In"}
              </Button>
            </form>

            <p className="text-center text-sm text-[#24334D]/75">
              New parent or guardian?{" "}
              <Link
                href="/register"
                className="font-bold text-[#175B82] hover:underline"
              >
                Create an account
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
