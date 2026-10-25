"use client";

import { CircleCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { isFamilyCodeComplete, nextFamilyCode } from "@/lib/family-code";

// shortcut: al reformatear, el cursor salta al final; basta para un código de 8 caracteres.
export function FamilyCodeInput({
  value,
  onChange,
  describedBy,
  ref,
}: {
  value: string;
  onChange: (value: string) => void;
  describedBy?: string;
  ref?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div className="relative">
      <Input
        ref={ref}
        id="codigo"
        name="code"
        value={value}
        onChange={(e) =>
          onChange(
            nextFamilyCode(
              value,
              e.target.value,
              (e.nativeEvent as InputEvent).inputType,
            ),
          )
        }
        placeholder="XXXX-XXXX"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        maxLength={9}
        aria-describedby={describedBy}
        className="pr-12 font-mono text-[22px] tracking-[0.12em] md:text-[22px]"
      />
      {isFamilyCodeComplete(value) && (
        <CircleCheck
          className="absolute top-1/2 right-4 size-6 -translate-y-1/2 text-primary"
          aria-hidden
        />
      )}
    </div>
  );
}
