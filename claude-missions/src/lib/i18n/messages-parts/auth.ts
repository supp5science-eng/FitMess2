export const authMessages = {
  sr: {
    // Shared
    "auth.sending": "Slanje…",
    "auth.saving": "Čuvanje…",
    "auth.link.signIn": "Prijavi se",
    "auth.link.signUp": "Registruj se",

    // Sign in (/prijava)
    "auth.signIn.title": "Prijavi se",
    "auth.signIn.subtitle": "Unesi email i lozinku da nastaviš.",
    "auth.signIn.confirmExpired":
      "Link za potvrdu je istekao ili je već iskorišćen. Prijavi se, ili zatraži novi link sa stranice za registraciju.",
    "auth.signIn.forgotLink": "Zaboravio/la si lozinku?",
    "auth.signIn.noAccount": "Nemaš nalog?",

    // Sign up (/registracija)
    "auth.signUp.title": "Napravi nalog",
    "auth.signUp.subtitle": "Unesi email i lozinku da bi počeo/la sa praćenjem ishrane.",
    "auth.signUp.haveAccount": "Već imaš nalog?",

    // Third-party sign-in block (social-sign-in.tsx)
    "auth.oauth.or": "ili",
    "auth.oauth.apple": "Nastavi sa Apple nalogom",
    "auth.oauth.appleRedirecting": "Preusmeravanje na Apple…",
    "auth.oauth.google": "Nastavi sa Google",
    "auth.oauth.googleRedirecting": "Preusmeravanje na Google…",

    // Phone field (shared signup + /telefon)
    "auth.phone.label": "Broj telefona",
    "auth.phone.labelOptional": "Broj telefona (opciono)",
    "auth.phone.dialCodeAria": "Pozivni broj države",

    // Verify email (/registracija/proveri-email)
    "auth.verify.title": "Potvrdi nalog",
    "auth.verify.sentTo": "Poslali smo 6-cifreni kod na",
    "auth.verify.sentToUnknown": "Poslali smo ti 6-cifreni kod na email adresu koju si uneo/la.",
    "auth.verify.enterBelow": "Unesi ga ispod da završiš registraciju.",
    "auth.verify.noCode": "Nisi dobio/la kod?",
    "auth.verify.backToRegPrefix": "Vrati se na",
    "auth.verify.regLink": "registraciju",
    "auth.verify.backToRegSuffix": "da ponovo zatražiš kod.",
    "auth.verify.wrongAddress": "Pogrešna adresa?",
    "auth.verify.editEmailLink": "Izmeni email",
    "auth.verify.resendAfterEdit": "i pošalji kod ponovo.",
    "auth.verify.desktopHint": "Otvaraš na računaru? Možeš i da klikneš link iz mejla.",
    "auth.verify.alreadyConfirmed": "Već potvrdio/la nalog?",

    // Resend code (resend-form)
    "auth.resend.retryIn": "Pošalji ponovo ({seconds}s)",
    "auth.resend.retry": "Pošalji ponovo",
    "auth.resend.success":
      "Poslali smo novi link za potvrdu na tvoj email. Proveri i „Spam“ / „Promocije“ folder.",

    // Verify code form
    "auth.verifyCode.label": "Kod iz mejla",
    "auth.verifyCode.submitting": "Potvrđivanje…",
    "auth.verifyCode.submit": "Potvrdi nalog",

    // New password (/nova-lozinka)
    "auth.newPassword.title": "Nova lozinka",
    "auth.newPassword.subtitle": "Postavi novu lozinku za svoj nalog.",
    "auth.newPassword.linkExpired": "Link je istekao?",
    "auth.newPassword.requestNew": "Zatraži novi",
    "auth.newPassword.save": "Sačuvaj novu lozinku",
    "auth.field.newPassword": "Nova lozinka",
    "auth.field.confirmNewPassword": "Ponovi novu lozinku",

    // Password input reveal toggle
    "auth.password.hide": "Sakrij lozinku",
    "auth.password.show": "Prikaži lozinku",

    // Phone capture page (/telefon)
    "auth.phonePage.title": "Broj telefona?",
    "auth.phonePage.subtitle":
      "Ako želiš, ostavi broj da bismo mogli da te kontaktiramo. Nije obavezan — aplikacija radi isto i bez njega, a možeš ga dodati ili obrisati kasnije u Profilu.",
    "auth.phoneForm.save": "Sačuvaj i nastavi",
    "auth.phoneForm.skip": "Preskoči",

    // Forgot password (/zaboravljena-lozinka)
    "auth.forgot.title": "Zaboravljena lozinka",
    "auth.forgot.subtitle":
      "Unesi email adresu naloga i poslaćemo ti link za postavljanje nove lozinke.",
    "auth.forgot.remembered": "Setio/la si se lozinke?",
    "auth.forgot.emailLabel": "Email",
    "auth.forgot.emailPlaceholder": "ti@email.com",
    "auth.forgot.submit": "Pošalji link",
  },
  en: {
    // Shared
    "auth.sending": "Sending…",
    "auth.saving": "Saving…",
    "auth.link.signIn": "Sign in",
    "auth.link.signUp": "Sign up",

    // Sign in (/prijava)
    "auth.signIn.title": "Sign in",
    "auth.signIn.subtitle": "Enter your email and password to continue.",
    "auth.signIn.confirmExpired":
      "That confirmation link has expired or has already been used. Sign in, or request a new link from the sign-up page.",
    "auth.signIn.forgotLink": "Forgot your password?",
    "auth.signIn.noAccount": "Don't have an account?",

    // Sign up (/registracija)
    "auth.signUp.title": "Create an account",
    "auth.signUp.subtitle": "Enter your email and password to start tracking your meals.",
    "auth.signUp.haveAccount": "Already have an account?",

    // Third-party sign-in block (social-sign-in.tsx)
    "auth.oauth.or": "or",
    "auth.oauth.apple": "Continue with Apple",
    "auth.oauth.appleRedirecting": "Redirecting to Apple…",
    "auth.oauth.google": "Continue with Google",
    "auth.oauth.googleRedirecting": "Redirecting to Google…",

    // Phone field (shared signup + /telefon)
    "auth.phone.label": "Phone number",
    "auth.phone.labelOptional": "Phone number (optional)",
    "auth.phone.dialCodeAria": "Country dial code",

    // Verify email (/registracija/proveri-email)
    "auth.verify.title": "Confirm your account",
    "auth.verify.sentTo": "We sent a 6-digit code to",
    "auth.verify.sentToUnknown": "We sent a 6-digit code to the email address you entered.",
    "auth.verify.enterBelow": "Enter it below to finish signing up.",
    "auth.verify.noCode": "Didn't get the code?",
    "auth.verify.backToRegPrefix": "Head back to",
    "auth.verify.regLink": "sign-up",
    "auth.verify.backToRegSuffix": "to request the code again.",
    "auth.verify.wrongAddress": "Wrong address?",
    "auth.verify.editEmailLink": "Edit email",
    "auth.verify.resendAfterEdit": "and send the code again.",
    "auth.verify.desktopHint": "Opening on a computer? You can also click the link from the email.",
    "auth.verify.alreadyConfirmed": "Already confirmed your account?",

    // Resend code (resend-form)
    "auth.resend.retryIn": "Resend ({seconds}s)",
    "auth.resend.retry": "Resend",
    "auth.resend.success":
      "We sent a new confirmation link to your email. Check your Spam / Promotions folder too.",

    // Verify code form
    "auth.verifyCode.label": "Code from the email",
    "auth.verifyCode.submitting": "Confirming…",
    "auth.verifyCode.submit": "Confirm account",

    // New password (/nova-lozinka)
    "auth.newPassword.title": "New password",
    "auth.newPassword.subtitle": "Set a new password for your account.",
    "auth.newPassword.linkExpired": "Link expired?",
    "auth.newPassword.requestNew": "Request a new one",
    "auth.newPassword.save": "Save new password",
    "auth.field.newPassword": "New password",
    "auth.field.confirmNewPassword": "Repeat new password",

    // Password input reveal toggle
    "auth.password.hide": "Hide password",
    "auth.password.show": "Show password",

    // Phone capture page (/telefon)
    "auth.phonePage.title": "Your phone number?",
    "auth.phonePage.subtitle":
      "Leave a number if you want us to be able to reach you. It is optional — the app works exactly the same without it, and you can add or remove it later in Profile.",
    "auth.phoneForm.save": "Save and continue",
    "auth.phoneForm.skip": "Skip",

    // Forgot password (/zaboravljena-lozinka)
    "auth.forgot.title": "Forgot password",
    "auth.forgot.subtitle":
      "Enter your account's email address and we'll send you a link to set a new password.",
    "auth.forgot.remembered": "Remembered your password?",
    "auth.forgot.emailLabel": "Email",
    "auth.forgot.emailPlaceholder": "you@email.com",
    "auth.forgot.submit": "Send link",
  },
} as const;
