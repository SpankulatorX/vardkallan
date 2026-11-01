// System Usability Scale (SUS), enkäten efter användartestet (D6).
//
// Originalet: Brooke J. SUS: A "quick and dirty" usability scale. I: Jordan PW, Thomas B, Weerdmeester BA,
// McClelland IL (red.). Usability Evaluation in Industry. London: Taylor & Francis; 1996. s. 189 till 194.
// Den svenska översättningen: Helene Åvik Persson, Charlotte Castor, Nilla Andersson och Mia Hylén. Swedish Version
// of the System Usability Scale: Translation, Adaption, and Psychometric Evaluation. JMIR Human Factors 2025;12:e64210.
// doi:10.2196/64210 (CC BY 4.0). Översättningen säger "denna applikation". Här står "detta system", med de böjningar
// det kräver, eftersom SUS tillåter att ordet byts mot det som testas. Svarsskalan går från 1, Instämmer inte alls,
// till 5, Instämmer helt.

export const SUS_KALLA = 'Brooke 1996, svensk översättning Helene Åvik Persson m.fl., JMIR Human Factors 2025;12:e64210, doi:10.2196/64210';

export const SUS_INSTRUKTION = 'Markera det alternativ som bäst beskriver din upplevelse av systemet i dag. Svara på alla påståenden. Om du inte vet vad du ska svara, markera mittenalternativet.';

export const SUS_PASTAENDEN = [
  'Jag tror att jag skulle vilja använda detta system ofta.',
  'Jag uppfattar detta system som onödigt komplext.',
  'Jag tycker att detta system är enkelt att använda.',
  'Jag tror att jag skulle behöva stöd för att kunna använda detta system.',
  'Jag upplever att de olika funktionerna i detta system var väl integrerade.',
  'Jag tycker att systemet är inkonsekvent.',
  'Jag föreställer mig att de flesta personer skulle lära sig att använda detta system väldigt snabbt.',
  'Jag upplever detta system som krångligt.',
  'Jag känner mig trygg med att använda detta system.',
  'Jag behövde lära mig många saker innan jag kunde komma igång med detta system.',
];

export const SUS_SKALA = { 1: 'Instämmer inte alls', 5: 'Instämmer helt' };

// Standardformeln: udda påståenden (1, 3, 5, 7, 9) ger svaret minus 1, jämna (2, 4, 6, 8, 10) ger 5 minus svaret.
// Summan, 0 till 40, gånger 2,5 ger poängen 0 till 100. Utan svar på alla tio påståenden finns ingen poäng.
export function susPoang(svar) {
  if (!Array.isArray(svar) || svar.length !== 10) return null;
  let summa = 0;
  for (let i = 0; i < 10; i++) {
    const v = Number(svar[i]);
    if (!Number.isInteger(v) || v < 1 || v > 5) return null;
    summa += i % 2 === 0 ? v - 1 : 5 - v;
  }
  return summa * 2.5;
}
