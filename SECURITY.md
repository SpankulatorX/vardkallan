# Säkerhet

## Rapportera en säkerhetsbrist

Rapportera en säkerhetsbrist privat genom GitHubs funktion för privata säkerhetsrapporter: fliken för säkerhet i repot och
knappen för att rapportera en sårbarhet. Rapporten når bara förvaltaren av repot. Skriv aldrig om en säkerhetsbrist i ett öppet
ärende, ett ändringsförslag eller forumet, eftersom alla kan läsa dem.

Beskriv vad du gjorde, vad som hände och vad det kan leda till, och med vilken version (`/api/health` visar den).
Pröva bara mot din egen sandlåda i demon eller mot en egen installation. Demon har bara påhittade patienter, och en
rapport ska inte innehålla riktiga personuppgifter.

## Vad som händer med rapporten

Förvaltaren bekräftar rapporten, prövar den och rättar bristen med ett test som först visar felet. Ett fynd står i
`app/src/sakerhetsfynd.json` tills det är rättat och prövat, och rättelsen beskrivs i ändringsloggen när den är ute.
Den som rapporterar nämns i rättelsen, om den som rapporterar vill det.

Projektet förvaltas av en enskild person och lovar inga svarstider. En organisation som inför Vårdkällan behöver en egen
rutin för säkerhetsrapporter med avtalade tider, som `docs/drift/incidentrapportering.md` beskriver.

## Versioner

Bara den senaste versionen rättas. Säkerhetsarkitekturen och hotmodellen beskrivs i `docs/sakerhetsarkitektur.md`.
