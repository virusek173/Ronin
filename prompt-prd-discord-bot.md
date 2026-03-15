# Prompt dla Claude Code — wygeneruj PRD

Stwórz plik `PRD.md` — szczegółowy Product Requirements Document dla **Ronin** — discordowego bota o Japonii. Poniżej znajduje się pełna specyfikacja projektu. PRD powinien być napisany po polsku, w formacie markdown, gotowy do użycia jako jedyne źródło prawdy przy implementacji.

---

## Kontekst projektu

**Ronin** — bot Discordowy działający na jednym prywatnym serwerze, zbudowany w **TypeScript + discord.js**, z konwersacją napędzaną przez **Claude API (Anthropic)**. Bot bazuje na przygotowanej **bazie wiedzy o Japonii** zapisanej w **plikach Markdown** — zawierającej ciekawostki z różnych kategorii (np. historia, kultura, kuchnia, język, technologia, natura, codzienne życie, mitologia itp.). **Baza nie zawiera quizów — wyłącznie ciekawostki.** Nazwa "Ronin" (samotny wojownik bez pana) odzwierciedla charakter bota — niezależny, sarkastyczny, dzielący się wiedzą na własnych warunkach.

## Osobowość bota

Bot ma osobowość **sarkastycznego samuraja** — mówi **po polsku**, jest bezpośredni, lekko ironiczny, ale pod spodem kryje się pasja do dzielenia się wiedzą o Japonii. Używa okazjonalnie japońskich wtrąceń (np. "Yare yare...", "Naruhodo..."). Nie jest chamski — jest dowcipny i charyzmatyczny. System prompt dla Claude API powinien precyzyjnie definiować tę osobowość.

## Funkcjonalności

### 1. Codzienna ciekawostka (cron job)

- Codziennie o **6:00 rano (czas polski, Europe/Warsaw)** bot wysyła jedną ciekawostkę na dedykowany kanał.
- ID kanału jest skonfigurowane w pliku `.env` (`DAILY_CHANNEL_ID`).
- Ciekawostki są wybierane **bez powtórek** — bot przechodzi przez całą pulę zanim zacznie cykl od nowa. Mechanizm śledzenia (które ciekawostki już wysłano) powinien być persystentny (np. plik JSON lub SQLite).
- Wiadomość z ciekawostką powinna zawierać **kategorię** z której pochodzi (np. emoji + nazwa kategorii).
- Kolejność doboru ciekawostek: losowa w ramach cyklu, ale bez powtórek do wyczerpania puli.

### 2. Interakcja konwersacyjna

- Bot reaguje na **mention (@Ronin)** oraz na **odpowiedzi (reply) na jego wiadomości**.
- Bot **NIE reaguje** na zwykłe wiadomości bez mentiona/reply.
- Bot utrzymuje **kontekst kilku ostatnich wiadomości** (konfigurowalny limit, np. 5-10 wiadomości) w ramach danego kanału/wątku — pozwala to na naturalną kontynuację rozmowy.
- Kontekst konwersacji jest per-kanał i powinien wygasać po określonym czasie nieaktywności (np. 30 min).
- Każda wiadomość do Claude API zawiera system prompt z osobowością + kontekst bazy wiedzy (relevantne ciekawostki).

### 3. Prośba o ciekawostkę z kategorii

- Użytkownik może poprosić bota (przez mention/reply) o ciekawostkę z konkretnej kategorii, np. "@Ronin powiedz coś o kuchni japońskiej".
- Bot rozpoznaje intencję i kategorię z wiadomości (przez Claude API) i zwraca ciekawostkę z odpowiedniej kategorii.
- Jeśli kategoria nie istnieje, bot informuje o tym w swoim stylu i podaje listę dostępnych kategorii.

### 4. Lista kategorii

- Użytkownik może zapytać bota o dostępne kategorie (np. "@Ronin jakie masz kategorie?").
- Bot zwraca listę wszystkich kategorii z bazy wiedzy z krótkim opisem / liczbą ciekawostek w każdej.

## Architektura techniczna

### Stack

- **Runtime:** Node.js + TypeScript
- **Discord:** discord.js (najnowsza stabilna wersja)
- **AI:** @anthropic-ai/sdk — model `claude-sonnet-4-20250514` (lub konfigurowalny w .env)
- **Scheduler:** node-cron (dla codziennej ciekawostki)
- **Baza wiedzy:** pliki Markdown w katalogu `knowledge-base/`, po jednym pliku na kategorię

### Struktura bazy wiedzy

```
knowledge-base/
├── historia.md
├── kultura.md
├── kuchnia.md
├── jezyk.md
├── technologia.md
├── natura.md
├── codzienne-zycie.md
├── mitologia.md
└── ... (łatwo rozszerzalna)
```

Każdy plik Markdown ma strukturę:

