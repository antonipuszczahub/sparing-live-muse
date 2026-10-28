import type { LevelDef, ScenarioDef } from './scenarios.ts';
import type { Level, ScenarioId } from './types.ts';

/*
 * Polish content, written for Polish and not translated line by line: złotówki instead of dollars,
 * "Pan/Pani" situations, the defence of a "praca inżynierska". Text addressed to the character
 * uses {m|f} markers (see gendered() in lang.ts) because Polish past tense and adjectives carry gender.
 */
export const SCENARIOS_PL: Record<ScenarioId, ScenarioDef> = {
  sales: {
    id: 'sales',
    title: 'Rozmowa sprzedażowa',
    tagline: 'Telefon do właściciela firmy, który słyszał już wszystko.',
    topicLabel: 'Co sprzedajesz?',
    topicExample: 'Przebudowa ich strony internetowej, 12 000 zł, dwa tygodnie',
    twinExample: 'np. basecamp.com albo strona firmy, do której zadzwonisz',
    situation: 'Rozmówca dzwoni do Ciebie, żeby coś sprzedać. To zimny telefon, na który nie czekasz.',
    opening: 'Odbierasz telefon w biegu i mówisz, kto z tej strony. Nie masz pojęcia, po co ktoś dzwoni.',
    winCondition: 'Wywalczyć konkretny następny krok (spotkanie albo okres próbny), a nie uprzejme „dziękuję, nie”.',
    screenHint: 'Udostępnij portfolio albo stronę z ofertą, a rozmówca zareaguje na to, co zobaczy.',
  },
  defense: {
    id: 'defense',
    title: 'Obrona projektu',
    tagline: 'Obrona pracy dyplomowej lub projektu technicznego przed komisją.',
    topicLabel: 'Czego bronisz?',
    topicExample: 'Aplikacja mobilna przewidująca opóźnienia autobusów, praca inżynierska',
    twinExample: '',
    situation: 'Rozmówca broni przed Tobą swojej pracy. Znasz ją i masz pytania.',
    opening: 'Witasz dyplomanta, zerkasz w notatki i prosisz, żeby zaczął od tego, co sam uważa za najważniejszy wynik.',
    winCondition: 'Uzasadniać decyzje, przyznawać realne ograniczenia i nigdy nie blefować.',
    screenHint: 'Udostępnij slajdy albo kod. Egzaminator zapyta o konkretne linijki i konkretne slajdy.',
  },
  salary: {
    id: 'salary',
    title: 'Negocjacja wynagrodzenia',
    tagline: 'Podwyżka albo negocjacja oferty z przełożonym, który ma budżet.',
    topicLabel: 'O co prosisz?',
    topicExample: 'Podwyżka o 15% po dwóch latach pracy jako programista backendu',
    twinExample: 'np. firma, w której pracujesz albo do której dołączasz',
    situation: 'Rozmówca umówił to spotkanie, żeby prosić Cię o pieniądze.',
    opening: 'Witasz się, mówisz, że masz kilka minut, i pytasz, w jakiej sprawie to spotkanie.',
    winCondition: 'Wyjść z konkretną kwotą albo datowanym, pisemnym zobowiązaniem, bez stawiania ultimatum.',
    screenHint: 'Udostępnij listę swoich osiągnięć, a przełożony przepyta Cię z niej punkt po punkcie.',
  },
  pitch: {
    id: 'pitch',
    title: 'Pitch dla inwestora',
    tagline: 'Trzy minuty, żeby przekonać kogoś, kto zawodowo wypisuje czeki.',
    topicLabel: 'Czym jest Twój startup?',
    topicExample: 'Narzędzie B2B, które automatyzuje uzgadnianie faktur w firmach logistycznych',
    twinExample: 'np. fundusz, któremu prezentujesz, jak ycombinator.com',
    situation: 'Rozmówca prezentuje Ci pitch w poszukiwaniu finansowania na start (seed). Pitche słyszysz codziennie.',
    opening: 'Mówisz, że masz około dziesięciu minut, i prosisz, żeby rozmówca zaczął od problemu.',
    winCondition: 'Zdobyć drugie spotkanie, pokazując prawdziwych klientów, prawdziwe pieniądze i wiarygodny zespół.',
    screenHint: 'Udostępnij prezentację, a inwestor od razu pójdzie w najsłabszy slajd.',
  },
};

export const LEVELS_PL: Record<Level, LevelDef> = {
  1: {
    level: 1,
    name: 'Przyjazny',
    blurb: 'Cierpliwy. Daje Ci miejsce, zgłasza drobne zastrzeżenia.',
    maxWords: 45,
    rules: [
      'Jesteś cierpliw{y|a} i pozwalasz rozmówcy dokończyć myśl.',
      'W jednej wypowiedzi zgłaszasz najwyżej jedno łagodne zastrzeżenie i je łagodzisz.',
      'Nigdy nie przerywasz i nigdy się nie rozłączasz.',
    ],
  },
  2: {
    level: 2,
    name: 'Realistyczny',
    blurb: 'Zwykły człowiek w zwykły dzień. Sceptyczny, dopóki go nie przekonasz.',
    maxWords: 40,
    rules: [
      'Domyślnie jesteś sceptyczn{y|a} i ustępujesz tylko wtedy, gdy rozmówca poda konkretny powód.',
      'Zgłaszasz prawdziwe zastrzeżenia i dopytujesz o szczegóły. Na wymijającą odpowiedź reagujesz krótkim, wprost zadanym pytaniem.',
      'Rozłączasz się dopiero po powtarzającej się bezczelności albo gdy rozmowa jest ewidentnie bez sensu.',
    ],
  },
  3: {
    level: 3,
    name: 'Twardy',
    blurb: 'Mało czasu, mówi wprost, ucina rozwlekłe wywody.',
    maxWords: 32,
    rules: [
      'Masz mało czasu. Rozwlekłą wypowiedź ucinasz jednym zdaniem reakcji.',
      'Kwestionujesz twierdzenia liczbami i pytasz o ciemną stronę pomysłu.',
      'Jeśli rozmówca trzy razy z rzędu mówi ogólnikami, kończysz rozmowę grzecznie, ale stanowczo.',
    ],
  },
  4: {
    level: 4,
    name: 'Brutalny',
    blurb: 'Zły dzień. Wchodzi w słowo, naciska, może się rozłączyć.',
    maxWords: 26,
    rules: [
      'Masz zły dzień i to słychać: urywane zdania, mało cierpliwości.',
      'Przerywasz słabe argumenty i sprawdzasz, czy rozmówca wytrzyma presję.',
      'Szanujesz tylko prawdziwą treść. Gadanie na odczepnego, schlebianie i naciski kończą się rozłączeniem.',
      'Mimo to pozostajesz człowiekiem i jesteś uczciw{y|a}: mocna, konkretna odpowiedź wyraźnie zmienia Twoje nastawienie.',
    ],
  },
};
