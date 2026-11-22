"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getDefaultPortalPath } from "@/lib/utils";
import { ApiError, contentApi } from "@/services/api";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { GamePlayer } from "@/components/games/GamePlayer";
import { KidsHeader } from "@/components/kids/KidsHeader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Game } from "@/types";

function PlayGameContent() {
  const params = useParams<{ gameId: string }>();
  const { user, childrenList, activeChildId } = useAuth();
  const gameId = params?.gameId;

  const activeChild =
    childrenList.find((c) => c.id === activeChildId) || childrenList[0] || null;
  const exitHref = getDefaultPortalPath(user?.roles || ["parent"]);

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    contentApi
      .game(gameId)
      .then((g) => {
        if (mounted) setGame(g);
      })
      .catch((err) => {
        if (mounted) {
          setError(
            err instanceof ApiError ? err.message : "Could not load this game."
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [gameId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF5CF]/55 via-[#FFF9F0] to-[#DCF2FD]/45 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <KidsHeader
          child={activeChild}
          backHref="/kids?tab=play"
          backLabel="All Games"
          exitHref={exitHref}
        />

        {!activeChild ? (
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <p className="font-display text-2xl font-bold">
                Pick a Learner Profile First
              </p>
              <Link href="/kids" className="inline-block">
                <Button variant="secondary" size="kid">
                  Back to Kids Home
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : loading ? (
          <Skeleton className="h-80 w-full" />
        ) : error || !game ? (
          <Alert tone="warning" title="Game Unavailable">
            {error || "We could not find this game."}
          </Alert>
        ) : (
          <GamePlayer
            game={game}
            childId={activeChild.id}
            child={activeChild}
            onExitHref="/kids?tab=play"
          />
        )}
      </div>
    </div>
  );
}

export default function PlayGamePage() {
  return (
    <ProtectedRoute allowedRoles={["parent", "teacher", "admin"]}>
      <PlayGameContent />
    </ProtectedRoute>
  );
}
