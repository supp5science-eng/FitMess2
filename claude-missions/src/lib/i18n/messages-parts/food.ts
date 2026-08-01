export const foodMessages = {
  sr: {
    // Shared across food surfaces
    "food.cancel": "Otkaži",
    "food.calories": "Kalorije",

    // Search screen (/dodaj/pretraga)
    "food.search.title": "Dodaj hranu",
    "food.search.subtitle":
      "Pretraži namirnicu ili brzo dodaj nešto što si nedavno jeo/la.",
    "food.search.label": "Pretraga hrane",
    "food.search.placeholder": "Npr. pileća supa, jabuka, jogurt...",
    "food.search.help":
      "Upiši naziv namirnice na srpskom, latinicom ili ćirilicom.",
    "food.search.failedError": "Pretraga trenutno ne radi. Pokušaj ponovo.",
    "food.search.retry": "Pokušaj ponovo",
    "food.search.recentsHeading": "Nedavno korišćeno",
    "food.search.recentsEmpty":
      "Još nemaš nijednu nedavno korišćenu namirnicu. Otkucaj naziv iznad da pretražiš — uskoro ćeš moći i da skeniraš bar-kod ili fotografišeš nalepnicu.",
    "food.search.noResultsHeading": 'Nema rezultata za "{query}".',
    "food.search.noResultsBody":
      "Probaj drugačiji naziv ili proveri kucanje — uskoro ćeš moći i da skeniraš bar-kod ili fotografišeš nalepnicu.",

    // Food list item badges
    "food.item.unverified": "neprovereno",
    "food.item.recent": "nedavno",

    // Portion picker
    "food.portion.commonPortion": "Uobičajena porcija",
    "food.portion.quantity": "Količina",
    "food.portion.gramsLabel": "Količina u gramima",
    "food.portion.minGramsError": "Unesi količinu veću od 0 grama.",
    "food.portion.saving": "Čuvanje...",
    "food.portion.saveError": "Nismo uspeli da sačuvamo unos. Pokušaj ponovo.",
    "food.portion.confirm": "Dodaj u dnevnik",

    // Log edit sheet
    "food.logEdit.open": "Izmeni",
    "food.logEdit.save": "Sačuvaj izmenu",
    "food.logEdit.saveError": "Nismo uspeli da izmenimo unos. Pokušaj ponovo.",

    // Log delete confirm
    "food.logDelete.open": "Obriši",
    "food.logDelete.title": "Obrisati unos “{name}”?",
    "food.logDelete.warning": "Ova radnja se ne može poništiti.",
    "food.logDelete.deleting": "Brišemo...",
    "food.logDelete.error": "Nismo uspeli da obrišemo unos. Pokušaj ponovo.",

    // Add-more sheet
    "food.addMore.open": "Dodaj još",
    "food.addMore.saveError": "Nismo uspeli da dodamo. Pokušaj ponovo.",
    "food.addMore.splitNote":
      "Ovaj obrok nismo uspeli da razložimo na namirnice — možeš da dodaš ceo unos još jednom.",
    "food.addMore.wholeMeal": "ceo obrok",
    "food.addMore.wholeMealMultiple": "{count} × ceo obrok",
    "food.addMore.soFar": "do sada: {kcal} kcal · {grams} g",
    "food.addMore.splitting": "Razlažemo obrok na namirnice…",
    "food.addMore.splittingHint": "Za koji trenutak biraš tačno šta si još pojeo/la.",
    "food.addMore.howMuchMore": "Koliko si još pojeo/la?",
    "food.addMore.inMeal": "u obroku: {amount}",
    "food.addMore.wholeAgain": "Ceo obrok još jednom",
    "food.addMore.sameAgain": "Još isto",
    "food.addMore.emptyHint": "Dodirni + kod onoga što si još pojeo/la.",
    "food.addMore.mealBecomes": "obrok postaje {kcal} kcal",
    "food.addMore.saving": "Čuvamo…",
    "food.addMore.add": "Dodaj",
    "food.addMore.decrease": "Smanji: {label}",
    "food.addMore.increase": "Dodaj: {label}",
    "food.addMore.close": "Zatvori",
    "food.addMore.extrasHeading": "Nije bilo na slici?",
    "food.addMore.extrasHint": "Ono što se najčešće zaboravi — jedan dodir je jedna kašika.",
    "food.addMore.extrasWrite": "Nešto drugo",
    "food.addMore.extrasWriteHint": "Napiši svojim rečima — ne moraš da tražiš po spisku.",
    "food.addMore.extrasWriteLabel": "Šta si još pojeo/la?",
    "food.addMore.extrasWritePlaceholder": "Npr. tartar sos, pita od višanja…",
    "food.addMore.extrasAmountLabel": "Količina",
    "food.addMore.extrasAmountPlaceholder": "2 kašike, pola šolje…",
    "food.addMore.extrasEstimate": "Izračunaj",
    "food.addMore.extrasEstimating": "Računamo…",
    "food.addMore.extrasWriteFailed": "Nismo uspeli da procenimo. Pokušaj ponovo.",
    "food.addMore.extrasPerUnit": "{unit} · {kcal} kcal",

    // "Koliko si pojeo" — koliko je od unetog obroka stvarno pojedeno
    "food.eaten.open": "Koliko si pojeo",
    "food.eaten.openWithShare": "Pojedeno {share}%",
    "food.eaten.save": "Sačuvaj",
    "food.eaten.saveError": "Nismo uspeli da sačuvamo. Pokušaj ponovo.",

    // New product form
    "food.newProduct.labelReadError":
      "Nismo uspeli da pročitamo deklaraciju. Uslikaj tabelu izbliza i pokušaj ponovo.",
    "food.newProduct.fillFromLabel": "Popuni sa deklaracije",
    "food.newProduct.fillFromLabelDesc":
      "Slikaj ili otpremi nutritivnu tabelu — AI popuni vrednosti, ti samo proveriš.",
    "food.newProduct.readingLabel": "Čitam deklaraciju…",
    "food.newProduct.photo": "Slikaj",
    "food.newProduct.upload": "Otpremi",
    "food.newProduct.nameLabel": "Naziv namirnice",
    "food.newProduct.namePlaceholder": "Npr. Jogurt, Smoki, čips",
    "food.newProduct.brandLabel": "Brend (opciono)",
    "food.newProduct.brandPlaceholder": "Npr. Podravka",
    "food.newProduct.barcodeLabel": "Barkod (opciono)",
    "food.newProduct.barcodePlaceholder": "Npr. 5901234123457",
    "food.newProduct.priceLabel": "Cena (RSD, opciono)",
    "food.newProduct.pricePlaceholder": "Npr. 149.99",
    "food.newProduct.per100gHeading": "Vrednosti na 100g",
    "food.newProduct.per100gDesc":
      "Unesi vrednosti sa deklaracije proizvoda, po 100 grama.",
    "food.newProduct.kcalLabel": "Kalorije (kcal)",
    "food.newProduct.proteinLabel": "Proteini (g)",
    "food.newProduct.carbsLabel": "Ugljeni hidrati (g)",
    "food.newProduct.fatLabel": "Masti (g)",
    "food.newProduct.openExisting": "Otvori postojeći proizvod",
    "food.newProduct.submit": "Sačuvaj proizvod",

    // Share meal sheet
    "food.share.share": "Podeli",
    "food.share.shareAgain": "Podeli ponovo",
    "food.share.save": "Sačuvaj",
    "food.share.saveAgain": "Sačuvaj ponovo",
    "food.share.dialogAria": "Podeli karticu obroka",
    "food.share.heading": "Podeli obrok",
    "food.share.close": "Zatvori",
    "food.share.buildError":
      "Nismo uspeli da napravimo karticu. Zatvori pa pokušaj ponovo.",
    "food.share.previewAlt": "Pregled kartice za deljenje",
    "food.share.zoomOpen": "Prikaži karticu u punoj veličini",
    "food.share.zoomAria": "Kartica u punoj veličini",
    "food.share.zoomClose": "Zatvori prikaz",
    "food.share.building": "Pravim karticu…",
    "food.share.savedStatus": "Sačuvano. 🔥",
    "food.share.sharedStatus": "Podeljeno. 🔥",
    "food.share.idleStatus": "Tvoja fotka, tvoji brojevi — spremno za priču.",
  },
  en: {
    // Shared across food surfaces
    "food.cancel": "Cancel",
    "food.calories": "Calories",

    // Search screen (/dodaj/pretraga)
    "food.search.title": "Add food",
    "food.search.subtitle":
      "Search for a food or quickly add something you've eaten recently.",
    "food.search.label": "Food search",
    "food.search.placeholder": "e.g. chicken soup, apple, yogurt...",
    "food.search.help":
      "Type a food name in Serbian, in Latin or Cyrillic script.",
    "food.search.failedError": "Search isn't working right now. Try again.",
    "food.search.retry": "Try again",
    "food.search.recentsHeading": "Recently used",
    "food.search.recentsEmpty":
      "You don't have any recently used foods yet. Type a name above to search — soon you'll also be able to scan a barcode or photograph a label.",
    "food.search.noResultsHeading": 'No results for "{query}".',
    "food.search.noResultsBody":
      "Try a different name or check your spelling — soon you'll also be able to scan a barcode or photograph a label.",

    // Food list item badges
    "food.item.unverified": "unverified",
    "food.item.recent": "recent",

    // Portion picker
    "food.portion.commonPortion": "Common portion",
    "food.portion.quantity": "Quantity",
    "food.portion.gramsLabel": "Amount in grams",
    "food.portion.minGramsError": "Enter an amount greater than 0 grams.",
    "food.portion.saving": "Saving...",
    "food.portion.saveError": "We couldn't save your entry. Try again.",
    "food.portion.confirm": "Add to diary",

    // Log edit sheet
    "food.logEdit.open": "Edit",
    "food.logEdit.save": "Save changes",
    "food.logEdit.saveError": "We couldn't edit your entry. Try again.",

    // Log delete confirm
    "food.logDelete.open": "Delete",
    "food.logDelete.title": "Delete the entry “{name}”?",
    "food.logDelete.warning": "This action can't be undone.",
    "food.logDelete.deleting": "Deleting...",
    "food.logDelete.error": "We couldn't delete your entry. Try again.",

    // Add-more sheet
    "food.addMore.open": "Add more",
    "food.addMore.saveError": "We couldn't add it. Try again.",
    "food.addMore.splitNote":
      "We couldn't break this meal down into foods — you can add the whole entry one more time.",
    "food.addMore.wholeMeal": "whole meal",
    "food.addMore.wholeMealMultiple": "{count} × whole meal",
    "food.addMore.soFar": "so far: {kcal} kcal · {grams} g",
    "food.addMore.splitting": "Breaking the meal down into foods…",
    "food.addMore.splittingHint": "In a moment you'll pick exactly what else you ate.",
    "food.addMore.howMuchMore": "How much more did you eat?",
    "food.addMore.inMeal": "in the meal: {amount}",
    "food.addMore.wholeAgain": "Whole meal once more",
    "food.addMore.sameAgain": "Same again",
    "food.addMore.emptyHint": "Tap + next to whatever else you ate.",
    "food.addMore.mealBecomes": "meal becomes {kcal} kcal",
    "food.addMore.saving": "Saving…",
    "food.addMore.add": "Add",
    "food.addMore.decrease": "Decrease: {label}",
    "food.addMore.increase": "Add: {label}",
    "food.addMore.close": "Close",
    "food.addMore.extrasHeading": "Wasn't in the photo?",
    "food.addMore.extrasHint": "The things most often forgotten — one tap is one spoon.",
    "food.addMore.extrasWrite": "Something else",
    "food.addMore.extrasWriteHint": "Write it in your own words — no list to search.",
    "food.addMore.extrasWriteLabel": "What else did you eat?",
    "food.addMore.extrasWritePlaceholder": "e.g. tartar sauce, cherry pie…",
    "food.addMore.extrasAmountLabel": "Amount",
    "food.addMore.extrasAmountPlaceholder": "2 spoons, half a cup…",
    "food.addMore.extrasEstimate": "Work it out",
    "food.addMore.extrasEstimating": "Working…",
    "food.addMore.extrasWriteFailed": "We couldn't estimate that. Try again.",
    "food.addMore.extrasPerUnit": "{unit} · {kcal} kcal",

    // "How much you ate" — how much of a logged meal was actually eaten
    "food.eaten.open": "How much you ate",
    "food.eaten.openWithShare": "Ate {share}%",
    "food.eaten.save": "Save",
    "food.eaten.saveError": "We couldn't save that. Try again.",

    // New product form
    "food.newProduct.labelReadError":
      "We couldn't read the label. Take a close-up photo of the table and try again.",
    "food.newProduct.fillFromLabel": "Fill from the label",
    "food.newProduct.fillFromLabelDesc":
      "Take a photo or upload the nutrition table — AI fills in the values, you just check them.",
    "food.newProduct.readingLabel": "Reading the label…",
    "food.newProduct.photo": "Take photo",
    "food.newProduct.upload": "Upload",
    "food.newProduct.nameLabel": "Food name",
    "food.newProduct.namePlaceholder": "e.g. Yogurt, Smoki, chips",
    "food.newProduct.brandLabel": "Brand (optional)",
    "food.newProduct.brandPlaceholder": "e.g. Podravka",
    "food.newProduct.barcodeLabel": "Barcode (optional)",
    "food.newProduct.barcodePlaceholder": "e.g. 5901234123457",
    "food.newProduct.priceLabel": "Price (RSD, optional)",
    "food.newProduct.pricePlaceholder": "e.g. 149.99",
    "food.newProduct.per100gHeading": "Values per 100g",
    "food.newProduct.per100gDesc":
      "Enter the values from the product label, per 100 grams.",
    "food.newProduct.kcalLabel": "Calories (kcal)",
    "food.newProduct.proteinLabel": "Protein (g)",
    "food.newProduct.carbsLabel": "Carbs (g)",
    "food.newProduct.fatLabel": "Fat (g)",
    "food.newProduct.openExisting": "Open existing product",
    "food.newProduct.submit": "Save product",

    // Share meal sheet
    "food.share.share": "Share",
    "food.share.shareAgain": "Share again",
    "food.share.save": "Save",
    "food.share.saveAgain": "Save again",
    "food.share.dialogAria": "Share meal card",
    "food.share.heading": "Share meal",
    "food.share.close": "Close",
    "food.share.buildError":
      "We couldn't make the card. Close and try again.",
    "food.share.previewAlt": "Share card preview",
    "food.share.zoomOpen": "View the card full size",
    "food.share.zoomAria": "Card at full size",
    "food.share.zoomClose": "Close the view",
    "food.share.building": "Making the card…",
    "food.share.savedStatus": "Saved. 🔥",
    "food.share.sharedStatus": "Shared. 🔥",
    "food.share.idleStatus": "Your photo, your numbers — ready for the story.",
  },
} as const;
