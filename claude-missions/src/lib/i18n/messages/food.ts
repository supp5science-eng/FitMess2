// "food" UI copy. Filled by the i18n translation pass. Add keys to BOTH sr and
// en, keeping this typed structure (Serbian is the source of truth; en is typed
// against the sr keys so a missing translation fails the build). Namespace all
// keys as "food.<name>".
const sr = {
  // Food list row badges
  "food.badgeDefault": "default",
  "food.badgeUnverified": "neprovereno",
  "food.badgeRecent": "nedavno",

  // Search screen
  "food.searchTitle": "Dodaj hranu",
  "food.searchSubtitle":
    "Pretraži namirnicu ili brzo dodaj nešto što si nedavno jeo/la.",
  "food.searchLabel": "Pretraga hrane",
  "food.searchPlaceholder": "Npr. pileća supa, jabuka, jogurt...",
  "food.searchHelp": "Upiši naziv namirnice na srpskom, latinicom ili ćirilicom.",
  "food.searchFailed": "Pretraga trenutno ne radi. Pokušaj ponovo.",
  "food.recentsEmpty":
    "Još nemaš nijednu nedavno korišćenu namirnicu. Otkucaj naziv iznad da pretražiš — uskoro ćeš moći i da skeniraš bar-kod ili fotografišeš nalepnicu.",
  "food.recentsHeading": "Nedavno korišćeno",
  "food.retry": "Pokušaj ponovo",
  "food.noResultsHeading": "Nema rezultata za \"{query}\".",
  "food.noResultsBody":
    "Probaj drugačiji naziv ili proveri kucanje — uskoro ćeš moći i da skeniraš bar-kod ili fotografišeš nalepnicu.",

  // Portion picker / shared portion + preview UI
  "food.commonPortion": "Uobičajena porcija",
  "food.quantity": "Količina",
  "food.amountInGrams": "Količina u gramima",
  "food.calories": "Kalorije",
  "food.proteinLine": "Proteini: {g} g",
  "food.carbsLine": "UH: {g} g",
  "food.fatLine": "Masti: {g} g",
  "food.quantityMin": "Unesi količinu veću od 0 grama.",
  "food.saving": "Čuvanje...",
  "food.addToDiary": "Dodaj u dnevnik",
  "food.portionSaveFailed": "Nismo uspeli da sačuvamo unos. Pokušaj ponovo.",

  // Log edit sheet
  "food.edit": "Izmeni",
  "food.cancel": "Otkaži",
  "food.saveEdit": "Sačuvaj izmenu",
  "food.editSaveFailed": "Nismo uspeli da izmenimo unos. Pokušaj ponovo.",

  // Log delete confirm
  "food.delete": "Obriši",
  "food.deleteTitle": "Obrisati unos “{name}”?",
  "food.cannotUndo": "Ova radnja se ne može poništiti.",
  "food.deleting": "Brišemo...",
  "food.deleteFailed": "Nismo uspeli da obrišemo unos. Pokušaj ponovo.",

  // Log "add more" sheet
  "food.addMore": "Dodaj još",
  "food.add": "Dodaj",
  "food.savingProgress": "Čuvamo…",
  "food.addMoreSaveFailed": "Nismo uspeli da dodamo. Pokušaj ponovo.",
  "food.splitNote":
    "Ovaj obrok nismo uspeli da razložimo na namirnice — možeš da dodaš ceo unos još jednom.",
  "food.wholeMeal": "ceo obrok",
  "food.soFar": "do sada: {kcal} kcal · {grams} g",
  "food.splitting": "Razlažemo obrok na namirnice…",
  "food.splittingHint": "Za koji trenutak biraš tačno šta si još pojeo/la.",
  "food.howMuchMore": "Koliko si još pojeo/la?",
  "food.inMeal": "u obroku: {amount}",
  "food.wholeMealAgain": "Ceo obrok još jednom",
  "food.sameAgain": "Još isto",
  "food.tapPlus": "Dodirni + kod onoga što si još pojeo/la.",
  "food.mealBecomes": "obrok postaje {kcal} kcal",
  "food.stepDecrease": "Smanji: {label}",
  "food.stepIncrease": "Dodaj: {label}",

  // New product form
  "food.createFailed": "Nismo uspeli da sačuvamo proizvod. Pokušaj ponovo.",
  "food.labelReadFailed":
    "Nismo uspeli da pročitamo deklaraciju. Uslikaj tabelu izbliza i pokušaj ponovo.",
  "food.fillFromLabel": "Popuni sa deklaracije",
  "food.fillFromLabelHint":
    "Slikaj ili otpremi nutritivnu tabelu — AI popuni vrednosti, ti samo proveriš.",
  "food.readingLabel": "Čitam deklaraciju…",
  "food.takePhoto": "Slikaj",
  "food.upload": "Otpremi",
  "food.nameLabel": "Naziv namirnice",
  "food.namePlaceholder": "Npr. Jogurt, Smoki, čips",
  "food.brandLabel": "Brend (opciono)",
  "food.brandPlaceholder": "Npr. Podravka",
  "food.barcodeLabel": "Barkod (opciono)",
  "food.barcodePlaceholder": "Npr. 5901234123457",
  "food.priceLabel": "Cena (RSD, opciono)",
  "food.pricePlaceholder": "Npr. 149.99",
  "food.valuesPer100g": "Vrednosti na 100g",
  "food.valuesPer100gHint": "Unesi vrednosti sa deklaracije proizvoda, po 100 grama.",
  "food.kcalLabel": "Kalorije (kcal)",
  "food.proteinLabel": "Proteini (g)",
  "food.carbsLabel": "Ugljeni hidrati (g)",
  "food.fatLabel": "Masti (g)",
  "food.openExisting": "Otvori postojeći proizvod",
  "food.saveProduct": "Sačuvaj proizvod",
} as const;

