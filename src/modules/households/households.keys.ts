import "server-only";
import { getEnv } from "@/lib/env";
import { deriveCodeKeys, type CodeKeys } from "./households.service";

let keys: CodeKeys | undefined;

export function getCodeKeys() {
  return (keys ??= deriveCodeKeys(getEnv().ACCESS_CODE_KEY));
}
