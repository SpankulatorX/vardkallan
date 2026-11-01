// Invånare som kan logga in i Min journal med simulerad e-legitimation, och vårdgivarens regler för vad som visas där.
//
// Varje patient i seeden är också en invånare. Därtill finns vårdnadshavare som inte själva har någon journal i demon.
// Personnumren är testpersonnummer från Skatteverket (research/testpersonnummer.json) och namnen är påhittade.
export const VARDNADSHAVARE = [
  { id: 'inv-vh01', pnr: '198612142383', fornamn: 'Johanna', efternamn: 'Bergström', barn: ['p09'] },
];

// Visningsregler för anteckningar i Min journal, per vårdenhet, anteckningstyp eller båda. Vårdgivaren bestämmer vilka
// uppgifter som lämnas ut genom direktåtkomst (patientdatalagen 5 kap. 5 §). Den mest specifika regeln gäller: vårdenhet
// och typ före bara vårdenhet före bara typ. Utan regel visas en signerad anteckning direkt.
//   visning: direkt | fordrojd (visas dagar efter signering) | visas_inte
// Motiveringen visas för patienten, som ska få veta att tillgången är begränsad (HSLF-FS 2016:40 4 kap. 12 §).
export const VISNINGSREGLER = [
  { enhet: 'uso-psyk', typ: 'Mottagningsanteckning', visning: 'fordrojd', dagar: 14,
    motivering: 'Allmänpsykiatriska kliniken visar sina mottagningsanteckningar i Min journal 14 dagar efter att de har signerats, så att du hinner få bedömningen vid ett samtal först.' },
  { enhet: 'uso-psyk', typ: 'Omvårdnadsanteckning', visning: 'visas_inte',
    motivering: 'Allmänpsykiatriska kliniken visar inte sina omvårdnadsanteckningar i Min journal. Du kan begära en kopia av journalen från kliniken. Då prövar kliniken om uppgifterna kan lämnas ut till dig.' },
];
