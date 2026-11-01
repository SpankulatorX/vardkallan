# Teststeg: bygget misslyckas om något test är rött. Resultatet följer med till körsteget.
FROM oven/bun:1.3.14-alpine AS test
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY test ./test
# Playwright-testerna av gränssnittet (test/avbrott.cjs, test/anvandartest.cjs och test/klickbudget.cjs) körs före bygget. Resultaten följer med här.
COPY klickbudget.json klienttest-resultat.json ./
RUN bun scripts/kor-tester.js

FROM oven/bun:1.3.14-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
COPY --from=test /app/test-resultat.json ./test-resultat.json
COPY klickbudget.json klienttest-resultat.json ./
ENV NODE_ENV=production PORT=8080
RUN mkdir -p /data && chown bun:bun /data
USER bun
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null || exit 1
CMD ["bun", "src/server.js"]
