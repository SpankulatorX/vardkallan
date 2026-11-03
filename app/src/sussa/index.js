// Sussa-registret: Sussas kravspecifikation med originalnummer och hur Vårdkällan möter varje post.
// Källa och utdrag: kravspec.json. Mappningen ligger i en fil per avsnitt i mappning/, så att ett avsnitt kan ändras
// utan att röra de andra. Varje post i mappningen har:
//   id          Sussas originalnummer, till exempel 3.5.2.6.
//   kategori    system, nationell (kräver en nationell tjänst eller extern part) eller leverantor (gäller leverantören,
//               driften eller projektet och inte systemets funktion).
//   egna        id i Vårdkällans egna ramverk (K, D, L, M i krav.js) som posten hänger ihop med.
//   tester      exakta testnamn, i samma format som i krav.js.
//   avsedd      uppfyllt_demo, delvis eller planerat.
//   losning     vad Vårdkällan har för posten i dag. Krävs när posten inte är planerad.
//   expert      hur systemet tar expertrollen, en till två meningar. Krävs för system-poster som inte är planerade.
//   anmarkning  vad som saknas eller är simulerat.
// Statusen räknas som för de egna kraven: uppfyllt_demo bara när alla tester finns och är gröna, annars delvis.
// En post utan tester är planerad.
import spec from './kravspec.json' with { type: 'json' };
import a2_1 from './mappning/2.1.js';
import a2_2 from './mappning/2.2.js';
import a2_3 from './mappning/2.3.js';
import a2_4 from './mappning/2.4.js';
import a2_5 from './mappning/2.5.js';
import a2_6 from './mappning/2.6.js';
import a2_7 from './mappning/2.7.js';
import a3_1_1 from './mappning/3.1.1.js';
import a3_1_2 from './mappning/3.1.2.js';
import a3_1_3 from './mappning/3.1.3.js';
import a3_1_4 from './mappning/3.1.4.js';
import a3_1_5 from './mappning/3.1.5.js';
import a3_1_6 from './mappning/3.1.6.js';
import a3_1_7 from './mappning/3.1.7.js';
import a3_1_8 from './mappning/3.1.8.js';
import a3_1_9 from './mappning/3.1.9.js';
import a3_1_10 from './mappning/3.1.10.js';
import a3_1_11 from './mappning/3.1.11.js';
import a3_1_12 from './mappning/3.1.12.js';
import a3_2_1 from './mappning/3.2.1.js';
import a3_2_2 from './mappning/3.2.2.js';
import a3_2_3 from './mappning/3.2.3.js';
import a3_3_1 from './mappning/3.3.1.js';
import a3_3_2 from './mappning/3.3.2.js';
import a3_4_1 from './mappning/3.4.1.js';
import a3_4_2 from './mappning/3.4.2.js';
import a3_4_3 from './mappning/3.4.3.js';
import a3_4_4 from './mappning/3.4.4.js';
import a3_5_1 from './mappning/3.5.1.js';
import a3_5_2 from './mappning/3.5.2.js';
import a3_5_3 from './mappning/3.5.3.js';
import a3_5_4 from './mappning/3.5.4.js';
import a3_5_5 from './mappning/3.5.5.js';
import a3_6_1 from './mappning/3.6.1.js';
import a3_7_1 from './mappning/3.7.1.js';
import a4_1 from './mappning/4.1.js';
import a4_2 from './mappning/4.2.js';
import a4_3 from './mappning/4.3.js';
import a4_4_1 from './mappning/4.4.1.js';
import a4_4_2 from './mappning/4.4.2.js';
import a4_4_3 from './mappning/4.4.3.js';
import a4_5 from './mappning/4.5.js';
import a4_6 from './mappning/4.6.js';
import a4_7 from './mappning/4.7.js';
import a4_8 from './mappning/4.8.js';
import a5_1_1 from './mappning/5.1.1.js';
import a5_1_2 from './mappning/5.1.2.js';
import a5_1_3 from './mappning/5.1.3.js';
import a5_1_4 from './mappning/5.1.4.js';
import a5_2 from './mappning/5.2.js';
import a5_3 from './mappning/5.3.js';
import a5_4_2 from './mappning/5.4.2.js';
import a6_1_1 from './mappning/6.1.1.js';
import a6_2_1 from './mappning/6.2.1.js';
import a6_2_2 from './mappning/6.2.2.js';
import a6_3_1 from './mappning/6.3.1.js';
import a6_3_2 from './mappning/6.3.2.js';
import a6_3_3 from './mappning/6.3.3.js';
import a11_1 from './mappning/11.1.js';
import a11_2 from './mappning/11.2.js';
import a11_3 from './mappning/11.3.js';

export const SPEC = spec;
export const KATEGORIER = ['system', 'nationell', 'leverantor'];
export const AVSEDD = ['uppfyllt_demo', 'delvis', 'planerat'];

