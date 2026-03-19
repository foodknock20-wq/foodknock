export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { broadcastCampaign, type NotificationSlot } from "@/lib/webpush";

function getISTHour(): number {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  return ist.getUTCHours();
}

function isValidSlot(value: string | null): value is NotificationSlot {
  return value === "morning" || value === "evening";
}

export async function POST(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");

    if (!cronSecret) {
      console.error("PUSH_CAMPAIGN_ERROR: CRON_SECRET missing in environment");
      return NextResponse.json(
        { success: false, message: "CRON_SECRET is not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error("PUSH_CAMPAIGN_ERROR: Unauthorized cron request");
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const istHour = getISTHour();
    if (istHour < 9 || istHour > 20) {
      return NextResponse.json({
        success: false,
        message: `Outside allowed IST hours. Current IST hour: ${istHour}`,
      });
    }

    const querySlot = req.nextUrl.searchParams.get("slot");
    const body = await req.json().catch(() => ({}));

    const bodySlot =
      body?.slot === "morning" || body?.slot === "evening"
        ? body.slot
        : null;

    const slot: NotificationSlot =
      (isValidSlot(querySlot) ? querySlot : null) ||
      bodySlot ||
      (istHour < 14 ? "morning" : "evening");

    console.log(`PUSH_CAMPAIGN_START: slot=${slot}, istHour=${istHour}`);

    const result = await broadcastCampaign(slot);

    console.log(
      `PUSH_CAMPAIGN_DONE: slot=${slot}, sent=${result.sent}, failed=${result.failed}, deactivated=${result.deactivated}`
    );

    return NextResponse.json({
      success: true,
      slot,
      istHour,
      ...result,
    });
  } catch (error) {
    console.error("PUSH_CAMPAIGN_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Campaign failed" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}