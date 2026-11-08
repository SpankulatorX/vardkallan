# Säkerhetsarkitektur

Den här beskrivningen svarar på Sussa 5.3.1.18: hur Vårdkällans säkerhetsarkitektur skyddar informationen mot yttre och inre hot, på konceptuell och principiell nivå. Hotmodellen finns också i koden (`app/src/hotmodell.js`), där varje hot pekar på de automatiska tester som visar att kontrollen fungerar. Testerna är mappade på posten 5.3.1.18 i Sussa-registret, så bygget stoppas om något av dem saknas eller är rött.

## Grundtanke

Säkerheten ligger i servern och databasen, inte i användarens val. Varje anrop prövas på servern av samma behörighetsmotor, oavsett om det kommer från gränssnittet, FHIR-API:t eller en extern tillämpning. Användaren behöver aldrig välja behörighet, avgöra vad som är känsligt eller signera ett meddelande: systemet räknar ut och gör det själv och förklarar på vanlig svenska när något inte går.

## Skikten

1. **Inloggning.** Personalen loggar in genom en autentiseringstjänst med OpenID Connect. Tjänsten utfärdar en signerad id-biljett (ES256) med personens HSA-id och medarbetaruppdrag. Vårdkällan godtar bara biljetter från en betrodd utfärdare, med rätt nyckel, mottagare och giltighetstid, och varje biljett används en gång (`idp.js`). I demon är tjänsten simulerad.
2. **Session.** Sessionskakan är HttpOnly och SameSite=Lax och byts vid varje inloggning. Skrivande anrop med fel Origin avvisas, och inloggningen går ut efter en tid utan aktivitet.
3. **Behörighet.** Behörighetsmotorn (`atkomst.js`) räknar åtkomsten ur yrkesroll, vårdenhet och vårdrelation i varje anrop, med inre sekretess, spärr och nödåtkomst. Uppdraget i biljetten prövas mot masterdata i varje anrop, så att en person som blir inaktiv eller byter vårdenhet förlorar åtkomsten direkt (`uppdragGaller`).
4. **Skyddsbehov.** Varje informationstyp har en klassning (`skyddsbehov.js`). Uppgifter med mycket högt skyddsbehov kan tas fram för sig i logguppföljningen och tas alltid med i stickprovet.
5. **Integritet.** Signerade anteckningar, loggar, beslutsjournaler och bevis skyddas av databastriggrar mot ändring och radering. Åtkomstloggen och säkerhetsloggen kedjas med SHA-256.
6. **Kommunikation med andra organisationer.** Meddelanden signeras med instansernas X.509-certifikat och kvitteras med motpartens signatur, och ett meddelande tas emot först när certifikatkedjan, giltigheten och spärrlistan stämmer (`pki.js`, `signering.js`).
7. **Uppföljning.** Varje åtkomst loggas med grund, nödåtkomst och nekade försök flaggas, stickprov dras slumpvis, och säkerhetshändelser loggas för sig.
8. **Kontinuitet.** Säkerhetskopian är en konsistent ögonblicksbild och provåterläses med kontroll av tabeller, triggrar och loggarnas kedjor. Läskopian för avbrott är krypterad i webbläsaren.

## Hotmodell

