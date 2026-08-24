import {
  LegalCallout,
  LegalDocument,
  LegalList,
  LegalSection,
  LegalText,
  type LegalDocumentProps,
} from "@/components/legal/legal-document";
import { CONTROLLER, MINIMUM_AGE } from "@/lib/legal/controller";

/**
 * The privacy policy, rendered identically at `/privatnost` (public, what the
 * store listings link to) and at `/profil/privatnost` (in-app).
 *
 * Every factual claim in here is checkable against the code, and that is the
 * point of a policy — the retention periods match the pg_cron jobs, the
 * processor list matches what the app actually calls, and the "no analytics"
 * sentence is true because there is no analytics SDK in `package.json`. If any
 * of those change, this text is wrong and has to change with them.
 */
export function PrivacyPolicy({ locale, t }: LegalDocumentProps) {
  const party = {
    name: CONTROLLER.name,
    email: CONTROLLER.email,
  };

  return (
    <LegalDocument
      title={t("legal.privacy.title")}
      lead={t("legal.privacy.lead")}
      locale={locale}
      t={t}
    >
      <LegalSection title={t("legal.privacy.controller.h")}>
        <LegalText>{t("legal.privacy.controller.body", party)}</LegalText>
      </LegalSection>

      <LegalSection title={t("legal.privacy.collect.h")}>
        <LegalText>{t("legal.privacy.collect.lead")}</LegalText>
        <LegalSubheading>{t("legal.privacy.collect.account.h")}</LegalSubheading>
        <LegalText>{t("legal.privacy.collect.account.body")}</LegalText>
        <LegalSubheading>{t("legal.privacy.collect.health.h")}</LegalSubheading>
        <LegalText>{t("legal.privacy.collect.health.body")}</LegalText>
        <LegalSubheading>{t("legal.privacy.collect.media.h")}</LegalSubheading>
        <LegalText>{t("legal.privacy.collect.media.body")}</LegalText>
        {/* Face photos get their OWN subheading rather than a sentence folded
            into "Photos and voice" above. They are the most sensitive thing the
            app asks for, they are asked for on the very first screen, and they
            are the one upload a reader is most likely to want to check before
            handing over -- burying that in a paragraph about meal photos would
            be technically complete and practically dishonest. */}
        <LegalSubheading>{t("legal.privacy.collect.klon.h")}</LegalSubheading>
        <LegalText>{t("legal.privacy.collect.klon.body")}</LegalText>
        <LegalSubheading>{t("legal.privacy.collect.tech.h")}</LegalSubheading>
        <LegalText>{t("legal.privacy.collect.tech.body")}</LegalText>
      </LegalSection>

      <LegalSection title={t("legal.privacy.why.h")}>
        <LegalList
          items={[
            t("legal.privacy.why.contract"),
            t("legal.privacy.why.consent"),
            t("legal.privacy.why.legitimate"),
          ]}
        />
        <LegalText>{t("legal.privacy.why.note")}</LegalText>
      </LegalSection>

      <LegalSection title={t("legal.privacy.health.h")}>
        <LegalCallout>{t("legal.privacy.health.body")}</LegalCallout>
      </LegalSection>

      <LegalSection title={t("legal.privacy.share.h")}>
        <LegalText>{t("legal.privacy.share.lead")}</LegalText>
        <LegalList
          items={[
            t("legal.privacy.share.supabase"),
            t("legal.privacy.share.vercel"),
            t("legal.privacy.share.google"),
            t("legal.privacy.share.resend"),
          ]}
        />
        <LegalText>{t("legal.privacy.share.never")}</LegalText>
      </LegalSection>

      <LegalSection title={t("legal.privacy.transfer.h")}>
        <LegalText>{t("legal.privacy.transfer.body")}</LegalText>
      </LegalSection>

      <LegalSection title={t("legal.privacy.keep.h")}>
        <LegalList
          items={[
            t("legal.privacy.keep.account"),
            t("legal.privacy.keep.logs"),
            t("legal.privacy.keep.photos"),
            t("legal.privacy.keep.voice"),
            t("legal.privacy.keep.klon"),
            t("legal.privacy.keep.delete"),
          ]}
        />
      </LegalSection>

      <LegalSection title={t("legal.privacy.rights.h")}>
        <LegalText>{t("legal.privacy.rights.lead")}</LegalText>
        <LegalText>{t("legal.privacy.rights.inApp")}</LegalText>
        <LegalText>{t("legal.privacy.rights.email", party)}</LegalText>
        <LegalText>{t("legal.privacy.rights.complaint")}</LegalText>
      </LegalSection>

      <LegalSection title={t("legal.privacy.age.h")}>
        <LegalText>
          {t("legal.privacy.age.body", { ...party, age: MINIMUM_AGE })}
        </LegalText>
      </LegalSection>

      <LegalSection title={t("legal.privacy.cookies.h")}>
        <LegalText>{t("legal.privacy.cookies.body")}</LegalText>
      </LegalSection>

      <LegalSection title={t("legal.privacy.security.h")}>
        <LegalText>{t("legal.privacy.security.body")}</LegalText>
      </LegalSection>

      <LegalSection title={t("legal.privacy.changes.h")}>
        <LegalText>{t("legal.privacy.changes.body")}</LegalText>
      </LegalSection>

      <LegalSection title={t("legal.privacy.contact.h")}>
        <LegalCallout>{t("legal.privacy.contact.body", party)}</LegalCallout>
      </LegalSection>
    </LegalDocument>
  );
}

/** A heading one level below `LegalSection` — used only inside "What we
 * collect", which is the one section long enough to need its own signposts. */
function LegalSubheading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-2 text-[15px] font-semibold text-foreground">{children}</h3>
  );
}