// Alla avsnitt med poster. Varje fil har avsnittets poster i dokumentets ordning.
export const AVSNITTSFILER = {
  '2.1': a2_1, '2.2': a2_2, '2.3': a2_3, '2.4': a2_4, '2.5': a2_5, '2.6': a2_6, '2.7': a2_7, '3.1.1': a3_1_1, '3.1.2': a3_1_2, '3.1.3': a3_1_3,
  '3.1.4': a3_1_4, '3.1.5': a3_1_5, '3.1.6': a3_1_6, '3.1.7': a3_1_7, '3.1.8': a3_1_8, '3.1.9': a3_1_9, '3.1.10': a3_1_10, '3.1.11': a3_1_11,
  '3.1.12': a3_1_12, '3.2.1': a3_2_1, '3.2.2': a3_2_2, '3.2.3': a3_2_3, '3.3.1': a3_3_1, '3.3.2': a3_3_2, '3.4.1': a3_4_1, '3.4.2': a3_4_2,
  '3.4.3': a3_4_3, '3.4.4': a3_4_4, '3.5.1': a3_5_1, '3.5.2': a3_5_2, '3.5.3': a3_5_3, '3.5.4': a3_5_4, '3.5.5': a3_5_5, '3.6.1': a3_6_1,
  '3.7.1': a3_7_1, '4.1': a4_1, '4.2': a4_2, '4.3': a4_3, '4.4.1': a4_4_1, '4.4.2': a4_4_2, '4.4.3': a4_4_3, '4.5': a4_5, '4.6': a4_6, '4.7': a4_7,
  '4.8': a4_8, '5.1.1': a5_1_1, '5.1.2': a5_1_2, '5.1.3': a5_1_3, '5.1.4': a5_1_4, '5.2': a5_2, '5.3': a5_3, '5.4.2': a5_4_2, '6.1.1': a6_1_1,
  '6.2.1': a6_2_1, '6.2.2': a6_2_2, '6.3.1': a6_3_1, '6.3.2': a6_3_2, '6.3.3': a6_3_3, '11.1': a11_1, '11.2': a11_2, '11.3': a11_3,
};
export const MAPPNING = Object.values(AVSNITTSFILER).flat();

// Alla testnamn som registret pekar på. Bygget stoppas om något av dem inte finns (scripts/kor-tester.js).
export const sussaTester = (mappning = MAPPNING) => [...new Set(mappning.flatMap(m => m.tester))];

const tom = (nycklar) => Object.fromEntries(nycklar.map(n => [n, 0]));

// resultat är test-resultat.json från bygget, klient resultatet från testerna av gränssnittet (klientresultat.js) och
// egna kravregistret från krav.js, för att visa de kopplade egna kravens status.
export function sussaRegister(resultat, klient = null, { mappning = MAPPNING, poster = spec.poster, egna = null } = {}) {
  const status = new Map([...(resultat?.tester ?? []), ...(klient?.tester ?? [])].map(t => [t.namn, t.status]));
  const perId = new Map(mappning.map(m => [m.id, m]));
  const egnaKrav = new Map((egna?.krav ?? []).map(k => [k.id, k]));
  const summa = { status: tom(AVSEDD), kategori: tom(KATEGORIER), korstabell: Object.fromEntries(KATEGORIER.map(k => [k, tom(AVSEDD)])) };
  const ut = poster.map(p => {
    const m = perId.get(p.id);
    const tester = (m?.tester ?? []).map(namn => ({ namn, status: status.get(namn) ?? 'saknas' }));
    const allaGrona = tester.length > 0 && tester.every(t => t.status === 'grön');
    let s = m?.avsedd ?? 'planerat';
    if (!tester.length) s = 'planerat';
    else if (s === 'uppfyllt_demo' && !allaGrona) s = 'delvis';
    const kategori = m?.kategori ?? 'system';
    summa.status[s]++;
    summa.kategori[kategori]++;
    summa.korstabell[kategori][s]++;
    return {
      ...p, kategori, status: s, avsedd: m?.avsedd ?? 'planerat', tester,
      egna: (m?.egna ?? []).map(id => { const k = egnaKrav.get(id); return { id, rubrik: k?.rubrik ?? null, status: k?.status ?? null }; }),
      losning: m?.losning ?? null, expert: m?.expert ?? null, anmarkning: m?.anmarkning ?? null,
    };
  });
  return {
    kalla: spec.kalla, utdrag: spec.utdrag, kapitel: spec.kapitel, saknadeKapitel: spec.saknadeKapitel,
    avsnitt: spec.avsnitt.map(({ id, rubrik, kapitel, sida, sammanfattning }) => ({ id, rubrik, kapitel, sida, sammanfattning })),
    testresultat: resultat ? { tid: resultat.tid, bun: resultat.bun, antal: resultat.antal, godkanda: resultat.godkanda, misslyckade: resultat.misslyckade } : null,
    klienttester: klient?.klienttester ?? null,
    summa, poster: ut,
  };
}
