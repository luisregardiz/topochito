import { z } from "zod";
import { tokenParamPattern } from "@/lib/tokens";

export const memberLabel = z.string().trim().min(1).max(40);

export const acceptInviteInput = z.object({ label: memberLabel });
export const memberIdParam = z.uuid();
export const inviteIdParam = z.uuid();
// 32 bytes en base64url = 43 caracteres
export const inviteTokenParam = z.string().regex(tokenParamPattern);

export type Member = {
  id: string;
  label: string;
  lastSeenAt: string;
  createdAt: string;
  isMe: boolean;
};

export type Invite = { id: string; expiresAt: string };
