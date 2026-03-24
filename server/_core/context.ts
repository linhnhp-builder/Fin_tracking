import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/**
 * Personal web app — no auth required.
 * Always returns the owner user (id: 1).
 * Add proper auth here when deploying for multiple users.
 */
const OWNER_USER: User = {
  id: 1,
  openId: "owner-local",
  manusOpenId: null,
  name: "Owner",
  email: "owner@fintrack.local",
  loginMethod: "local",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  return {
    req: opts.req,
    res: opts.res,
    user: OWNER_USER,
  };
}
