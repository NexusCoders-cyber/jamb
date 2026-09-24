import { NextResponse } from "next/server";
import { verifyPaystackTransaction } from "@/lib/services";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const reference = typeof body?.reference === "string" ? body.reference.trim() : "";

  if (!reference) {
    return NextResponse.json({ error: "A Paystack reference is required." }, { status: 400 });
  }

  try {
    const result = await verifyPaystackTransaction(reference);
    const successful = result.status === true && result.data?.status === "success";
    return NextResponse.json({ successful, transaction: result.data ?? null }, { status: successful ? 200 : 402 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment verification failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
