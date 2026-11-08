// Sussa 2.2 Kärnsystemet i relation till nationella tjänster och tjänstekontrakt: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
const T = 'Tjänstekontrakt > ';

export default [
  { id: '2.2.1.1', kategori: 'nationell', egna: ['L9'], tester: [], avsedd: 'planerat',
    anmarkning: 'Tjänstekontraktet är inte anslutet. Vårdkällan har inga integrationer mot tjänsteplattformen i första versionen. Tabellen över tjänstekontrakten i K10 på sidan Öppet API visar vad som finns lokalt. HSA-id i demon är påhittade och personal och enheter ligger i seeden.' },
  { id: '2.2.1.2', kategori: 'nationell', egna: ['L9'], tester: [], avsedd: 'planerat',
    anmarkning: 'Tjänstekontraktet är inte anslutet. Vårdkällan har inga integrationer mot tjänsteplattformen i första versionen. Tabellen över tjänstekontrakten i K10 på sidan Öppet API visar vad som finns lokalt. Personuppgifterna kommer från seeden med Skatteverkets testpersonnummer. Ingen uppslagning i PU-tjänsten görs.' },
  { id: '2.2.1.3', kategori: 'nationell', egna: ['L3', 'L8'], tester: [], avsedd: 'planerat',
    anmarkning: 'Tjänstekontraktet är inte anslutet. Vårdkällan har inga integrationer mot tjänsteplattformen i första versionen. Tabellen över tjänstekontrakten i K10 på sidan Öppet API visar vad som finns lokalt. Spärr, spärrmarkering och samtycke i stunden finns i Vårdkällans egen behörighetsmotor (L3), men inte via den nationella spärrtjänsten.' },
  { id: '2.2.1.4', kategori: 'nationell', egna: ['L3', 'L8'], tester: [], avsedd: 'planerat',
    anmarkning: 'Tjänstekontraktet är inte anslutet. Vårdkällan har inga integrationer mot tjänsteplattformen i första versionen. Tabellen över tjänstekontrakten i K10 på sidan Öppet API visar vad som finns lokalt. Samtycke i stunden till spärrade uppgifter finns lokalt (L3). Sammanhållen journalföring mellan vårdgivare är inte byggd.' },
  { id: '2.2.1.5', kategori: 'nationell', egna: ['L8'], tester: [], avsedd: 'planerat',
    anmarkning: 'Tjänstekontraktet är inte anslutet. Vårdkällan har inga integrationer mot tjänsteplattformen i första versionen. Tabellen över tjänstekontrakten i K10 på sidan Öppet API visar vad som finns lokalt.' },
  { id: '2.2.1.6', kategori: 'nationell', egna: ['L5', 'L8'], tester: [], avsedd: 'planerat',
    anmarkning: 'Tjänstekontraktet är inte anslutet. Vårdkällan har inga integrationer mot tjänsteplattformen i första versionen. Tabellen över tjänstekontrakten i K10 på sidan Öppet API visar vad som finns lokalt. Vårdkällan har en egen e-tjänst för patienten, Min journal, men ingen anslutning till 1177.' },
  // Runda 7, r5: tabellen över tjänstekontrakten i K10 och en simulerad producent med ett RIV-TA-liknande API för de
  // kontrakt där uppgifterna redan finns (tjanstekontrakt.js).
  { id: '2.2.1.7', kategori: 'nationell', egna: ['L5', 'L8'], avsedd: 'delvis',
    tester: [`${T}tabellen har alla tjänstekontrakt i K10 med roll, motsvarighet och status`, `${T}GetCareDocumentation, GetAlertInformation och GetCareContacts svarar med samma behörighet som FHIR`, `${T}GetDiagnosis svarar med patientens diagnoser i kontraktets struktur och loggas som FHIR`],
    losning: 'Sidan Öppet API har en tabell med varje tjänstekontrakt i K10, med Vårdkällans roll, FHIR-resursen eller API:t som svarar mot det och om det är simulerat. Journalen använder GetCareDocumentation, GetDiagnosis, GetAlertInformation och GetCareContacts, och för dem finns en simulerad producent under /api/riv med samma behörighet och loggning som FHIR.',
    expert: 'Producenten lämnar bara det som behörighetsmotorn ger den som frågar, med spärrar, inre sekretess och skyddad identitet som i resten av systemet, och loggar varje anrop med kontraktets namn.',
    anmarkning: 'Simulerat: JSON i stället för SOAP, ingen tjänsteplattform, ingen anslutning till Journalen på 1177 och inga kontrakt för observationer, provsvar, läkemedel och remisstatus som producent. Min journal är Vårdkällans egen e-tjänst. Producenten anropas med personalens session, inte av en nationell tjänst.' },
  { id: '2.2.1.8', kategori: 'nationell', egna: ['L8'], avsedd: 'delvis',
    tester: [`${T}GetDiagnosis svarar med patientens diagnoser i kontraktets struktur och loggas som FHIR`, `${T}GetCareDocumentation, GetAlertInformation och GetCareContacts svarar med samma behörighet som FHIR`, `${T}producenten nekar fel roll och visar inte spärrade uppgifter`, `${T}okänt kontrakt, patient eller logisk adress ger ett fel på svenska`],
    losning: 'En simulerad producent för fyra av NPÖ:s tjänstekontrakt (GetCareDocumentation, GetDiagnosis, GetAlertInformation och GetCareContacts) under /api/riv, med kontraktets struktur, filter på vårdenhet och period och samma behörighet och loggning som FHIR. Övriga kontrakt och deras motsvarighet i FHIR står i tabellen över tjänstekontrakt.',
    expert: 'Producenten läser genom samma prövning som FHIR-API:t, så att inget som är spärrat eller dolt kan röjas, och svaret talar aldrig om att något är dolt.',
    anmarkning: 'Simulerat: JSON i stället för SOAP, ingen tjänsteplattform och ingen konsument. Spärrar och samtycke hanteras inte som i sammanhållen journalföring mellan vårdgivare, utan som inom vårdgivaren. PADL, vaccinationer, bilddiagnostik och mödravård finns inte.' },
  { id: '2.2.1.9', kategori: 'nationell', egna: ['L8'], tester: [], avsedd: 'planerat',
    anmarkning: 'Tjänstekontraktet är inte anslutet. Vårdkällan har inga integrationer mot tjänsteplattformen i första versionen. Tabellen över tjänstekontrakten i K10 på sidan Öppet API visar vad som finns lokalt.' },
  { id: '2.2.1.10', kategori: 'nationell', egna: ['L8'], tester: [], avsedd: 'planerat',
    anmarkning: 'Tjänstekontraktet är inte anslutet. Vårdkällan har inga integrationer mot tjänsteplattformen i första versionen. Tabellen över tjänstekontrakten i K10 på sidan Öppet API visar vad som finns lokalt.' },
  { id: '2.2.1.11', kategori: 'nationell', egna: ['L8'], tester: [], avsedd: 'planerat',
    anmarkning: 'Tjänstekontraktet är inte anslutet. Vårdkällan har inga integrationer mot tjänsteplattformen i första versionen. Tabellen över tjänstekontrakten i K10 på sidan Öppet API visar vad som finns lokalt. Vaccinationer registreras inte i demon.' },
  { id: '2.2.1.12', kategori: 'nationell', egna: ['D1', 'L8'], tester: [], avsedd: 'planerat',
    anmarkning: 'Tjänstekontraktet är inte anslutet. Vårdkällan har inga integrationer mot tjänsteplattformen i första versionen. Tabellen över tjänstekontrakten i K10 på sidan Öppet API visar vad som finns lokalt. Remisser med kvittens och larm finns inom vårdgivaren (D1), men inte via den nationella e-remissen.' },
  { id: '2.2.1.13', kategori: 'nationell', egna: ['L8'], tester: [], avsedd: 'planerat',
    anmarkning: 'Tjänstekontraktet är inte anslutet. Vårdkällan har inga integrationer mot tjänsteplattformen i första versionen. Tabellen över tjänstekontrakten i K10 på sidan Öppet API visar vad som finns lokalt.' },
  { id: '2.2.1.14', kategori: 'nationell', egna: ['L8'], tester: [], avsedd: 'planerat',
    anmarkning: 'Tjänstekontraktet är inte anslutet. Vårdkällan har inga integrationer mot tjänsteplattformen i första versionen. Tabellen över tjänstekontrakten i K10 på sidan Öppet API visar vad som finns lokalt.' },
];
