# Odgovor App Review-u (nacrt)

Za submission `4f3c776d-297d-4899-a184-265ccf27be15`, odbijen 17.08.2026 po
tačkama **4.8 (Login Services)** i **1.4.1 (Physical Harm)**.

**Kako se šalje:** App Store Connect → App Review → Messages, kao odgovor na
njihovu poruku, **uz** resubmisiju — ne umesto nje.

**Pre slanja proveri da je tačno:**

- [ ] Sign in with Apple radi na `fitmess.app` (uputstvo: `docs/prijava-sa-apple.md`, tačka 5)
- [ ] `https://fitmess.app/en/sources` se otvara na desktopu, bez naloga
- [ ] Novi build (1.0 build 4) je u TestFlight-u i priložen uz verziju
- [ ] Demo nalog je osvežen (`node scripts/store/seed-demo-data.cjs`)

Ne obećavaj ništa što nije već na produkciji u trenutku slanja. Recenzent
proverava, ne veruje na reč — i s pravom.

---

## Tekst

> Hello,
>
> Thank you for the detailed review. Both issues have been addressed in this
> submission.
>
> **Guideline 4.8 — Login Services**
>
> The app now offers **Sign in with Apple** as an equivalent login option
> alongside Google. It appears on both authentication screens — "Prijavi se"
> (sign in) and "Napravi nalog" (sign up) — as the first of the two buttons,
> in the same size and style as the Google button, with no additional taps
> required to reach it. Sign in with Apple limits data collection to name and
> email address, lets the user keep their email private via Hide My Email, and
> does not collect in-app interactions for advertising. Accounts created with a
> private relay address are fully functional; nothing in the app treats them
> differently.
>
> Related to this, we also removed a screen that asked new sign-ups for a phone
> number. It is now optional and skippable, and the app is fully usable without
> it. FitMess does not require any personal information beyond an email address
> to function.
>
> **Guideline 1.4.1 — Physical Harm**
>
> We have added a dedicated citations page listing the published source behind
> every health calculation the app performs, with a direct link to each source:
>
> - English: https://fitmess.app/en/sources
> - Serbian (the app's language): https://fitmess.app/izvori
>
> Both URLs are public and require no account, so they can be opened directly
> from a desktop browser.
>
> The page cites, among others: the Mifflin-St Jeor equation for basal
> metabolic rate (Am J Clin Nutr. 1990;51(2):241-247), the FAO/WHO/UNU energy
> requirements report for the physical-activity-level method, the NIH/NHLBI
> clinical guidelines for the app's calorie floors and maximum deficit, the
> ISSN position stand and Morton et al. (Br J Sports Med. 2018) for protein
> targets, WHO guidelines for BMI classification and for sugar, sodium and
> saturated-fat limits, and the Compendium of Physical Activities (Med Sci
> Sports Exerc. 2011;43(8):1575-1581) for the energy cost of exercise.
>
> Inside the app, the citations are reachable in one tap from every screen that
> shows a calculated number — the daily calorie screen, the analytics screen
> where BMI is shown, the goal-and-plan screen, the workout screen, and the
> plan summary shown at the end of onboarding — via a "Odakle ovaj broj?"
> ("Where does this number come from?") link, as well as from a permanent entry
> in Settings. The page opens with a prominent statement that the app is not a
> doctor, that its figures are population-level estimates, and that anyone who
> is pregnant or breastfeeding, has a medical condition, or has a history of an
> eating disorder should consult a healthcare professional before following the
> plan.
>
> To see both changes on the review device: the Sign in with Apple button is on
> the first screen the app opens on. The citations link is at the bottom of the
> home screen ("Danas") once signed in, and in Settings ("Profil") under
> "Odakle brojevi".
>
> Thank you for your time.
>
> Marko Bera
> FitMess

---

## Ako pitaju dalje

**„Zašto Google login ne postoji u aplikaciji, a postoji na sajtu?"**

> Google's OAuth policy blocks sign-in from embedded web views, which is what
> the app's web view is. Rather than show a button that cannot work, the app
> offers Sign in with Apple and email/password, both of which complete inside
> the app. Users who created their account with Google can sign in with the
> password-reset flow on the same email address. The web version, used in a
> real browser, is unaffected.

**„Da li app daje medicinske savete?"**

> No. The app tracks food intake and estimates a calorie and macronutrient
> budget from published equations. It does not diagnose, treat, or reference
> any disease, and it states in-app that it is not a substitute for a doctor.
> This is why the age rating questionnaire was answered with
> `medicalOrTreatmentInformation: NONE` and `healthOrWellnessTopics: true`.
