import type { Lang } from '../../shared/types.ts';

/**
 * The text of the "what is this" panel behind the Demo button: what the project is, what to watch in the demo, what it
 * runs on, and where it is going. The plans are labelled as plans: none of them is built yet.
 */
export interface About {
  title: string;
  lead: string;
  watchTitle: string;
  watch: { title: string; body: string }[];
  builtTitle: string;
  built: string;
  nextTitle: string;
  nextNote: string;
  next: { title: string; body: string }[];
  start: string;
  startNote: string;
}

export const ABOUT: Record<Lang, About> = {
  en: {
    title: 'What is Sparing Live?',
    lead: 'A place to fail cheaply, out loud, before the conversation that counts. You call a buyer, an examiner, a manager or an investor. It listens in real time, interrupts you, reads your shared screen, shows its mood on its face and hangs up on a weak pitch. Afterwards the review shows what it was privately thinking.',
    watchTitle: 'What to watch in the demo',
    watch: [
      { title: 'Pick someone to call', body: 'Four counterparts, four difficulty levels, English or Polish. Type a real company and the person you call knows what that company knows.' },
      { title: 'Talk, and talk over them', body: 'It is full duplex: speak while the character is speaking and it stops mid-sentence. Its face and the glow of the page follow its mood.' },
      { title: 'Share a slide', body: 'It reads your screen and goes straight for the claim that has no source.' },
      { title: 'Read its mind', body: 'The review replays the call with the character’s private thoughts, the sentence where you lost it, and a better line to say.' },
    ],
    builtTitle: 'What it runs on',
    built:
      'Only Meta’s Muse models: Spark, or Spark Open on open weights, plays the character; Wonder does the company research and the review; Voice Transcribe is the ears; Image draws the face; SAM 3.1 reads the camera. The voice is your browser’s own. Every model call is in a public cost ledger, and the speed and behaviour are measured by a script you can run.',
    nextTitle: 'Where it is going',
    nextNote: 'None of this is built yet.',
    next: [
      { title: 'A panel, not one person', body: 'A thesis committee or an investment committee: several voices in one call, who also talk over each other.' },
      { title: 'Characters that tune themselves', body: 'Models sparring with each other to sharpen the characters, judged by the same measured evaluation.' },
      { title: 'Your own material', body: 'Paste a job description, a contract or your deck and rehearse against what is actually in it.' },
      { title: 'A voice from Meta', body: 'The character will speak with a Meta speech model when there is one; today it uses the browser’s voice.' },
      { title: 'Your progress, everywhere', body: 'Accounts and a hosted version, so your weak spots and scores follow you to your phone, and a coach or a class can set scenarios for a group.' },
    ],
    start: 'Fill in the demo call',
    startNote: 'An investor at the Realistic level and a pitch with numbers in it. You only press Call.',
  },
  pl: {
    title: 'Czym jest Sparing Live?',
    lead: 'Miejsce, w którym można tanio przegrać, na głos, przed rozmową, która się liczy. Dzwonisz do klienta, egzaminatora, szefa albo inwestora. Słucha na żywo, przerywa Ci, czyta Twój udostępniony ekran, pokazuje nastrój na twarzy i odkłada słuchawkę na słabą ofertę. Po rozmowie recenzja pokazuje, co naprawdę myślał.',
    watchTitle: 'Na co patrzeć w demo',
    watch: [
      { title: 'Wybierz, do kogo dzwonisz', body: 'Czterech rozmówców, cztery poziomy trudności, po polsku lub po angielsku. Wpisz prawdziwą firmę, a rozmówca wie to, co ta firma.' },
      { title: 'Mów i przerywaj im', body: 'To pełny dupleks: mów, gdy postać mówi, a urwie w pół zdania. Jej twarz i poświata strony podążają za nastrojem.' },
      { title: 'Pokaż slajd', body: 'Czyta Twój ekran i od razu bierze się za twierdzenie bez źródła.' },
      { title: 'Przeczytaj ukryte myśli', body: 'Recenzja odtwarza rozmowę z prywatnymi myślami postaci, zdaniem, w którym rozmowa zaczęła Ci się wymykać, i lepszą kwestią do powiedzenia.' },
    ],
    builtTitle: 'Na czym działa',
    built:
      'Wyłącznie na modelach Meta Muse: Spark albo Spark Open na otwartych wagach gra postać; Wonder robi research firmy i recenzję; Voice Transcribe to uszy; Image rysuje twarz; SAM 3.1 czyta kamerę. Głos jest z Twojej przeglądarki. Każde wywołanie modelu jest w publicznej księdze kosztów, a szybkość i zachowanie mierzy skrypt, który możesz uruchomić.',
    nextTitle: 'Dokąd to zmierza',
    nextNote: 'Nic z tego jeszcze nie istnieje.',
    next: [
      { title: 'Komisja, nie jedna osoba', body: 'Komisja egzaminacyjna albo inwestycyjna: kilka głosów w jednej rozmowie, które też sobie przerywają.' },
      { title: 'Postacie, które same się doskonalą', body: 'Modele sparingują ze sobą, żeby wyostrzyć postacie, oceniane tą samą mierzoną ewaluacją.' },
      { title: 'Twój własny materiał', body: 'Wklej ogłoszenie o pracy, umowę albo swoją prezentację i ćwicz z tym, co naprawdę w niej jest.' },
      { title: 'Głos od Meta', body: 'Postać będzie mówić modelem mowy Meta, gdy taki powstanie; dziś to głos przeglądarki.' },
      { title: 'Twoje postępy wszędzie', body: 'Konta i wersja hostowana, żeby słabe punkty i wyniki szły za Tobą na telefon, a trener albo klasa mogli zadawać scenariusze grupie.' },
    ],
    start: 'Przygotuj rozmowę demo',
    startNote: 'Inwestor na poziomie Realistycznym i oferta z liczbami. Zostaje Ci tylko wcisnąć Zadzwoń.',
  },
};
