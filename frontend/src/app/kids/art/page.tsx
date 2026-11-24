"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Star, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatShortDate, getDefaultPortalPath } from "@/lib/utils";
import { ApiError, artworkApi } from "@/services/api";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ColoringCanvas } from "@/components/art/ColoringCanvas";
import { KidsHeader } from "@/components/kids/KidsHeader";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { Artwork } from "@/types";

function ArtStudioContent() {
  const { user, childrenList, activeChildId } = useAuth();
  const activeChild =
    childrenList.find((c) => c.id === activeChildId) || childrenList[0] || null;
  const exitHref = getDefaultPortalPath(user?.roles || ["parent"]);
  const canDelete =
    user?.roles.includes("parent") || user?.roles.includes("admin");

  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Artwork | null>(null);
  const [deleting, setDeleting] = useState(false);

  const blobMapRef = useRef<Record<string, string>>({});

  const revokeAllBlobs = useCallback(() => {
    Object.values(blobMapRef.current).forEach((url) => URL.revokeObjectURL(url));
    blobMapRef.current = {};
  }, []);

  const loadGallery = useCallback(async () => {
    if (!activeChild) {
      revokeAllBlobs();
      setArtworks([]);
      setBlobUrls({});
      setLoading(false);
      return;
    }
    setLoading((prev) => prev && artworks.length === 0);
    setError(null);
    try {
      const list = await artworkApi.list(activeChild.id);
      setArtworks(list);

      const keepIds = new Set(list.map((a) => a.id));
      for (const [id, url] of Object.entries(blobMapRef.current)) {
        if (!keepIds.has(id)) {
          URL.revokeObjectURL(url);
          delete blobMapRef.current[id];
        }
      }

      const missing = list.filter((art) => !blobMapRef.current[art.id]);
      if (missing.length > 0) {
        const fetched = await Promise.all(
          missing.map(async (art) => {
            try {
              const url = await artworkApi.imageUrl(activeChild.id, art.id);
              return [art.id, url] as const;
            } catch {
              return [art.id, ""] as const;
            }
          })
        );
        for (const [id, url] of fetched) {
          if (url) {
            blobMapRef.current[id] = url;
          }
        }
      }
      setBlobUrls({ ...blobMapRef.current });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not load Art Gallery."
      );
    } finally {
      setLoading(false);
    }
  }, [activeChild, artworks.length, revokeAllBlobs]);

  useEffect(() => {
    void loadGallery();
    return () => {
      revokeAllBlobs();
    };
  }, [loadGallery, revokeAllBlobs]);

  async function confirmDelete() {
    if (!deleteTarget || !activeChild) return;
    setDeleting(true);
    try {
      await artworkApi.remove(activeChild.id, deleteTarget.id);
      setDeleteTarget(null);
      await loadGallery();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not remove artwork."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#FFE3DE]/45 via-[#FFF9F0] to-[#FFF5CF]/45 px-3.5 sm:px-6 py-4 sm:py-6">
      <div className="mx-auto max-w-5xl 2xl:max-w-6xl space-y-5 sm:space-y-6">
        <KidsHeader
          child={activeChild}
          backHref="/kids"
          backLabel="Kids Home"
          exitHref={exitHref}
        />

        <div className="space-y-1">
          <h1 className="font-display text-fluid-h1 font-bold text-[#24334D]">
            LittleSteps Art Studio
          </h1>
          <p className="text-sm font-semibold text-[#24334D]/75">
            Pick a template, splash cheerful colors, and save your picture!
          </p>
        </div>

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
        ) : (
          <>
            <ColoringCanvas
              childId={activeChild.id}
              onSaved={() => void loadGallery()}
            />

            <div className="space-y-4 pt-2">
              <h2 className="font-display text-2xl font-bold text-[#24334D]">
                My Gallery ({artworks.length})
              </h2>

              {error && <Alert tone="warning">{error}</Alert>}

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Skeleton className="h-52 w-full" />
                  <Skeleton className="h-52 w-full" />
                </div>
              ) : artworks.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center space-y-2">
                    <p className="font-display text-xl font-bold">
                      Your Art Gallery is Ready!
                    </p>
                    <p className="text-sm text-[#24334D]/75">
                      Paint a picture above and tap &ldquo;Save My Art&rdquo; to
                      see it framed right here!
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {artworks.map((art) => (
                    <Card key={art.id} className="overflow-hidden">
                      <div className="aspect-[4/3] bg-[#FFF9F0] flex items-center justify-center border-b border-[#24334D]/8">
                        {blobUrls[art.id] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={blobUrls[art.id]}
                            alt={art.title}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <Skeleton className="h-full w-full rounded-none" />
                        )}
                      </div>
                      <CardContent className="p-4 flex items-center justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-display font-bold text-[#24334D] truncate">
                              {art.title}
                            </p>
                            {art.approved_by_parent && (
                              <Badge variant="sunshine" className="text-[10px]">
                                <Star className="h-3 w-3 fill-current" />
                                Keepsake
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-[#24334D]/60">
                            {formatShortDate(art.created_at)}
                          </p>
                        </div>
                        {canDelete && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant={art.approved_by_parent ? "secondary" : "ghost"}
                              size="sm"
                              title={
                                art.approved_by_parent
                                  ? "Featured Keepsake"
                                  : "Approve Keepsake"
                              }
                              onClick={async () => {
                                if (!activeChild) return;
                                try {
                                  const updated = await artworkApi.updateApproval(
                                    activeChild.id,
                                    art.id,
                                    !art.approved_by_parent
                                  );
                                  setArtworks((prev) =>
                                    prev.map((a) => (a.id === art.id ? updated : a))
                                  );
                                } catch {
                                  // ignore transient failure
                                }
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={`Delete ${art.title}`}
                              onClick={() => setDeleteTarget(art)}
                            >
                              <Trash2 className="h-4 w-4 text-[#8E3022]" />
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <Dialog
          open={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          title="Remove Artwork?"
          description={`Are you sure you want to delete "${deleteTarget?.title}" from the gallery?`}
        >
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              className="w-full sm:w-auto"
            >
              Keep Artwork
            </Button>
            <Button
              type="button"
              variant="coral"
              disabled={deleting}
              onClick={confirmDelete}
              className="w-full sm:w-auto"
            >
              {deleting ? "Removing..." : "Delete Artwork"}
            </Button>
          </div>
        </Dialog>
      </div>
    </div>
  );
}

export default function ArtStudioPage() {
  return (
    <ProtectedRoute allowedRoles={["parent", "teacher", "admin"]}>
      <ArtStudioContent />
    </ProtectedRoute>
  );
}
