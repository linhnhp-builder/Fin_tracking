import { ENV } from "./_core/env";

/** Chờ tối đa khi webhook n8n trả lời sau khi workflow chạy xong. */
const WEBHOOK_TIMEOUT_MS = 125_000;

export type N8nRefreshTargets = { goldUrl: string; silverUrl: string | null };

export function getN8nRefreshTargets(): N8nRefreshTargets {
  const goldUrl = ENV.n8nSjcWebhookUrl.trim();
  const silverRaw = ENV.n8nSilverWebhookUrl.trim();
  const silverUrl = silverRaw && silverRaw !== goldUrl ? silverRaw : null;
  return { goldUrl, silverUrl };
}

export function getN8nWebhookUrlsToCall(): string[] {
  const { goldUrl, silverUrl } = getN8nRefreshTargets();
  if (!goldUrl) return [];
  return silverUrl ? [goldUrl, silverUrl] : [goldUrl];
}

/**
 * POST tới webhook n8n (test webhook / production URL).
 */
export async function postN8nWebhook(url: string): Promise<{ ok: boolean; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const secret = ENV.n8nWebhookSecret.trim();
    if (secret) {
      headers["X-FinTrack-N8n-Secret"] = secret;
    }
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ source: "fintrack", kind: "market_refresh" }),
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status };
  } finally {
    clearTimeout(timer);
  }
}
