# n8n — làm mới giá vàng/bạc từ app (handoff cho Cursor)

Tài liệu này mô tả **bạn cần làm gì**, và **những thông tin / output nào** bạn nên thu thập để đưa cho Cursor khi nhờ implement hoặc debug.

---

## 1. Mục tiêu

- **Không** chạy Schedule / Telegram để kích hoạt workflow.
- User bấm **Cập nhật giá n8n** trong app → server gọi **POST** tới webhook n8n → workflow chạy (Screenshot SJC → GPT → Format → ghi Supabase `gold_n8n_feed` / `silver_n8n_feed`).
- App đọc giá qua tRPC `market.prices` (đã có trong codebase).

---

## 2. Việc bạn làm trên n8n (Docker)

1. Mở workflow SJC; **xóa** node Schedule, Telegram getUpdates, Filter (nếu còn).
2. Thêm **Webhook** làm trigger duy nhất:
   - Method: **POST**
   - Ghi lại **Production URL** đầy đủ (ví dụ `http://127.0.0.1:5678/webhook/...` hoặc domain public nếu deploy).
3. Chọn chế độ **Response**:
   - *Respond immediately* → workflow chạy nền; app có thể cần refetch lại sau vài giây.
   - *When last node finishes* → một lần gọi có thể chờ lâu; cần timeout server đủ lớn (code dự kiến ~125s).
4. Nối: `Webhook` → Screenshot → AI → Format → Insert Supabase (giữ logic cũ).
5. **Activate** workflow.

**Output bạn cần copy cho Cursor:**

| Thông tin | Ví dụ / ghi chú |
|-----------|-----------------|
| `N8N_SJC_WEBHOOK_URL` | URL Production của Webhook (POST), không có secret trong URL nếu tránh lộ log |
| Có workflow **riêng cho bạc** không? | Nếu có → URL thứ hai; nếu một workflow ghi cả 2 bảng → chỉ cần một URL |
| `N8N_SILVER_WEBHOOK_URL` | (tuỳ chọn) chỉ khi khác URL vàng |
| Webhook có **Header Auth** không? | Nếu có → tên header + giá trị (Cursor map sang `N8N_WEBHOOK_SECRET` + header `X-FinTrack-N8n-Secret` trong code dự kiến) |
| Test nhanh | Kết quả `curl -X POST "<URL>" -H "Content-Type: application/json" -d '{}'` (HTTP status, có execution trên n8n không) |

---

## 3. Việc bạn làm trên Supabase

- Bảng `gold_n8n_feed` / `silver_n8n_feed` đã tồn tại (theo migration v3.1).
- Đảm bảo node Insert từ n8n vẫn ghi đúng cột `payload` (jsonb), `ingestedAt` / `source` nếu dùng.

**Output cho Cursor (khi debug giá sai):**

- Một dòng **payload JSON mẫu** mới nhất trong `gold_n8n_feed` (ẩn dữ liệu nhạy cảm nếu có).
- Nếu parser app không nhận giá: ghi rõ các key trong JSON (vd. `ban`, `giaBan`, `thoiGianCapNhat`).

---

## 4. Việc bạn làm trong `.env` (máy chạy FinTrack server)

Thêm (hoặc chuẩn bị giá trị) các biến sau để Cursor / bạn paste vào:

```env
N8N_SJC_WEBHOOK_URL=
# Tuỳ chọn:
# N8N_SILVER_WEBHOOK_URL=
# N8N_WEBHOOK_SECRET=
```

**Lưu ý mạng:**

- Server app và n8n **cùng máy**: thường dùng `http://127.0.0.1:5678/...`.
- App trong Docker, n8n trong Docker: dùng **hostname service** Docker, không dùng `localhost` từ trong container.
- App trên cloud, n8n chỉ ở máy local: webhook local **không** gọi được — cần tunnel (ngrok, cloudflare tunnel) hoặc n8n host public.

**Output cho Cursor:**

- File `.env` **không** paste secret vào chat công khai; chỉ nói: *“đã set N8N_SJC_WEBHOOK_URL trỏ tới … (localhost / public)”* và có hay không `SILVER` / `SECRET`.

---

## 5. Những gì Cursor cần nhận từ bạn (checklist)

