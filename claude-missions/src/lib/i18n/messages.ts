import type { Locale } from "@/lib/i18n/locale";

/**
 * UI copy dictionary. Serbian (`sr`) is the SOURCE OF TRUTH for the set of
 * keys; `en` is typed as `Record<MessageKey, string>`, so TypeScript fails the
 * build if an English string is missing (or a stray key is added). Add new
 * keys here, namespaced by surface (`nav.*`, `settings.*`, `home.*`, ...).
 *
 * Only strings that live in this dictionary switch language; the rest of the
 * app is still Serbian and is being migrated surface by surface. A key with no
 * translation for the active locale falls back to Serbian, then to the key.
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
  "settings.personal": "Lični podaci",
  "settings.personal.desc": "Pol, godine, visina, težina, aktivnost",
  "settings.steps": "Cilj koraka",
  "settings.steps.desc": "Automatski po aktivnosti ili tvoj broj",
  "settings.habits": "Navike",
  "settings.habits.desc": "Čekiraj dnevne navike i prati niz",
  "settings.group.app": "Aplikacija",
  "settings.appearance": "Izgled",
  "settings.language": "Jezik",
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

  // Theme toggle (Appearance)
  "theme.light": "Svetla",
  "theme.dark": "Tamna",

  // Home (/danas)
  "home.dailyIntake": "Dnevni unos",
  "home.mealsToday": "Obroci danas",
  "home.mealsOn": "Obroci · {date}",
  "home.noTarget": "Cilj još nije podešen, pa ne možemo da prikažemo tvoj dnevni budžet.",
  "home.view.consumed": "Potrošeno",
  "home.view.remaining": "Preostalo",
  "home.view.aria": "Prikaz kalorija i makroa",
  "home.meals.empty": "Još ništa nisi uneo/unela danas.",
  "home.meals.empty.cta": "Slikaj obrok",

  // Calorie ring
  "ring.target": "Cilj",
  "ring.consumed": "Potrošeno",
  "ring.remaining": "Preostalo",

  // Macros
  "macro.protein": "Proteini",
  "macro.fat": "Masti",
  "macro.carbs": "UH",
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
  "settings.personal": "Personal details",
  "settings.personal.desc": "Sex, age, height, weight, activity",
  "settings.steps": "Step goal",
  "settings.steps.desc": "Automatic by activity, or your own number",
  "settings.habits": "Habits",
  "settings.habits.desc": "Check off daily habits and keep your streak",
  "settings.group.app": "App",
  "settings.appearance": "Appearance",
  "settings.language": "Language",
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

  "theme.light": "Light",
  "theme.dark": "Dark",

  "home.dailyIntake": "Daily intake",
  "home.mealsToday": "Meals today",
  "home.mealsOn": "Meals · {date}",
  "home.noTarget": "You haven't set a goal yet, so we can't show your daily budget.",
  "home.view.consumed": "Consumed",
  "home.view.remaining": "Remaining",
  "home.view.aria": "Calorie and macro display",
  "home.meals.empty": "Nothing logged yet today.",
  "home.meals.empty.cta": "Snap a meal",

  "ring.target": "Goal",
  "ring.consumed": "Consumed",
  "ring.remaining": "Remaining",

  "macro.protein": "Protein",
  "macro.fat": "Fat",
  "macro.carbs": "Carbs",
};

export const messages: Record<Locale, Record<MessageKey, string>> = { sr, en };
