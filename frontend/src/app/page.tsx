import Link from "next/link";
import {
  ArrowRight,
  Cloud,
  Heart,
  Home,
  Palette,
  Sparkles,
  Users,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Mascot } from "@/components/brand/Mascot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const MODULES = [
  {
    name: "Alphabet & Language",
    desc: "Phonics, letter discovery, and joyful story comprehension.",
    color: "#DCF2FD",
    icon: "🔤",
  },
  {
    name: "Mathematics",
    desc: "Counting 1–20, patterns, shapes, and playful visual objects.",
    color: "#FFF5CF",
    icon: "🔢",
  },
  {
    name: "Science & Discovery",
    desc: "Animals, plants, seasons, space, and five-senses exploration.",
    color: "#DDF8EC",
    icon: "🌱",
  },
  {
    name: "Social & Emotional",
    desc: "Naming feelings, kindness, sharing, and building confidence.",
    color: "#EDE7FE",
    icon: "💛",
  },
  {
    name: "Arts & Creativity",
    desc: "Digital coloring, music, shapes art, and imagination.",
    color: "#FFE3DE",
    icon: "🎨",
  },
  {
    name: "Life Skills",
    desc: "Healthy routines, tidying toys, safety, and independence.",
    color: "#DCF2FD",
    icon: "☀️",
  },
];

