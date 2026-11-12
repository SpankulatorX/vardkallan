# Teststeg: bygget misslyckas om något test är rött. Resultatet följer med till körsteget.
FROM oven/bun:1.3.14-alpine AS test
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY test ./test
# Runda 14, r2: de pinnade schemana för tjänstekontrakten i RIVTA (rivta/<domän>/KALLA.json).
COPY rivta ./rivta
# Playwright-testerna av gränssnittet (test/avbrott.cjs, test/anvandartest.cjs och test/klickbudget.cjs) körs före bygget. Resultaten följer med här.
COPY klickbudget.json klienttest-resultat.json ./
# Runda 7, r1: Sussas användbarhetstester (test/sussa-testfall.cjs).
COPY sussa-testfall.json ./
# Runda 12, r2: lasttestet för 100 och 500 samtidiga användare (scripts/lasttest.js), med en hash av src/ och public/.
COPY lasttest.json ./
# Runda 12, r2: resultatet av valideringen med HL7:s validator, med en hash av koden som bygger FHIR-resurserna.
COPY fhir-validering.json ./
RUN bun scripts/kor-tester.js

FROM oven/bun:1.3.14-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
# Runda 14, r2: schemana för tjänstekontrakten, som producenterna och konsumenterna validerar mot.
COPY rivta ./rivta
# Runda 13, r1: skriptet för läskoder och nya synpunkter körs i containern (docker exec).
COPY scripts/testinbjudan.js ./scripts/testinbjudan.js
COPY --from=test /app/test-resultat.json ./test-resultat.json
COPY klickbudget.json klienttest-resultat.json sussa-testfall.json lasttest.json fhir-validering.json ./
ENV NODE_ENV=production PORT=8080
RUN mkdir -p /data && chown bun:bun /data
USER bun
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null || exit 1
CMD ["bun", "src/server.js"]