const en: Record<keyof typeof sr, string> = {
  // Food list row badges
  "food.badgeDefault": "default",
  "food.badgeUnverified": "unverified",
  "food.badgeRecent": "recent",

  // Search screen
  "food.searchTitle": "Add food",
  "food.searchSubtitle":
    "Search for a food, or quickly add something you ate recently.",
  "food.searchLabel": "Food search",
  "food.searchPlaceholder": "e.g. chicken soup, apple, yogurt...",
  "food.searchHelp": "Type a food name in Serbian, in Latin or Cyrillic script.",
  "food.searchFailed": "Search isn't working right now. Try again.",
  "food.recentsEmpty":
    "You don't have any recently used foods yet. Type a name above to search — soon you'll also be able to scan a barcode or photograph a label.",
  "food.recentsHeading": "Recently used",
  "food.retry": "Try again",
  "food.noResultsHeading": "No results for \"{query}\".",
  "food.noResultsBody":
    "Try a different name or check your spelling — soon you'll also be able to scan a barcode or photograph a label.",

  // Portion picker / shared portion + preview UI
  "food.commonPortion": "Common portion",
  "food.quantity": "Quantity",
  "food.amountInGrams": "Amount in grams",
  "food.calories": "Calories",
  "food.proteinLine": "Protein: {g} g",
  "food.carbsLine": "Carbs: {g} g",
  "food.fatLine": "Fat: {g} g",
  "food.quantityMin": "Enter an amount greater than 0 grams.",
  "food.saving": "Saving...",
  "food.addToDiary": "Add to diary",
  "food.portionSaveFailed": "We couldn't save the entry. Try again.",

  // Log edit sheet
  "food.edit": "Edit",
  "food.cancel": "Cancel",
  "food.saveEdit": "Save change",
  "food.editSaveFailed": "We couldn't update the entry. Try again.",

  // Log delete confirm
  "food.delete": "Delete",
  "food.deleteTitle": "Delete the entry “{name}”?",
  "food.cannotUndo": "This action can't be undone.",
  "food.deleting": "Deleting...",
  "food.deleteFailed": "We couldn't delete the entry. Try again.",

  // Log "add more" sheet
  "food.addMore": "Add more",
  "food.add": "Add",
  "food.savingProgress": "Saving…",
  "food.addMoreSaveFailed": "We couldn't add it. Try again.",
  "food.splitNote":
    "We couldn't break this meal down into foods — you can add the whole entry once more.",
  "food.wholeMeal": "whole meal",
  "food.soFar": "so far: {kcal} kcal · {grams} g",
  "food.splitting": "Breaking the meal down into foods…",
  "food.splittingHint": "In a moment you'll pick exactly what else you ate.",
  "food.howMuchMore": "How much more did you eat?",
  "food.inMeal": "in the meal: {amount}",
  "food.wholeMealAgain": "The whole meal again",
  "food.sameAgain": "Same again",
  "food.tapPlus": "Tap + next to whatever else you ate.",
  "food.mealBecomes": "meal becomes {kcal} kcal",
  "food.stepDecrease": "Decrease: {label}",
  "food.stepIncrease": "Add: {label}",

  // New product form
  "food.createFailed": "We couldn't save the product. Try again.",
  "food.labelReadFailed":
    "We couldn't read the label. Take a close-up photo of the table and try again.",
  "food.fillFromLabel": "Fill from the label",
  "food.fillFromLabelHint":
    "Photograph or upload the nutrition table — AI fills in the values, you just check them.",
  "food.readingLabel": "Reading the label…",
  "food.takePhoto": "Take photo",
  "food.upload": "Upload",
  "food.nameLabel": "Food name",
  "food.namePlaceholder": "e.g. yogurt, chips, crackers",
  "food.brandLabel": "Brand (optional)",
  "food.brandPlaceholder": "e.g. Podravka",
  "food.barcodeLabel": "Barcode (optional)",
  "food.barcodePlaceholder": "e.g. 5901234123457",
  "food.priceLabel": "Price (RSD, optional)",
  "food.pricePlaceholder": "e.g. 149.99",
  "food.valuesPer100g": "Values per 100g",
  "food.valuesPer100gHint": "Enter the values from the product label, per 100 grams.",
  "food.kcalLabel": "Calories (kcal)",
  "food.proteinLabel": "Protein (g)",
  "food.carbsLabel": "Carbs (g)",
  "food.fatLabel": "Fat (g)",
  "food.openExisting": "Open existing product",
  "food.saveProduct": "Save product",
};

export const food = { sr, en };
