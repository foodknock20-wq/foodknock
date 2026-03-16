import webpush from "web-push";
import { connectDB } from "@/lib/db";
import PushSubscription from "@/models/PushSubscription";

const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL   = process.env.VAPID_CONTACT_EMAIL ?? "foodknock20@gmail.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC, VAPID_PRIVATE);
} else {
  console.error("WEBPUSH_INIT_ERROR: Missing VAPID keys in environment");
}

export type NotificationSlot = "morning" | "evening";

type NotifMessage = {
  title: string;
  body: string;
  url: string;
  slot: NotificationSlot;
};

export const NOTIFICATION_POOL: NotifMessage[] = [
  {
    slot: "morning",
    title: "🍔 Aaj ka lunch sorted?",
    body: "Fresh burgers, momos, pizza — sab ready hai FoodKnock pe!",
    url: "/menu",
  },
  {
    slot: "morning",
    title: "😋 Bhook lag rahi hai na?",
    body: "FoodKnock ka desi twist wala burger try kiya? Abhi order karo!",
    url: "/menu",
  },
  {
    slot: "morning",
    title: "🍕 Pizza ya burger?",
    body: "Dono mil sakte hain — aaj lunch FoodKnock ke saath karo.",
    url: "/menu",
  },
  {
    slot: "morning",
    title: "☀️ Good morning, foodie!",
    body: "Sab kuch fresh ban raha hai. Aaj lunch kahan se hoga?",
    url: "/menu",
  },
  {
    slot: "morning",
    title: "🥪 Office lunch sorted nahi hai?",
    body: "FoodKnock — delivery 25 min mein. Order abhi karo!",
    url: "/menu",
  },
  {
    slot: "evening",
    title: "🧋 Evening snack time! 👀",
    body: "Cold shake + fries = perfect break. FoodKnock pe order karo!",
    url: "/menu",
  },
  {
    slot: "evening",
    title: "🍟 Fries ka mood hai?",
    body: "Crispy fries aur ek chilled shake — yahi chahiye abhi!",
    url: "/menu",
  },
  {
    slot: "evening",
    title: "🌙 Raat ka khaana soch liya?",
    body: "Pizza, momos, ya burger — jo bhi ho, FoodKnock deliver karega.",
    url: "/menu",
  },
  {
    slot: "evening",
    title: "🍦 Ice cream ka time aa gaya!",
    body: "Aaj ki shaam FoodKnock ke saath meethi karo. Order karo!",
    url: "/menu",
  },
  {
    slot: "evening",
    title: "😍 Aaj momos khaya? Nahi na!",
    body: "Steamy hot momos ready hain. 25 min mein door pe. Order karo!",
    url: "/menu",
  },
];

export function pickMessage(slot: NotificationSlot): NotifMessage {
  const pool = NOTIFICATION_POOL.filter((m) => m.slot === slot);
  return pool[Math.floor(Math.random() * pool.length)];
}

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  icon?: string;
  badge?: string;
};

function buildPayload(msg: NotifMessage): PushPayload {
  return {
    title: msg.title,
    body:  msg.body,
    url:   msg.url,
    icon:  "/icon-192.png",
    badge: "/icon-192.png",
  };
}

export async function sendPushToOne(
  subscriptionDoc: {
    _id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  },
  payload: PushPayload
): Promise<"sent" | "expired" | "failed"> {
  const subscription = {
    endpoint: subscriptionDoc.endpoint,
    keys: {
      p256dh: subscriptionDoc.p256dh,
      auth:   subscriptionDoc.auth,
    },
  };

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return "sent";
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "expired";
    console.error(`Push send error for ${subscriptionDoc._id}:`, err);
    return "failed";
  }
}

export async function broadcastCampaign(slot: NotificationSlot): Promise<{
  sent: number;
  failed: number;
  deactivated: number;
}> {
  await connectDB();

  const msg     = pickMessage(slot);
  const payload = buildPayload(msg);
  const subs    = await PushSubscription.find({ isActive: true }).lean();

  console.log(`PUSH_CAMPAIGN_SUBS: active=${subs.length}, slot=${slot}`);

  let sent = 0, failed = 0, deactivated = 0;

  await Promise.all(
    subs.map(async (sub) => {
      const result = await sendPushToOne(
        { _id: sub._id.toString(), endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload
      );

      if (result === "sent") {
        sent++;
        await PushSubscription.updateOne({ _id: sub._id }, { $set: { failCount: 0, isActive: true } });
        return;
      }

      failed++;

      if (result === "expired") {
        await PushSubscription.updateOne({ _id: sub._id }, { $set: { isActive: false }, $inc: { failCount: 1 } });
        deactivated++;
        return;
      }

      await PushSubscription.updateOne({ _id: sub._id }, { $inc: { failCount: 1 } });
    })
  );

  return { sent, failed, deactivated };
}
