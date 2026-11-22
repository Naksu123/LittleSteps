"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { registerSchema, type RegisterFormValues } from "@/lib/validation";
import { ApiError } from "@/services/api";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerParent } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      confirm_password: "",
      privacy_consent_accepted: false,
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    setServerError(null);
    try {
      await registerParent({
        full_name: values.full_name,
        email: values.email,
        password: values.password,
        privacy_consent_accepted: values.privacy_consent_accepted,
      });
      router.push("/parent");
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError("Unable to create your account right now.");
      }
    }
  }

  return (
    <div className="min-h-dvh bg-[#FFF9F0] flex flex-col justify-center py-6 sm:py-10 px-3.5 sm:px-6">
      <div className="mx-auto w-full max-w-md space-y-5">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 min-h-10 text-sm font-bold text-[#24334D]/70 hover:text-[#24334D]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        <div className="flex justify-center">
          <BrandLogo size="md" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">
              Parent &amp; Guardian Sign Up
            </CardTitle>
            <CardDescription>
              Create a parent-managed account to add your kindergarten learner
              and access weekly Home Learning Guides.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {serverError && (
              <Alert tone="warning" title="Registration Error">
                {serverError}
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="full_name" className="text-sm font-bold">
                  Full Name
                </label>
                <Input
                  id="full_name"
                  placeholder="Maria Reyes"
                  {...register("full_name")}
                />
                {errors.full_name && (
                  <p className="text-xs font-bold text-[#8E3022]">
                    {errors.full_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reg_email" className="text-sm font-bold">
                  Email Address
                </label>
                <Input
                  id="reg_email"
                  type="email"
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
                <label htmlFor="reg_password" className="text-sm font-bold">
                  Password (8+ characters)
                </label>
                <PasswordInput
                  id="reg_password"
                  autoComplete="new-password"
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
                <label htmlFor="confirm_password" className="text-sm font-bold">
                  Confirm Password
                </label>
                <PasswordInput
                  id="confirm_password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  showLabel="Show confirm password"
                  hideLabel="Hide confirm password"
                  {...register("confirm_password")}
                />
                {errors.confirm_password && (
                  <p className="text-xs font-bold text-[#8E3022]">
                    {errors.confirm_password.message}
                  </p>
                )}
              </div>

              <div className="rounded-2xl bg-[#DDF8EC]/60 border border-[#9BE7C4] p-3.5 space-y-2">
                <label className="flex items-start gap-2.5 text-xs text-[#24334D] cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded accent-[#24334D]"
                    {...register("privacy_consent_accepted")}
                  />
                  <span>
                    <strong className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-[#166041]" />
                      Child Privacy Consent (RA 10173):
                    </strong>{" "}
                    I confirm I am the parent or legal guardian and consent to
                    LittleSteps storing minimal learner nicknames and progress
                    in a private, ad-free environment.
                  </span>
                </label>
                {errors.privacy_consent_accepted && (
                  <p className="text-xs font-bold text-[#8E3022]">
                    {errors.privacy_consent_accepted.message}
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
                {isSubmitting ? "Creating Account..." : "Create Parent Account"}
              </Button>
            </form>

            <p className="text-center text-sm text-[#24334D]/75">
              Already registered?{" "}
              <Link
                href="/login"
                className="font-bold text-[#175B82] hover:underline"
              >
                Sign In
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