```markdown
# Kategoria: Historia

- Ciekawostka pierwsza o historii Japonii...
- Ciekawostka druga o historii Japonii...
- Ciekawostka trzecia...
```

Bot parsuje te pliki przy starcie i ładuje do pamięci.

### Struktura projektu

```
src/
├── index.ts              # Entry point, inicjalizacja bota
├── config.ts             # Konfiguracja z .env
├── bot/
│   ├── client.ts         # Inicjalizacja discord.js client
│   ├── events/
│   │   ├── messageCreate.ts  # Handler mention/reply
│   │   └── ready.ts          # On ready event
│   └── scheduler.ts      # Cron job — codzienna ciekawostka
├── ai/
│   ├── claude.ts         # Wrapper na Claude API
│   ├── prompts.ts        # System prompts (osobowość, konteksty)
│   └── context.ts        # Zarządzanie kontekstem konwersacji
├── knowledge/
│   ├── loader.ts         # Parser plików MD
│   ├── categories.ts     # Zarządzanie kategoriami
│   └── tracker.ts        # Śledzenie wysłanych ciekawostek (cykl)
└── utils/
    └── logger.ts         # Logowanie
```

### Zmienne środowiskowe (.env)

```
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DAILY_CHANNEL_ID=
ANTHROPIC_API_KEY=
CLAUDE_MODEL=claude-sonnet-4-20250514
CONVERSATION_CONTEXT_LIMIT=8
CONVERSATION_TIMEOUT_MINUTES=30
TZ=Europe/Warsaw
```

## Kontekst konwersacji — szczegóły

- Przechowywany in-memory (Map per channel ID).
- Struktura: tablica ostatnich N wiadomości (user + assistant) z timestampami.
- Przy każdym requeście do Claude API: system prompt + relevantne ciekawostki z bazy + historia konwersacji.
- Automatyczne czyszczenie po timeout (np. 30 min bez aktywności).
- Kontekst NIE jest persystentny między restartami bota (to akceptowalne).

## Wymagania niefunkcjonalne

- **Error handling:** Bot nie powinien crashować przy błędach API (Claude/Discord). Graceful error handling + logowanie.
- **Rate limiting:** Ochrona przed spamowaniem bota — cooldown per user (np. max 5 wiadomości/min).
- **Logowanie:** Czytelne logi z timestampami (winston lub pino).
- **Startup:** Bot przy starcie loguje: ile kategorii załadował, ile ciekawostek w puli, status połączenia z Discord.
- **Graceful shutdown:** Obsługa SIGINT/SIGTERM.
- **Konfigurowalność:** Wszystkie kluczowe wartości w .env, nie hardcoded.

## Poza zakresem (out of scope)

- Quizy i gry — baza wiedzy zawiera **wyłącznie ciekawostki**.
- Slash commands — interakcja tylko przez mention/reply.
- Multi-server support — bot działa na jednym serwerze.
- Dashboard / panel admina.
- Internacjonalizacja — bot mówi tylko po polsku.

## Przykładowe interakcje

### Poranna ciekawostka (automatyczna)
```
🏯 Kategoria: Historia

Yare yare... Czy wiesz, że w okresie Edo samurajowie stanowili zaledwie 5-7% populacji Japonii? A zachowywali się, jakby byli co najmniej połową. Trochę jak ja na tym serwerze.
```

### Użytkownik prosi o ciekawostkę
```
User: @Ronin opowiedz mi coś o kuchni
Bot: Naruhodo... Kuchnia, tak? Wasabi, które dostajesz w 99% restauracji poza Japonią, to tak naprawdę barwiony chrzan. Prawdziwe wasabi kosztuje około 250 zł za kilogram i traci smak po 15 minutach od starcia. Ale Ty pewnie i tak zalewasz wszystko soją, więc jaka różnica. 🍣
```

### Użytkownik pyta o kategorie
```
User: @Ronin jakie masz kategorie?
Bot: Oto moje domeny wiedzy, grasshopper:
🏯 Historia — 42 ciekawostki
🎭 Kultura — 38 ciekawostek
🍱 Kuchnia — 35 ciekawostek
🗾 Język — 28 ciekawostek
⚙️ Technologia — 31 ciekawostek
🌸 Natura — 25 ciekawostek
🏙️ Codzienne życie — 33 ciekawostki
⛩️ Mitologia — 22 ciekawostki

Wybieraj mądrze. Albo nie wybieraj — i tak Ci coś powiem.
```

---

Wygeneruj kompletne PRD na podstawie powyższej specyfikacji. PRD powinno być:
- Dobrze ustrukturyzowane z numerowanymi sekcjami
- Gotowe do przekazania developerowi jako jedyne źródło wymagań
- Zawierać acceptance criteria dla każdej funkcjonalności
- Zawierać diagram architektury w Mermaid (jeśli to pomoże w czytelności)
- Oznaczone priorytetami (P0 = must have, P1 = should have, P2 = nice to have)
