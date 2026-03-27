import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Deprecated endpoint. Use POST /api/purchase-intents instead.",
    },
    { status: 410 },
  );
}
