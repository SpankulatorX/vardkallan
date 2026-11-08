// Kallelsen på engelska för patienter som har valt engelska i Min journal (runda 6, r4, Sussa 3.4.3.3). Texterna är på
// engelska med flit, så språkkontrollen (test/sprakkontroll.js) läser inte den här filen. Samma innehåll som den svenska
// kallelsen i tidbok.js: aldrig journaltext, diagnos eller remissens frågeställning.
import { INGREPP } from './seed/planering.js';

const TZ = 'Europe/Stockholm';
const TIDSTYP_EN = { nybesok: 'New visit', aterbesok: 'Follow-up visit', telefon: 'Telephone appointment', video: 'Video appointment', grupp: 'Group session', ingrepp: 'Procedure', provtagning: 'Blood test', team: 'Team visit' };
const YRKE_EN = { lakare: 'doctor', sjukskoterska: 'nurse', fysioterapeut: 'physiotherapist' };
const FORBEREDELSER_EN = {
  team: 'You will meet several members of the care team at the same visit. Arrive ten minutes before your appointment.',
  nybesok: 'Please bring a list of the medicines you take. Arrive ten minutes before your appointment.',
  aterbesok: 'Please bring a list of the medicines you take. Arrive ten minutes before your appointment.',
  telefon: 'We will call you at the appointment time. Make sure you can talk undisturbed.',
  video: 'Log in to Min journal five minutes before the appointment. The link to the video appointment is there.',
  grupp: 'The session is held in a group and takes about two hours. You are welcome to bring a relative.',
  ingrepp: 'Arrive 30 minutes before the appointment.',
  provtagning: 'Arrive five minutes before the appointment.',
};
export const tidTextEn = (t) => `${new Date(t).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ })} at ${new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ })}`;
const klockaEn = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ });

// Kallelsen på engelska. d har det som tidbok.js har räknat fram för kallelsen: fornamn, tidstyp, yrkesroll,
// vardgivare, rubrik, start, ort, fysisk, avgift ({ belopp } eller null), mall (true utan patient), vantelista, ingrepp,
// lokal, fore ({ start, ort }) och transport.
export function kallelseEngelska(typ, d) {
  const tt = d.ingrepp ? INGREPP[d.ingrepp]?.textEn ?? TIDSTYP_EN[d.tidstyp] : TIDSTYP_EN[d.tidstyp];
  const vem = d.tidstyp === 'grupp' ? `${d.rubrik ?? 'Group session'}, led by ${YRKE_EN[d.yrkesroll]} ${d.vardgivare ?? ''}` : `${tt} with ${YRKE_EN[d.yrkesroll]} ${d.vardgivare ?? ''}`;
  const plats = `${d.lokal ? `${d.lokal}, ` : ''}${d.fysisk ? d.ort : `${tt}, ${d.ort}`}`;
  const forb = d.ingrepp ? INGREPP[d.ingrepp]?.forberedelseEn : FORBEREDELSER_EN[d.tidstyp];
  const avgift = d.mall ? 'Fee: the system calculates the fee for each patient.' : !d.avgift ? '' : d.avgift.belopp === 0 ? 'Fee: no fee.' : `Fee: ${d.avgift.belopp} kronor. If you have a high-cost exemption card you pay nothing. The fees in the demo are made up.`;
  const andra = 'Cannot come? Rebook or cancel in Min journal at least 24 hours before, or call the clinic.';
  const incheck = d.fysisk ? 'Check in with Min journal or at the screen in the waiting room when you arrive.' : null;
  const fore = d.fore ? `Before the visit: blood test at ${klockaEn(d.fore.start)}, ${d.fore.ort}. Please be on time so that the results are ready.` : null;
  const resa = d.transport ? 'A patient transport is booked for you (simulated in the demo).' : null;
  const rader = {
    kallelse: [`Dear ${d.fornamn},`, `You have an appointment. ${vem}.`, `Time: ${tidTextEn(d.start)}.`, fore, `Place: ${plats}.`, forb, resa, incheck, avgift, andra],
    ombokning: [`Dear ${d.fornamn},`, 'Your appointment has been changed. The old time is no longer valid.', `New time: ${tidTextEn(d.start)}. ${vem}.`, fore, `Place: ${plats}.`, forb, resa, incheck, avgift, andra],
    paminnelse: [`Reminder: you have an appointment ${tidTextEn(d.start)}. ${vem}, ${d.ort}.`, fore, d.fysisk ? incheck : forb, 'Cannot come? Cancel in Min journal or call the clinic.'],
    avbokning: [`Dear ${d.fornamn},`, `Your appointment ${tidTextEn(d.start)} at ${d.ort} has been cancelled.`, d.fore ? 'The blood test before the visit has also been cancelled.' : null,
      d.vantelista ? 'You remain in the queue and will get a new time.' : 'Would you like a new time? Book in Min journal or call the clinic.'],
  }[typ];
  return rader.filter(Boolean).join('\n');
}

// Kallelsen utan förbokad tid (planering.js).
const TIDSTYP_RAM_EN = { aterbesok: 'follow-up visit', telefon: 'telephone appointment', video: 'video appointment' };
export const ramTextEngelska = (p, v, ve, ram) => [`Dear ${p.fornamn},`,
  `You have been invited to a ${TIDSTYP_RAM_EN[v.tidstyp] ?? 'visit'} with a ${YRKE_EN[v.yrkesroll]} at ${ve}.`,
  `Choose a time in Min journal between ${ram.fran} and ${ram.till}. The system shows the times that suit you.`,
  'If you do not choose a time, the clinic will call you.'].join('\n');

// Rubriken i PDF:en för en kallelse på engelska, med den svenska rubriken först.
export const RUBRIK_ENGELSKA = { kallelse: 'Kallelse (appointment letter)', paminnelse: 'Påminnelse (reminder)', ombokning: 'Kallelse, ny tid (new time)', avbokning: 'Avbokning (cancellation)' };
