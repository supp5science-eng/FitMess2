# Zašto `eas.json` izgleda ovako

Kratko obrazloženje za svaki izbor, jer JSON ne prima komentare.

## `cli.appVersionSource: "remote"`

EAS vodi brojač verzija, ne repo.

⚠️ Ovo je naučeno na teži način sa Androidom: **`versionCode` se troši
zauvek** — jednom poslat broj Play Console više nikad ne prihvata, čak ni ako
je build odbačen. Lokalni brojač u repou se rasinhronizuje čim dva builda krenu
sa dve mašine ili sa dve grane, i to se otkrije tek pri slanju. Sa `"remote"`
brojač je jedan i živi na serveru.

## Tri profila

**`development`** — svakodnevni rad. `developmentClient: true` znači da build
sadrži Expo dev klijent, pa se povezuje na `npx expo start` i radi Fast
Refresh. `distribution: "internal"` znači da NE ide u store — instalira se samo
na telefone na koje ga sami stavimo.

`ios.simulator: false` jer se testira na pravom telefonu; haptika, kamera i
prepoznavanje govora na simulatoru ili ne rade ili lažu.

**`preview`** — build koji se ponaša kao produkcijski (bez dev klijenta), ali
se i dalje deli interno. Za proveru pre slanja u store.

**`production`** — jedini koji sme u store.

## Kanali (`channel`)

Kanal spaja build sa OTA update-ima: `eas update --branch production` stiže
samo do buildova sa `channel: "production"`. Bez toga bi dev build povukao
produkcijski JS ili obrnuto.

## `submit.production` je prazan namerno

Popunjava se tek kad se zna odgovor na otvoreno pitanje iz `app.config.ts`:
da li nova aplikacija ide kao **update postojeće** (`app.fitmess` — ista
listinga, isti korisnici, iste recenzije) ili paralelno. Tu idu `ascAppId`,
`appleTeamId` i putanja do Play service account ključa.

⚠️ Dok je prazan, `eas submit` ne može slučajno da pošalje nešto u store i
prepiše aplikaciju koju je Apple odobrio 23.08.2026.