| Id | Slag | Hot | Kontroll | Princip |
|---|---|---|---|---|
| Y1 | Yttre | Inloggning med en förfalskad, ändrad, gammal eller stulen biljett | Bara betrodda utfärdare, rätt algoritm, nyckel, mottagare och giltighetstid, och en gång per biljett | Självförsvar, säkerhet i lager |
| Y2 | Yttre | En annan webbplats gör anrop i den inloggades namn, eller ett skript läser kakan | HttpOnly och SameSite, Origin-kontroll, ny sessionsnyckel vid inloggning | Säkerhet i lager, härdning |
| Y3 | Yttre | Överbelastning eller gissning genom många eller stora anrop | Tak för kroppens storlek, nya sandlådor per adress och nekade försök | Redundans, härdning |
| Y4 | Yttre | Ett meddelande från en annan organisation är förfalskat eller ändrat | Signatur, certifikatkedja till betrodd utfärdare, giltighet och spärrlista | Kontrollerat informationsflöde, självförsvar |
| Y5 | Yttre | En motpart förnekar att den tog emot ett meddelande | Signerad kvittens och bevis som inte kan ändras | Kontrollerat informationsflöde |
| Y6 | Yttre | En prenumeration får servern att anropa interna adresser | Bara godkända mottagare, utan omdirigeringar och interna adresser | Härdning, kontrollerat informationsflöde |
| Y7 | Yttre | En extern tillämpning får mer än personen som startade den | Biljettens omfång kan bara minska behörigheten | Minsta möjliga privilegium |
| I1 | Inre | Personal läser journaler utan att delta i vården | Vårdrelation i varje anrop, flaggad nödåtkomst, logg och stickprov | Minsta möjliga privilegium, säkerhet i lager |
| I2 | Inre | Personal läser en annan vårdenhets eller spärrade uppgifter | Inre sekretess med aktivt val och spärr som bara samtycke häver | Minsta möjliga privilegium, balanserad säkerhet |
| I3 | Inre | Journal eller logg ändras eller raderas i efterhand | Databastriggrar och hashkedjor | Självförsvar, säkerhet i lager |
| I4 | Inre | Behörigheten finns kvar när anställningen eller uppdraget har upphört | Behörigheten räknas ur masterdata i varje anrop | Minsta möjliga privilegium, minimalism |
| I5 | Inre | Uppgifter med mycket högt skyddsbehov röjs | Maskering av skyddad identitet, klassning, eget urval och stickprov | Balanserad säkerhet, säkerhet i lager |
| I6 | Inre | Patientuppgifter hamnar i en test- eller utbildningsmiljö | Avidentifiering av acceptanstestmiljön och fiktiva data i de andra | Kontrollerat informationsflöde, minimalism |
| I7 | Inre | Data går förlorad efter ett fel | Säkerhetskopia och provåterläsning | Redundans |
| I8 | Inre | Säkerhetshändelser passerar obemärkt | Egen säkerhetslogg med hashkedja | Säkerhet i lager |

Testerna för varje hot står i `app/src/hotmodell.js`.

## Principerna i kravtexten

- **Minimalism:** en behörighetsmotor och en loggfunktion för alla vägar in, i stället för kontroller i varje vy. Behörigheten administreras inte för hand utan räknas ur masterdata.
- **Minsta möjliga privilegium:** varje yrkesroll har bara de handlingar den behöver, roller som inte vårdar läser inte journalen, och en extern tillämpning får aldrig mer än personen.
- **Redundans:** tak för belastning, läsläge vid avbrott och provåterläst säkerhetskopia.
- **Säkerhet i lager:** inloggning, session, behörighet, triggrar, loggar och uppföljning skyddar var för sig, så att ett fel i ett skikt inte räcker.
- **Självförsvar:** kontrollerna har inga onödiga beroenden. Triggrarna skyddar även mot den som går förbi API:t, och en biljett eller ett meddelande prövas mot utfärdarens nyckel och inget annat.
- **Kontrollerat informationsflöde:** information lämnar systemet bara signerad och kvitterad, till godkända mottagare, och avidentifierad till testmiljöer.
- **Balanserad säkerhet:** samma regler gäller i gränssnittet, FHIR-API:t, läskopian och exporterna.
- **Härdning:** bara de vägar som behövs är öppna, med begränsade kroppar, godkända mottagare och avvisade anrop från andra webbplatser.

## Det som inte är gjort

Ingen extern säkerhetsgranskning eller penetrationstest är gjord. Autentiseringstjänsten, motparterna och rotutfärdaren för certifikaten är simulerade i demon.
