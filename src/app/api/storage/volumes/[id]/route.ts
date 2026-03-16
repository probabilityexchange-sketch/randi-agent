import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

/**
 * DELETE /api/storage/volumes/[id]
 * Deletes a storage volume and its snapshot from Supabase.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();

    const { allowed } = await checkRateLimit(`storage-volumes:${auth.userId}`, RATE_LIMITS.general);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { id } = await params;

    // First get the volume to verify ownership and get storage details
    const volume = await prisma.storageVolume.findFirst({
      where: { id, userId: auth.userId },
    });

    if (!volume) {
      return NextResponse.json(
        { error: "Storage volume not found" },
        { status: 404 }
      );
    }

    // Delete from Supabase Storage if snapshot exists
    if (volume.storageKey && volume.snapshotPath) {
      try {
        const { getSupabaseAdmin } = await import("@/lib/storage/storage-service");
        const supabase = getSupabaseAdmin();
        const { error } = await supabase.storage
          .from("agent-storage")
          .remove([`${volume.storageKey}/snapshot.tar.gz`]);
        
        if (error) {
          console.warn("Failed to delete snapshot from Supabase:", error);
          // Continue anyway - we'll still delete the DB record
        }
      } catch (supabaseError) {
        console.warn("Supabase error during cleanup:", supabaseError);
        // Continue with DB deletion
      }
    }

    // Delete the database record
    await prisma.storageVolume.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
