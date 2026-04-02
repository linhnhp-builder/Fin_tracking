#!/usr/bin/env node
/**
 * test-n8n-webhook.mjs
 * Chạy: node test-n8n-webhook.mjs
 * Test trực tiếp n8n webhook — hiển thị đầy đủ status, headers, body
 */

const URLS = [
  "http://127.0.0.1:5678/webhook/sjc-gold",
  "http://127.0.0.1:5678/webhook/sjc-silver",
  "http://localhost:5678/webhook/sjc-gold",
];

async function testWebhook(url) {
  console.log(`\n🔍 Testing: POST ${url}`);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ source: "fintrack", kind: "market_refresh" }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    console.log(`   Status : ${res.status} ${res.statusText}`);
    console.log(`   Headers: ${JSON.stringify(Object.fromEntries(res.headers.entries()), null, 2)}`);

    const body = await res.text();
    console.log(`   Body   : ${body.slice(0, 500)}`);

    if (res.ok) {
      console.log("   ✅ SUCCESS — webhook hoạt động bình thường");
    } else {
      console.log(`   ❌ FAIL — HTTP ${res.status}`);
      if (res.status === 404) {
        console.log("   ⚠️  404 = Webhook path không tồn tại hoặc workflow chưa Activate");
      } else if (res.status === 403) {
        console.log("   ⚠️  403 = Forbidden — n8n có IP restriction hoặc auth issue");
      }
    }
  } catch (err) {
    if (err.name === "AbortError") {
      console.log("   ⏱️  TIMEOUT (>10s) — n8n đang xử lý nhưng quá chậm hoặc không trả lời");
    } else {
      console.log(`   💥 ERROR: ${err.message}`);
      if (err.message.includes("ECONNREFUSED")) {
        console.log("   ⚠️  ECONNREFUSED = n8n KHÔNG đang chạy tại địa chỉ này");
      }
    }
  }
}

// Test cả webhook-test path (n8n test mode)
async function testWebhookTestMode(path) {
  const url = `http://127.0.0.1:5678/webhook-test/${path}`;
  console.log(`\n🧪 Test mode: POST ${url}`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "fintrack", kind: "market_refresh" }),
      signal: AbortSignal.timeout(5000),
    });
    console.log(`   Status: ${res.status} — ${res.status === 404 ? "path không tồn tại" : res.status === 200 ? "✅ hoạt động (nhưng đây là TEST mode, cần production)" : "xem thêm"}`);
  } catch (e) {
    console.log(`   ${e.message}`);
  }
}

console.log("═══════════════════════════════════════");
console.log("  FinTrack n8n Webhook Diagnostic Tool ");
console.log("═══════════════════════════════════════");

for (const url of URLS) {
  await testWebhook(url);
}

await testWebhookTestMode("sjc-gold");
await testWebhookTestMode("sjc-silver");

console.log("\n═══════════════════════════════════════");
console.log("Nếu thấy ECONNREFUSED → n8n chưa chạy");
console.log("Nếu thấy 404 → workflow chưa Activate hoặc path sai");
console.log("Nếu thấy 200/202 → webhook OK, kiểm tra Supabase insert");
console.log("═══════════════════════════════════════\n");
