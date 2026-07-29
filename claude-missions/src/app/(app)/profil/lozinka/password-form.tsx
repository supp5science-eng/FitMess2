"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { changePasswordAction } from "./actions";

// "Promeni lozinku" form. App-styled (Input/Label + theme tokens, not the
// auth.css-scoped PasswordInput). Client-side: new password + confirmation,
// with a reveal toggle; delegates to `changePasswordAction` which re-validates
// and updates the active session's password. On success shows an inline
// confirmation and bounces back to Podešavanja.
export function PasswordForm() {
  const router = useRouter();
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const pwId = useId();
  const confirmId = useId();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await changePasswordAction({ password, confirmPassword });
      if (!result.ok) {
        setError(result.error_sr ?? t("profil.error.generic"));
        return;
      }
      setSaved(true);
      setPassword("");
      setConfirmPassword("");
      setTimeout(() => router.push("/profil"), 900);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={pwId}>{t("profil.password.new")}</Label>
        <div className="relative">
          <Input
            id={pwId}
            type={visible ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            minLength={8}
            required
            className="pr-11"
            aria-invalid={error ? true : undefined}
          />
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? t("profil.password.hide") : t("profil.password.show")}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground"
          >
            {visible ? (
              <EyeOff className="size-5" aria-hidden={true} />
            ) : (
              <Eye className="size-5" aria-hidden={true} />
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{t("profil.password.minChars")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={confirmId}>{t("profil.password.confirm")}</Label>
        <Input
          id={confirmId}
          type={visible ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          minLength={8}
          required
          aria-invalid={error ? true : undefined}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm font-medium text-primary">
          {t("profil.password.saved")}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || saved}>
        {pending ? t("profil.saving") : t("profil.password.submit")}
      </Button>
    </form>
  );
}
