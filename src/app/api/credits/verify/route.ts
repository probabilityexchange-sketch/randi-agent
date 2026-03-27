import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Deprecated endpoint. Use POST /api/purchase-intents/:id/verify instead.",
    },
    { status: 410 },
  );
}
