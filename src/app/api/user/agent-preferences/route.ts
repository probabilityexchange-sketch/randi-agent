import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const preferenceSchema = z.object({
  agentSlug: z.string(),
  personality: z.string().optional(),
  rules: z.string().optional(),
  skills: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    const { searchParams } = new URL(req.url);
    const agentSlug = searchParams.get("agentSlug");

    if (!agentSlug) {
      return NextResponse.json({ error: "agentSlug is required" }, { status: 400 });
    }

    const preference = await prisma.userAgentPreference.findUnique({
      where: {
        userId_agentSlug: {
          userId: auth.userId,
          agentSlug,
        },
      },
    });

    return NextResponse.json(preference || {
      agentSlug,
      personality: "",
      rules: "",
      skills: "",
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    const body = await req.json();
    const { agentSlug, personality, rules, skills } = preferenceSchema.parse(body);

    const preference = await prisma.userAgentPreference.upsert({
      where: {
        userId_agentSlug: {
          userId: auth.userId,
          agentSlug,
        },
      },
      update: {
        personality,
        rules,
        skills,
      },
      create: {
        userId: auth.userId,
        agentSlug,
        personality,
        rules,
        skills,
      },
    });

    return NextResponse.json(preference);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.errors }, { status: 400 });
    }
    return handleAuthError(error);
  }
}
