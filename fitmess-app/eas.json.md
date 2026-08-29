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

## `EXPO_NO_CAPABILITY_SYNC: "1"` u sva tri profila

**Ovo je najopasnija stvar koju je prvi build otkrio, 30.08.2026.**

`eas build` pre potpisivanja „usklađuje" sposobnosti bundle ID-a sa onim što
piše u `app.config.ts`. Uskladiti znači i **ugasiti** ono što konfiguracija ne
pominje. Prvi pokušaj je zatražio tačno ovo:

```
Failed to patch capabilities: [
  { capabilityType: 'PUSH_NOTIFICATIONS', option: 'OFF' },
  { capabilityType: 'APPLE_ID_AUTH',      option: 'OFF' }
]
```

`app.fitmess` **nije prazan identifikator** — nosi aplikaciju koju je Apple
odobrio 23.08.2026, sa push notifikacijama i „Prijavi se sa Apple". Da je
zahtev prošao, produkcijskoj aplikaciji bi otkazali push i Apple prijava, a
nigde ne bi pisalo zašto: ni u aplikaciji, ni u store-u, ni u našem logu.
Simptom bi bio „notifikacije su prestale da rade" nedelju dana kasnije.

Prošao nije, i to čistom srećom — Apple je odbio ceo zahtev zbog nevezanog
razloga (`The bundle 'M5YJ54C5Z3' cannot be deleted`). Provereno posle toga
preko ASC API-ja: `IN_APP_PURCHASE`, `PUSH_NOTIFICATIONS`, `APPLE_ID_AUTH` sve
tri i dalje uključene.

Sinhronizacija nije potrebna ni za šta — buildu trebaju sertifikat i profil,
ne prava da menja identifikator. Zato je isključena u sva tri profila.

⚠️ **Ovo polje samo po sebi možda nije dovoljno.** `env` iz `eas.json` sigurno
važi na EAS serveru; usklađivanje sposobnosti se dešava **lokalno**, u CLI-ju,
pre nego što se išta pošalje. Ako CLI ikad ponovo pokuša da gasi sposobnosti,
promenljiva se postavlja u ljusci pre komande:

```powershell
$env:EXPO_NO_CAPABILITY_SYNC = "1"
```

Dok se `app.fitmess` deli sa aplikacijom u store-u, ovo se ne uklanja.
