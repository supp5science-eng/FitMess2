import type { Locale } from "@/lib/i18n/locale";
import { adminMessages } from "@/lib/i18n/messages-parts/admin";
import { analyticsMessages } from "@/lib/i18n/messages-parts/analytics";
import { appMessages } from "@/lib/i18n/messages-parts/app";
import { authMessages } from "@/lib/i18n/messages-parts/auth";
import { dataMessages } from "@/lib/i18n/messages-parts/data";
import { dodajMessages } from "@/lib/i18n/messages-parts/dodaj";
import { foodMessages } from "@/lib/i18n/messages-parts/food";
import { homeExtraMessages } from "@/lib/i18n/messages-parts/home";
import { legalMessages } from "@/lib/i18n/messages-parts/legal";
import { mediaMessages } from "@/lib/i18n/messages-parts/media";
import { merenjeMessages } from "@/lib/i18n/messages-parts/merenje";
import { onboardingMessages } from "@/lib/i18n/messages-parts/onboarding";
import { profilMessages } from "@/lib/i18n/messages-parts/profil";
import { sourcesMessages } from "@/lib/i18n/messages-parts/sources";
import { treningMessages } from "@/lib/i18n/messages-parts/trening";

/**
 * UI copy dictionary. Serbian (`sr`) is the SOURCE OF TRUTH for the set of
 * keys; `en` is typed as `Record<MessageKey, string>`, so TypeScript fails the
 * build if an English string is missing (or a stray key is added). Add new
 * keys here, namespaced by surface (`nav.*`, `settings.*`, `home.*`, ...).
 *
 * Larger per-surface copy sets live in `messages-parts/*` fragment modules
 * (each `{ sr, en }` with identical key sets) and are spread in below; small
 * shared/global keys stay inline here. A key with no translation for the
 * active locale falls back to Serbian, then to the key.
 */
const sr = {
  // Bottom navigation
  "nav.home": "Početna",
  "nav.analytics": "Analitika",
  "nav.profile": "Profil",

  // Settings (/profil)
  "settings.title": "Podešavanja",
  "settings.group.account": "Nalog",
  "settings.email": "Email",
  "settings.phone": "Broj telefona",
  "settings.phone.add": "Dodaj",
  "settings.password": "Promeni lozinku",
  "settings.group.goal": "Cilj i plan",
  "settings.goal": "Cilj i plan",
  "settings.goal.desc": "Promeni cilj i preračunaj kalorije",
  "settings.klon": "Tvoj klon",
  "settings.klon.desc": "Pogledaj ga ili ga napravi ponovo iz nule",
  "settings.personal": "Lični podaci",
  "settings.personal.desc": "Pol, godine, visina, težina, aktivnost",
  "settings.steps": "Cilj koraka",
  "settings.steps.desc": "Automatski po aktivnosti ili tvoj broj",
  "settings.weighIn": "Dan merenja",
  "settings.weighIn.desc": "Kad te pitamo za težinu i da li da javimo",
  "settings.habits": "Navike",
  "settings.habits.desc": "Čekiraj dnevne navike i prati niz",
  "settings.group.app": "Aplikacija",
  "settings.language": "Jezik",
  "settings.sound": "Zvuk klika",
  "settings.sound.desc": "Kratak tik na svaki dodir",
  "settings.reminders": "Podsetnici",
  "settings.reminders.desc": "Javimo se ako dan prođe bez ijednog unosa",
  "settings.group.admin": "Admin",
  "settings.admin": "Admin panel",
  "settings.group.privacy": "Podaci i privatnost",
  "settings.mydata": "Moji podaci",
  "settings.mydata.desc": "Vidi šta čuvamo o tebi i preuzmi kopiju",
  "settings.privacy": "Politika privatnosti",
  "settings.terms": "Uslovi korišćenja",
  "settings.group.support": "Podrška",
  "settings.contact": "Kontaktiraj podršku",
  "settings.version": "Verzija aplikacije",
  "settings.signout": "Odjavi se",
  "settings.delete": "Obriši nalog",

  // Napomena na dnu Podešavanja (poslednje što se vidi kad se doskroluje)
  "settings.disclaimer.title": "FitMess nije medicinski savet",
  "settings.disclaimer.body":
    "Ovo je alat za praćenje ishrane. Kalorije, makronutrijenti i AI procene su informativni i mogu da odstupe od stvarnih vrednosti. Ne postavljamo dijagnozu i ne zamenjujemo lekara ni nutricionistu — pre veće promene ishrane, a obavezno ako imaš zdravstveno stanje, pitaj svog lekara.",
  "settings.disclaimer.more": "Pročitaj uslove korišćenja",

  // Home (/danas)
  "home.dailyIntake": "Dnevni unos",
  "home.mealsToday": "Obroci danas",
  "home.mealsOn": "Obroci · {date}",
  "home.noTarget": "Cilj još nije podešen, pa ne možemo da prikažemo tvoj dnevni budžet.",
  "home.view.consumed": "Potrošeno",
  "home.view.remaining": "Preostalo",
  "home.view.aria": "Prikaz kalorija i makroa",
  "home.meals.empty": "Još ništa nisi uneo/unela danas.",
  // Opens the "+" menu, so it must not name one method inside it. Same words
  // as that menu's own title, so the button and what it opens agree.
  "home.meals.empty.cta": "Dodaj unos",

  // Calorie ring
  "ring.target": "Cilj",
  "ring.consumed": "Potrošeno",
  "ring.remaining": "Preostalo",

  // Macros
  "macro.protein": "Proteini",
  "macro.fat": "Masti",
  "macro.carbs": "UH",

  // Per-surface fragments (Serbian source strings)
  ...authMessages.sr,
  ...profilMessages.sr,
  ...dodajMessages.sr,
  ...onboardingMessages.sr,
  ...homeExtraMessages.sr,
  ...analyticsMessages.sr,
  ...foodMessages.sr,
  ...mediaMessages.sr,
  ...adminMessages.sr,
  ...appMessages.sr,
  ...dataMessages.sr,
  ...merenjeMessages.sr,
  ...treningMessages.sr,
  ...legalMessages.sr,
  ...sourcesMessages.sr,
} as const;

