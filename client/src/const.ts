export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Returns the login URL.
 * Plug in your OAuth provider's login URL here when ready.
 * For now returns "/" (no redirect) since OAuth is not configured.
 */
export const getLoginUrl = (): string => {
  return "/login";
};
