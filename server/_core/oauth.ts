import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

/**
 * OAuth routes — placeholder.
 * Wire your OAuth provider (callback URL, token exchange, user upsert) here when ready.
 */
export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.status(501).json({
      error: "OAuth not configured",
      message: "Connect an OAuth provider to enable login.",
    });
  });

  /**
   * DEV ONLY — auto-login without OAuth.
   * Creates a local dev user and sets a session cookie.
   * Remove or disable this route before deploying to production.
   */
  if (process.env.NODE_ENV !== "production") {
    app.get("/api/auth/dev-login", async (req: Request, res: Response) => {
      const devOpenId = "dev-user-local";
      try {
        await db.upsertUser({
          openId: devOpenId,
          name: "Dev User",
          email: "dev@localhost",
          loginMethod: "dev",
          lastSignedIn: new Date(),
        });

        const token = await sdk.createSessionToken(devOpenId, {
          name: "Dev User",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        res.redirect(302, "/");
      } catch (error) {
        console.error("[Dev Login] Failed:", error);
        res.status(500).json({ error: "Dev login failed", detail: String(error) });
      }
    });
  }
}