Khi bạn nhờ Cursor *implement* hoặc *sửa lỗi*, cung cấp tối thiểu:

1. **URL webhook** (vàng) — có thể che domain bằng `https://xxx.ngrok.app/webhook/abc` nếu ngại lộ path.
2. **Có cần webhook bạc thứ hai không** — có/không + URL nếu có.
3. **Có dùng secret header không** — có/không (không paste secret, chỉ nói “đã set trong .env”).
4. **Kết quả test `curl POST`** — status code (200/401/404) và 1 dòng mô tả (execution chạy / không).
5. **Chế độ Response** của webhook n8n — immediate hay chờ xong (để Cursor chỉnh UX refetch / timeout).
6. (Nếu lỗi giá) **mẫu `payload`** một dòng từ Supabase hoặc từ node Format trong n8n.

---

## 6. Output sau khi Cursor implement (bạn kiểm tra)

- Trên trang **Đầu tư**, mục **Lịch sử giao dịch**: nút **Cập nhật giá** (icon refresh); bấm xong giá vàng/bạc refetch sau vài giây (kể cả khi n8n trả lời ngay).
- Mutation tRPC: `market.refreshFromN8n`.
- Lỗi thường gặp: `PRECONDITION_FAILED` (chưa set `N8N_SJC_WEBHOOK_URL`), `BAD_GATEWAY` (n8n trả non-2xx hoặc không kết nối được).

---

## 7. Một dòng prompt mẫu cho Cursor

> Repo FinTrack. Đã tắt plan mode. Implement theo `docs/n8n-manual-refresh-handoff.md`: `N8N_SJC_WEBHOOK_URL` đã có trong `.env`; webhook n8n respond [immediate | when done]; [có/không] `N8N_SILVER_WEBHOOK_URL`; curl POST trả [mã HTTP].

Bạn chỉ việc điền các ô trong ngoặc vuông sau khi đã thu thập đúng thông tin ở mục 5.

---

## 8. Node Code « Format Gold » — lỗi `Cannot read properties of undefined (reading '0')` (line 2)

**Nguyên nhân:** Code cũ dùng `raw.choices[0].message.content` (kiểu OpenAI HTTP). Node **Message a model** trong n8n thường trả về `output[0].content[0].text`, không có `choices`.

**Cách sửa:** Trong n8n, mở node **Format Gold**, thay toàn bộ code bằng đoạn dưới (dán vào tab Code).

```javascript
const raw = $input.first().json;

function extractAiText(data) {
  const t1 = data?.output?.[0]?.content?.[0]?.text;
  if (t1 != null && String(t1).length) return String(t1);

  const parts = data?.output?.[0]?.content;
  if (Array.isArray(parts)) {
    for (const p of parts) {
      if (p?.text != null && String(p.text).length) return String(p.text);
    }
  }

  const t2 = data?.choices?.[0]?.message?.content;
  if (t2 != null && String(t2).length) return String(t2);

  throw new Error(
    "Format Gold: không đọc được nội dung model. Keys: " + Object.keys(data || {}).join(", ")
  );
}

function stripMarkdownJsonFences(s) {
  let t = s.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  t = t.replace(/^"""json\s*/i, "").replace(/\s*"""$/i, "").trim();
  return t;
}

function parseJsonFromModelText(text) {
  const cleaned = stripMarkdownJsonFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("GPT gold parse failed (no JSON object). Raw: " + text.slice(0, 400));
  }
}

const parsed = parseJsonFromModelText(extractAiText(raw));

const sell = parsed.sell ?? parsed.ban ?? parsed.giaBan;
const buy = parsed.buy ?? parsed.mua;

const out = {
  ...parsed,
  ban: sell,
  giaBan: sell,
  mua: buy,
  buy,
  sell,
  thoiGianCapNhat: parsed.updated_at ?? parsed.thoiGianCapNhat ?? parsed.capNhat,
  updated_at: parsed.updated_at,
};

return [{ json: out }];
```

Parser app ([`server/marketN8nPayload.ts`](../server/marketN8nPayload.ts)) đã hiểu `sell`, `ban`, `updated_at`, `thoiGianCapNhat` — object `out` ở trên tương thích.