const PORTALS = [
  {
    title: "Kids Learning Portal",
    desc: "Large touch cards, voice-guided narration, weekly dynamic 12-question games, zero ads, and encouraging rewards for ages 4–6.",
    badge: "Ages 4–6",
    color: "#FFE58A",
    icon: Sparkles,
  },
  {
    title: "Parent & Guardian Hub",
    desc: "Weekly Home Learning Guides, screen-free Color Hunts, progress insights, and goal setting.",
    badge: "Home Learning",
    color: "#FF9C8C",
    icon: Home,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FFF9F0] text-[#24334D]">
      {/* Header */}
      <header className="border-b border-[#24334D]/8 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-5 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandLogo size="sm" />
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="md">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="primary" size="md">
                Parent Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 py-12 sm:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7 space-y-6">
          <Badge variant="mint" className="text-sm px-4 py-1.5">
            <Cloud className="h-4 w-4" />
            Built for Early Childhood & AWS Cloud Scale
          </Badge>
          <h1 className="font-display text-4xl sm:text-5xl font-bold leading-tight">
            Playful Learning for{" "}
            <span className="text-[#175B82] underline decoration-[#FFE58A] decoration-6 underline-offset-4">
              Ages 4–6
            </span>
            , Guided Together at Home.
          </h1>
          <p className="text-base sm:text-lg text-[#24334D]/80 max-w-xl leading-relaxed">
            LittleSteps brings together joyful preschool lessons, voice-guided
            activities, weekly dynamic games, and practical Home Learning Guides
            for parents in one child-safe cloud platform.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/login">
              <Button variant="kids" size="kid">
                Start Learning
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="outline" size="lg">
                Create Parent Account
              </Button>
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5">
          <Card className="bg-gradient-to-br from-[#DCF2FD] via-white to-[#FFF5CF] border-2 border-[#78C8F5]/30 p-6 sm:p-8">
            <div className="space-y-6">
              <Mascot
                size="lg"
                message="Hi! I'm Pip the Owl! Ready to explore colors, letters, and friendly numbers today?"
              />
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-2xl bg-white p-4 shadow-xs">
                  <p className="font-display text-2xl font-bold text-[#175B82]">
                    12 Weeks
                  </p>
                  <p className="text-xs font-bold text-[#24334D]/65">
                    Home Learning Themes
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-xs">
                  <p className="font-display text-2xl font-bold text-[#8E3022]">
                    16 Games
                  </p>
                  <p className="text-xs font-bold text-[#24334D]/65">
                    Encouraging Activities
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Portals */}
      <section className="mx-auto max-w-6xl px-5 py-10 space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="font-display text-3xl font-bold">
            Designed for Kids & Families
          </h2>
          <p className="text-sm sm:text-base text-[#24334D]/75">
            An uncluttered, child-safe experience built around joyful discovery,
            positive encouragement, and home learning.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto gap-5">
          {PORTALS.map((portal) => {
            const Icon = portal.icon;
            return (
              <Card key={portal.title} className="overflow-hidden">
                <div
                  className="h-2.5 w-full"
                  style={{ backgroundColor: portal.color }}
                />
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div
                      className="h-11 w-11 rounded-2xl flex items-center justify-center"
                      style={{ backgroundColor: `${portal.color}55` }}
                    >
                      <Icon className="h-5 w-5 text-[#24334D]" />
                    </div>
                    <Badge variant="neutral">{portal.badge}</Badge>
                  </div>
                  <h3 className="font-display text-lg font-semibold">
                    {portal.title}
                  </h3>
                  <p className="text-sm text-[#24334D]/75 leading-relaxed">
                    {portal.desc}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 6 Learning Modules */}
      <section className="mx-auto max-w-6xl px-5 py-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-3xl font-bold">
              Six Kindergarten Learning Modules
            </h2>
            <p className="text-sm sm:text-base text-[#24334D]/75">
              Developmentally aligned early childhood curriculum stored in the
              cloud database.
            </p>
          </div>
          <Badge variant="sunshine">Ages 4–6 Developmental Fit</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {MODULES.map((mod) => (
            <Card key={mod.name} className="hover:translate-y-[-2px] transition-transform">
              <CardContent className="p-6 flex items-start gap-4">
                <div
                  className="h-14 w-14 shrink-0 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ backgroundColor: mod.color }}
                >
                  {mod.icon}
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold">
                    {mod.name}
                  </h3>
                  <p className="text-sm text-[#24334D]/75 mt-1">{mod.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Home Learning Hub + AWS Summary */}
      <section className="mx-auto max-w-6xl px-5 py-10 grid grid-cols-1 lg:grid-cols-2 gap-6 pb-16">
        <Card className="bg-[#FFE3DE]/45 border-2 border-[#FF9C8C]/40">
          <CardContent className="p-7 space-y-4">
            <Badge variant="coral">Featured: Home Learning Hub</Badge>
            <h3 className="font-display text-2xl font-bold">
              Week 1: Colors Around Us — Color Hunt
            </h3>
            <p className="text-sm text-[#24334D]/80 leading-relaxed">
              Parents don&apos;t just see numbers—they get step-by-step,
              10-minute screen-free household activities like finding three red
              objects together and celebrating discoveries.
            </p>
            <div className="flex items-center gap-4 text-xs font-bold text-[#24334D]/70 pt-1">
              <span className="inline-flex items-center gap-1">
                <Heart className="h-4 w-4 text-[#8E3022]" /> Play-Based
              </span>
              <span className="inline-flex items-center gap-1">
                <Palette className="h-4 w-4 text-[#8E3022]" /> Household Items
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-4 w-4 text-[#8E3022]" /> Parent Guided
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#DCF2FD]/50 border-2 border-[#78C8F5]/40">
          <CardContent className="p-7 space-y-4">
            <Badge variant="sky">AWS Cloud Computing Architecture</Badge>
            <h3 className="font-display text-2xl font-bold">
              Cost-Effective, Child-Safe Cloud Stack
            </h3>
            <p className="text-sm text-[#24334D]/80 leading-relaxed">
              Powered by AWS Amplify (Next.js), AWS App Runner (FastAPI), Amazon
              RDS PostgreSQL 16, private Amazon S3 signed media URLs, Secrets
              Manager, and CloudWatch logging with RA 10173 privacy alignment.
            </p>
            <Link href="/login" className="inline-block">
              <Button variant="primary" size="md">
                Sign In to Your Account
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
