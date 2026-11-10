import { supabase } from "../supabase.js";

const PUBLIC_KEY = import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY || "";

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function bytesToBase64Url(value) {
  return window.btoa(String.fromCharCode(...new Uint8Array(value)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function webPushSupport() {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

export async function currentPushSubscription() {
  if (!webPushSupport()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration?.pushManager.getSubscription() || null;
}

export async function enableWebPush(userId) {
  if (!supabase || !userId) throw new Error("Sign in before enabling push notifications.");
  if (!webPushSupport()) throw new Error("This browser does not support Web Push.");
  if (!PUBLIC_KEY) throw new Error("Web Push is not configured on this deployment yet.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Browser notification permission was not granted.");

  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(PUBLIC_KEY),
    });
  }
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("The browser returned an incomplete push subscription.");
  }
  const { error } = await supabase.from("web_push_subscriptions").upsert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    expiration_time: json.expirationTime ? new Date(json.expirationTime).toISOString() : null,
    is_active: true,
  }, { onConflict: "user_id,endpoint" });
  if (error) throw error;
  return subscription;
}

export async function disableWebPush(userId) {
  if (!supabase || !userId) throw new Error("Sign in before changing push settings.");
  const subscription = await currentPushSubscription();
  if (subscription) {
    const { error } = await supabase.from("web_push_subscriptions")
      .update({ is_active: false }).eq("user_id", userId).eq("endpoint", subscription.endpoint);
    if (error) throw error;
    await subscription.unsubscribe();
  }
}

export { bytesToBase64Url };
