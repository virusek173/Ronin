# Ronin 🏯

Sarkastyczny bot Discordowy o Japonii. Codziennie o 6:00 wysyła ciekawostkę, odpowiada na pytania i prowadzi rozmowy z kontekstem — napędzany przez Claude API.

---

## Funkcjonalności

- **Codzienna ciekawostka** — co rano o 6:00 (czas polski) bot wysyła jedną ciekawostkę na wybrany kanał. Bez powtórek — przechodzi przez całą pulę 224 faktów z 8 kategorii, zanim zacznie cykl od nowa.
- **Interakcja konwersacyjna** — bot odpowiada na `@Ronin` lub reply do jego wiadomości. Utrzymuje kontekst rozmowy per kanał.
- **Ciekawostka z kategorii** — `@Ronin opowiedz coś o kuchni` losuje fakt z wybranej kategorii.
- **Lista kategorii** — `@Ronin jakie masz kategorie?` zwraca pełną listę z emoji i liczbą ciekawostek.
- **Rate limiting** — max 5 wiadomości na minutę per użytkownik.

---

## Baza wiedzy

8 kategorii, łącznie 224 ciekawostki:

| Kategoria | Plik | Ciekawostki | Emoji |
|---|---|---|---|
| Historia | `historia.md` | 37 | 🏯 |
| Kultura | `kultura.md` | 31 | 🎭 |
| Kuchnia | `kuchnia.md` | 34 | 🍱 |
| Język | `jezyk.md` | 22 | 🗾 |
| Technologia | `technologia.md` | 25 | ⚙️ |
| Natura | `natura.md` | 25 | 🌸 |
| Codzienne życie | `codzienne-zycie.md` | 25 | 🏙️ |
| Mitologia | `mitologia.md` | 25 | ⛩️ |

Dodanie nowej kategorii = nowy plik `.md` w `knowledge-base/` z nagłówkiem `# Kategoria: Nazwa`. Bot ładuje wszystkie pliki przy starcie automatycznie.

---

## Stack technologiczny

| Komponent | Technologia |
|---|---|
| Runtime | Node.js ≥ 20 + TypeScript |
| Discord | `discord.js` v14 |
| AI | `@anthropic-ai/sdk` — model `claude-sonnet-4-5` (konfigurowalny) |
| Scheduler | `node-cron` |
| Logowanie | `pino` + `pino-pretty` |
| Tracking | `data/tracker.json` |

---

## Struktura projektu

```
ronin/
├── knowledge-base/       # Baza wiedzy (pliki MD)
│   ├── historia.md
│   ├── kultura.md
│   ├── kuchnia.md
│   ├── jezyk.md
│   ├── technologia.md
│   ├── natura.md
│   ├── codzienne-zycie.md
│   └── mitologia.md
├── data/
│   └── tracker.json      # Stan cyklu ciekawostek (auto-generowany)
├── src/
│   ├── index.ts          # Entry point
│   ├── config.ts         # Konfiguracja z .env
│   ├── bot/
│   │   ├── client.ts         # Discord.js client
│   │   ├── scheduler.ts      # Cron job — codzienna ciekawostka
│   │   └── events/
│   │       ├── ready.ts          # On ready — logi startowe
│   │       └── messageCreate.ts  # Handler mention/reply
│   ├── ai/
│   │   ├── claude.ts         # Wrapper Claude API (streaming)
│   │   ├── prompts.ts        # System prompts i osobowość bota
│   │   └── context.ts        # Kontekst konwersacji per kanał
│   ├── knowledge/
│   │   ├── loader.ts         # Parser plików MD + dopasowanie kategorii
│   │   ├── categories.ts     # Helpers formatowania kategorii
│   │   └── tracker.ts        # Śledzenie wysłanych ciekawostek
│   └── utils/
│       └── logger.ts         # Logger pino
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Uruchomienie

### 1. Wymagania

- Node.js ≥ 20
- Konto [Discord Developer Portal](https://discord.com/developers/applications)
- Klucz [Anthropic API](https://console.anthropic.com)

### 2. Stwórz bota na Discord Developer Portal

1. **New Application** → nadaj nazwę „Ronin"
2. Zakładka **Bot** → **Reset Token** → skopiuj token
3. W sekcji **Privileged Gateway Intents** włącz **Message Content Intent**
4. Zakładka **OAuth2 → URL Generator**:
   - Scope: `bot`
   - Permissions: `Send Messages`, `Read Message History`, `View Channels`
   - Wygenerowanym URL zaproś bota na serwer

### 3. Konfiguracja

```bash
cp .env.example .env
```

Uzupełnij `.env`:

```env
DISCORD_TOKEN=twój_token_bota
DISCORD_CLIENT_ID=id_aplikacji_z_portalu
DAILY_CHANNEL_ID=id_kanału_na_codzienne_ciekawostki
ANTHROPIC_API_KEY=twój_klucz_anthropic
```

> **DAILY_CHANNEL_ID** — w Discordzie kliknij PPM na kanał → **Kopiuj ID**. Wymaga włączonego Trybu Dewelopera (Ustawienia → Zaawansowane).

### 4. Instalacja i uruchomienie

**Produkcja:**
```bash
npm install
npm run build
npm start
```

**Development:**
```bash
npm install
npm run dev
```

### 5. Weryfikacja

Poprawny start wygląda tak:

```
INFO: Loaded 8 categories
INFO: Tracker initialized { remaining: 224 }
INFO: Daily scheduler started (06:00 Europe/Warsaw)
INFO: Bot connected as Ronin#XXXX
INFO: Total facts in pool: 224
INFO: Facts remaining in current cycle: 224
```

---

## Zmienne środowiskowe

| Zmienna | Wymagana | Domyślna | Opis |
|---|---|---|---|
| `DISCORD_TOKEN` | ✅ | — | Token bota z Discord Developer Portal |
| `DISCORD_CLIENT_ID` | ✅ | — | ID aplikacji z Discord Developer Portal |
| `DAILY_CHANNEL_ID` | ✅ | — | ID kanału na codzienne ciekawostki |
| `ANTHROPIC_API_KEY` | ✅ | — | Klucz API Anthropic |
| `CLAUDE_MODEL` | ❌ | `claude-sonnet-4-5` | Model Claude do użycia |
| `CONVERSATION_CONTEXT_LIMIT` | ❌ | `8` | Liczba ostatnich wiadomości w kontekście |
| `CONVERSATION_TIMEOUT_MS` | ❌ | `3600000` | Timeout kontekstu rozmowy (ms), domyślnie 1h |
| `LOG_LEVEL` | ❌ | `info` | Poziom logowania (`debug`, `info`, `warn`, `error`) |
| `TZ` | ❌ | `Europe/Warsaw` | Strefa czasowa |

---

## Przykładowe interakcje

```
@Ronin opowiedz coś o kuchni
→ Naruhodo... Kuchnia, tak? Wasabi, które dostajesz w 99% restauracji
  poza Japonią, to barwiony chrzan. Prawdziwe kosztuje ok. 200 zł za korzeń. 🍣

@Ronin jakie masz kategorie?
→ Oto moje domeny wiedzy, grasshopper:
  🏯 Historia — 37 ciekawostek
  🎭 Kultura — 31 ciekawostek
  ...

@Ronin powiedz coś o sporcie
→ Sport? Tego nie mam w swoim arsenale. Ale mam za to:
  🏯 Historia, 🎭 Kultura, 🍱 Kuchnia...
```