export type MessageKey = keyof typeof sr;

const en: Record<MessageKey, string> = {
  "nav.home": "Home",
  "nav.analytics": "Analytics",
  "nav.profile": "Profile",

  "settings.title": "Settings",
  "settings.group.account": "Account",
  "settings.email": "Email",
  "settings.phone": "Phone number",
  "settings.phone.add": "Add",
  "settings.password": "Change password",
  "settings.group.goal": "Goal & plan",
  "settings.goal": "Goal & plan",
  "settings.goal.desc": "Change your goal and recalculate calories",
  "settings.klon": "Your klon",
  "settings.klon.desc": "Look at it, or draw it again from scratch",
  "settings.personal": "Personal details",
  "settings.personal.desc": "Sex, age, height, weight, activity",
  "settings.steps": "Step goal",
  "settings.steps.desc": "Automatic by activity, or your own number",
  "settings.weighIn": "Weigh-in day",
  "settings.weighIn.desc": "When we ask for your weight, and whether we ping you",
  "settings.habits": "Habits",
  "settings.habits.desc": "Check off daily habits and keep your streak",
  "settings.group.app": "App",
  "settings.language": "Language",
  "settings.sound": "Click sound",
  "settings.sound.desc": "A short tick on every tap",
  "settings.reminders": "Reminders",
  "settings.reminders.desc": "We'll nudge you if a day goes by with nothing logged",
  "settings.group.admin": "Admin",
  "settings.admin": "Admin panel",
  "settings.group.privacy": "Data & privacy",
  "settings.mydata": "My data",
  "settings.mydata.desc": "See what we store about you and download a copy",
  "settings.privacy": "Privacy policy",
  "settings.terms": "Terms of use",
  "settings.group.support": "Support",
  "settings.contact": "Contact support",
  "settings.version": "App version",
  "settings.signout": "Sign out",
  "settings.delete": "Delete account",

  "settings.disclaimer.title": "FitMess is not medical advice",
  "settings.disclaimer.body":
    "This is a food-tracking tool. Calories, macronutrients and AI estimates are informational and can differ from the real values. We do not diagnose and we do not replace a doctor or a dietitian — before any major change to your diet, and always if you have a medical condition, ask your doctor.",
  "settings.disclaimer.more": "Read the terms of use",


  "home.dailyIntake": "Daily intake",
  "home.mealsToday": "Meals today",
  "home.mealsOn": "Meals · {date}",
  "home.noTarget": "You haven't set a goal yet, so we can't show your daily budget.",
  "home.view.consumed": "Consumed",
  "home.view.remaining": "Remaining",
  "home.view.aria": "Calorie and macro display",
  "home.meals.empty": "Nothing logged yet today.",
  "home.meals.empty.cta": "Add entry",

  "ring.target": "Goal",
  "ring.consumed": "Consumed",
  "ring.remaining": "Remaining",

  "macro.protein": "Protein",
  "macro.fat": "Fat",
  "macro.carbs": "Carbs",

  // Per-surface fragments (English translations)
  ...authMessages.en,
  ...profilMessages.en,
  ...dodajMessages.en,
  ...onboardingMessages.en,
  ...homeExtraMessages.en,
  ...analyticsMessages.en,
  ...foodMessages.en,
  ...mediaMessages.en,
  ...adminMessages.en,
  ...appMessages.en,
  ...dataMessages.en,
  ...merenjeMessages.en,
  ...treningMessages.en,
  ...legalMessages.en,
  ...sourcesMessages.en,
};

export const messages: Record<Locale, Record<MessageKey, string>> = { sr, en };
