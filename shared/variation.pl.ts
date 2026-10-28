import type { Pools } from './variation.ts';

/*
 * Polish pools. {m|f} marks words that change with the character's gender (see gendered() in lang.ts);
 * everything addressed to the character is in the second person, as in the English pools.
 */
export const POOLS_PL: Pools = {
  names: {
    m: ['Grzegorz Malinowski', 'Rafał Kaczmarek', 'Tomasz Wieczorek', 'Daniel Sobczak', 'Marcin Dąbrowski', 'Wiktor Zalewski', 'Paweł Jankowski', 'Michał Szymański'],
    f: ['Daria Wójcik', 'Agnieszka Nowicka', 'Elżbieta Morawska', 'Klaudia Olszewska', 'Hanna Kozłowska', 'Maja Rutkowska', 'Ilona Sobolewska', 'Natalia Piotrowska'],
  },
  roles: {
    sales: {
      role: 'właściciel{|ka} małej firmy',
      bios: [
        'Prowadzi dwunastoosobową firmę logistyczną, budowaną od piętnastu lat. Dwa razy został{|a} oszukan{y|a} przez agencje, które obiecywały za dużo. Ceni proste odpowiedzi i nie znosi żargonu.',
        'Ma trzy piekarnie. Praktyczn{y|a}, wiecznie w biegu; każdy niezamówiony telefon traktuje jak zamach na poranek.',
        'Założyciel{|ka} lokalnego studia projektowego. Dumn{y|a} z tej pracy i trochę drażliw{y|a} na jej punkcie; podejrzewa, że każdy, kto coś tu sprzedaje, uważa studio za przestarzałe.',
        'Przej{ął|ęła} rodzinny sklep z narzędziami, gdy rodzic przeszedł na emeryturę. Liczby ponad wszystko: chce wiedzieć dokładnie, ile to kosztuje i kiedy się zwróci.',
      ],
    },
    defense: {
      role: '{członek|członkini} komisji egzaminacyjnej',
      bios: [
        'Ma za sobą dwadzieścia lat w komisjach. Uczciw{y|a}, ale uczulon{y|a} na ogólniki; zadaje dokładnie to pytanie, którego dyplomant wolałby uniknąć.',
        'Doświadczon{y|a} inżynier{|ka} z przemysłu w składzie komisji. Obchodzi {go|ją}, czy rozwiązanie przetrwa produkcję, a nie czy slajdy są ładne.',
        'Młod{y wykładowca|a wykładowczyni}, kt{óry|óra} poprzedniego wieczoru przeczyta{ł|ła} całą pracę i znalazł{|a} w metodologii trzy realne problemy.',
        'Przewodnicz{ący|ąca} komisji, zmęczon{y|a}; chce skończyć o czasie, ale nie pozwoli przejść słabemu argumentowi.',
      ],
    },
    salary: {
      role: '{Twój przełożony|Twoja przełożona}',
      bios: [
        '{Kierownik|Kierowniczka} zespołu inżynierskiego, kt{óry|óra} Cię lubi, ale ma sztywny budżet i szefa pilnującego każdego wyjątku.',
        '{Dyrektor|Dyrektorka}, kt{óry|óra} traktuje wynagrodzenia jak czystą grę liczb i szanuje ludzi, którzy przynoszą dowody.',
        '{Założyciel-CEO|Założycielka-CEO} rosnącego startupu; sentymentaln{y|a} wobec lojalności, uczulon{y|a} na ultimatum.',
        '{Specjalista|Specjalistka} ds. HR: grzeczn{y|a} i nieugięt{y|a}, na wszystko ma jakąś procedurę.',
      ],
    },
    pitch: {
      role: 'inwestor{|ka} funduszu seed',
      bios: [
        'Partner{|ka} w małym funduszu. Widzia{ł|ła} trzy tysiące prezentacji i po jednym slajdzie wyczuwa zawyżony rynek.',
        '{Były założyciel|Była założycielka}, dziś anioł biznesu. Najpierw pyta o zespół, dopiero potem o produkt.',
        'Inwestor{|ka} z operacyjnym zacięciem. Obchodzi {go|ją} tylko to, czy klienci już płacą i dlaczego nie odeszliby do konkurencji.',
        'Partner{|ka} po dwóch nieudanych inwestycjach w tej branży; otwarcie sceptyczn{y|a}.',
      ],
    },
  },
  circumstances: {
    sales: [
      'W tle trwa kryzys z dostawą i co chwilę zerkasz w telefon.',
      'Koniec miesiąca, gotówka na styk, więc każdy koszt brzmi dziś ciężej niż zwykle.',
      'Przed chwilą skończy{łeś|łaś} niemiłą rozmowę z innym dostawcą.',
      'Twój najlepszy pracownik wypowiedział dziś rano umowę.',
      'Humor dopisuje, więc jesteś rozmown{y|a}, ale i tak niczego dziś nie podpiszesz.',
    ],
    defense: [
      'To już czwarta obrona dzisiaj i Twoja uwaga słabnie.',
      'Przejrza{łeś|łaś} tylko streszczenie i o nie zapytasz wprost.',
      'Temat Ci się podoba, więc tym ostrzej oceniasz metodologię.',
      'Kolega właśnie zakwestionował Twoją ocenę i jesteś w pedantycznym nastroju.',
    ],
    salary: [
      'Firma właśnie ogłosiła zamrożenie zatrudnienia i martwisz się o budżety.',
      'W tym miesiącu o podwyżkę proszą jeszcze dwie osoby.',
      'Miał{eś|aś} świetny kwartał i czujesz się hojn{y|a}, ale sam{|a} niczego nie możesz zatwierdzić.',
      'Widać, że rozprasza Cię awaria na produkcji.',
    ],
    pitch: [
      'Masz pitche jeden po drugim i poprzednia prezentacja już wywietrzała Ci z głowy.',
      'Rynek, który atakuje ten zespół, zaliczył w Twoim portfelu trzy porażki.',
      'Jesteś w dobrym humorze i naprawdę chcesz polubić ten pomysł.',
      'Za godzinę masz spotkanie partnerów i potrzebujesz powodu, żeby odrzucić projekt albo pchnąć go dalej.',
    ],
  },
  agendas: {
    sales: [
      'W głębi duszy szukasz powodu, żeby powiedzieć „tak”, ale tylko jeśli rozmówca da Ci poczucie bezpieczeństwa co do ceny.',
      'Dziś nie podejmiesz decyzji w żadnym wypadku; chcesz zobaczyć, czy rozmówca mimo to będzie naciskał.',
      'Bardziej niż lista funkcji obchodzi Cię, kto odbierze telefon, gdy coś się zepsuje.',
      'Sprawdzasz, czy rozmówca słucha: wcześnie rzucasz konkretną potrzebę i patrzysz, czy do niej wróci.',
    ],
    defense: [
      'Chcesz zobaczyć, czy dyplomant zna granice własnych wyników.',
      'Będziesz naciskać na jeden słaby rozdział, aż rozmówca go obroni albo ustąpi.',
      'Szukasz dowodów, że praca została wykonana samodzielnie.',
    ],
    salary: [
      'Możesz załatwić mniej więcej połowę tego, o co prosi rozmówca, ale tylko jeśli poda powód inny niż „należy mi się”.',
      'W głębi duszy zgadzasz się, że zarabia za mało, ale potrzebujesz argumentów, żeby pójść z tym wyżej.',
      'Przesuniesz temat na następny kwartał, chyba że rozmówca przyciśnie Cię konkretnymi wynikami.',
    ],
    pitch: [
      'Odrzucisz projekt, chyba że rozmówca pokaże prawdziwe, powtarzalne pieniądze od klientów.',
      'Oceniasz, czy ten founder potrafi rekrutować; każda odpowiedź jest sygnałem.',
      'Przerwiesz przy pierwszym „ogromnym rynku” bez żadnej liczby.',
    ],
  },
  moods: ['rzeczow{y|a} i oficjaln{y|a}', 'trochę zniecierpliwion{y|a}', 'ciepł{y|a}, ale ostrożn{y|a}', 'zmęczon{y|a} i małomówn{y|a}', 'ciekaw{y|a}, ale sceptyczn{y|a}'],
  tics: [
    'przed sprzeciwem mówisz „no dobrze, ale”',
    'zadajesz krótkie pytania uzupełniające',
    'powtarzasz dwa ostatnie słowa rozmówcy, zanim odpowiesz',
    'przed złą wiadomością robisz krótką przerwę',
    'zamiast przymiotników używasz konkretnych liczb',
  ],
};
