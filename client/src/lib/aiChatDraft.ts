export type AiCategoryOption = { id: number; name: string; icon: string | null; type: string };

/** Draft shape returned from AI chat (RECORD intent) */
export type AiTransactionDraft = {
  amount: number;
  amount_display: string;
  type: "expense" | "income";
  category_match: string;
  categoryId?: number;
  categoryName?: string;
  categoryIcon?: string;
  note: string;
  location_name: string | null;
  date: string;
  allCategories?: AiCategoryOption[];
};

export type StoredAiChatDraft = {
  draft: AiTransactionDraft;
};

const storageKey = (msgId: string) => `fintrack:aiDraft:v1:${msgId}`;

export function storeAiChatDraft(msgId: string, payload: StoredAiChatDraft): void {
  try {
    sessionStorage.setItem(storageKey(msgId), JSON.stringify(payload));
  } catch {
    // quota / private mode — detail page will redirect
  }
}

export function loadAiChatDraft(msgId: string): StoredAiChatDraft | null {
  try {
    const raw = sessionStorage.getItem(storageKey(msgId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredAiChatDraft;
  } catch {
    return null;
  }
}

export function removeAiChatDraft(msgId: string): void {
  try {
    sessionStorage.removeItem(storageKey(msgId));
  } catch {
    /* ignore */
  }
}
