import {
  LegalCallout,
  LegalDocument,
  LegalList,
  LegalSection,
  LegalSteps,
  LegalText,
  type LegalDocumentProps,
} from "@/components/legal/legal-document";
import { DELETE_CONFIRMATION_PHRASE } from "@/lib/account/constants";
import { CONTROLLER } from "@/lib/legal/controller";

/**
 * The account-deletion page — the one legal document that exists because of a
 * single store rule rather than a law.
 *
 * Google Play requires a URL, reachable without installing the app, that
 * explains how to request deletion and what data is erased. Apple is satisfied
 * by the in-app flow alone (guideline 5.1.1(v)), which FitMess has had since
 * F019; this page is what makes the same flow legible to someone who has not
 * installed anything yet.
 *
 * What it describes has to stay true to `src/lib/account/delete-account.ts`:
 * one `deleteUser` call, everything personal removed by the database's own
 * cascade, and the shared food catalogue left standing with its authorship
 * link cut. The confirmation phrase is imported rather than retyped, so the
 * instructions can never tell the reader to type a word the dialog rejects.
 */
export function AccountDeletion({ locale, t }: LegalDocumentProps) {

  return (
    <LegalDocument
      title={t("legal.delete.title")}
      lead={t("legal.delete.lead")}
      locale={locale}
      t={t}
    >
      <LegalSection title={t("legal.delete.inApp.h")}>
        <LegalSteps
          items={[
            t("legal.delete.inApp.s1"),
            t("legal.delete.inApp.s2"),
            t("legal.delete.inApp.s3"),
            t("legal.delete.inApp.s4", {
              phrase: `„${DELETE_CONFIRMATION_PHRASE}“`,
            }),
          ]}
        />
        <LegalCallout>{t("legal.delete.inApp.note")}</LegalCallout>
      </LegalSection>

      <LegalSection title={t("legal.delete.email.h")}>
        <LegalText>
          {t("legal.delete.email.body", { email: CONTROLLER.email })}
        </LegalText>
      </LegalSection>

      <LegalSection title={t("legal.delete.what.h")}>
        <LegalText>{t("legal.delete.what.lead")}</LegalText>
        <LegalList
          items={[
            t("legal.delete.what.li1"),
            t("legal.delete.what.li2"),
            t("legal.delete.what.li3"),
            t("legal.delete.what.li4"),
            t("legal.delete.what.li5"),
            t("legal.delete.what.li6"),
          ]}
        />
      </LegalSection>

      <LegalSection title={t("legal.delete.stays.h")}>
        <LegalText>{t("legal.delete.stays.body")}</LegalText>
      </LegalSection>

      <LegalSection title={t("legal.delete.after.h")}>
        <LegalText>{t("legal.delete.after.body")}</LegalText>
      </LegalSection>
    </LegalDocument>
  );
}
