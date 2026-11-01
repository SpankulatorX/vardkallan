// Räkning av klick, fältbyten och tangenttryck i användartestet (D6). Samma regler som klickbudgeten i
// app/src/klickbudget.js, som test/klickbudget.cjs mäter med ett skript, så att siffrorna från verkliga användare
// går att jämföra med skriptets:
//   klick      musklick på en knapp, länk, kryssruta, rad eller annat som går att klicka på. En rullgardinslista som
//              ändras räknas som två klick: att öppna den och att välja. Ändras den med tangentbordet räknas
//              tangenterna i stället.
//   fältbyte   varje gång användaren själv flyttar sig till ett textfält, med musen eller med Tab. Ett fält som
//              gränssnittet har satt fokus i räknas inte. Texten som skrivs räknas inte.
//   tangent    tangenter som inte är text, till exempel Enter för att skicka en sökning. Tangenter som används för
//              att skriva och rätta text i ett fält (Backspace, piltangenter, Enter i en textruta) räknas inte.
//
// Modulen har inga beroenden till sidan. anvandartest.js översätter webbläsarens händelser till enkla objekt:
//   { typ: 'pointerdown' | 'click' | 'focusin' | 'keydown' | 'change', tid, mal, detail, tangent, iTextfalt, iTextruta, iLista }
// där mal är { id, textfalt, lista, etikettFor, etikettTillTextfalt, klickbar, text } för elementet som händelsen gäller.
// id är ett nummer per element, så att ett fältbyte kan kopplas till musklicket i samma fält.

const MODIFIERARE = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'Fn', 'Dead', 'Process', 'Unidentified', 'Compose']);
// Tangenter som hör till skrivandet i ett textfält.
const SKRIVTANGENTER = new Set(['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Insert']);
// Ett fältbyte med musen kopplas till ett tryck i fältet eller dess etikett högst så här länge före fokus.
const PEKARE_MS = 2000;
// Tab och fokus i ett textfält hör ihop om fokus kommer direkt efter tangenten.
const TAB_MS = 200;

export function nyRakning() {
  return { klick: 0, faltbyten: 0, tangenter: 0, ovrigaKlick: 0, steg: [], pekare: null, tab: null, etikett: null, oppnadLista: null, listaTangent: null };
}

export const uppmatt = (r) => r.klick + r.faltbyten + r.tangenter;

const steg = (r, text) => { r.steg.push(text); if (r.steg.length > 200) r.steg.shift(); };

export function registrera(r, h) {
  const m = h.mal ?? {};
  if (h.typ === 'pointerdown') {
    r.pekare = { tid: h.tid, falt: m.textfalt ? m.id : (m.etikettTillTextfalt ? m.etikettFor : null) };
    // Att öppna en rullgardinslista är ett klick. Att välja i den är nästa klick och räknas när värdet ändras.
    if (m.lista) {
      r.klick++;
      r.oppnadLista = m.id;
      steg(r, `klick: öppna listan ${m.text ?? ''}`.trim());
    }
    return r;
  }
  if (h.typ === 'click') {
    // Klicket på en kontroll som webbläsaren skickar efter ett klick på dess etikett räknas inte en gång till.
    if (r.etikett && r.etikett.for === m.id && h.tid - r.etikett.tid < 100) { r.etikett = null; return r; }
    // detail 0: klicket kom från tangentbordet (Enter eller mellanslag på en knapp, Enter i ett formulär).
    // Tangenten är redan räknad.
    if (!h.detail) return r;
    // Klick i textfält är fältbyten, klick i listor räknas vid pointerdown och change.
    if (m.textfalt || m.lista || m.etikettTillTextfalt) return r;
    if (!m.klickbar) { r.ovrigaKlick++; return r; }
    r.klick++;
    if (m.etikettFor != null) r.etikett = { for: m.etikettFor, tid: h.tid };
    steg(r, `klick: ${m.text ?? ''}`.trim());
    return r;
  }
  if (h.typ === 'focusin') {
    if (!m.textfalt) return r;
    if (r.tab && h.tid - r.tab.tid < TAB_MS) {
      // Tab till ett textfält är ett fältbyte, inte en tangent.
      r.tangenter--;
      r.steg.splice(r.tab.steg, 1);
      r.tab = null;
      r.faltbyten++;
      steg(r, `fältbyte med Tab: ${m.text ?? ''}`.trim());
    } else if (r.pekare && r.pekare.falt === m.id && h.tid - r.pekare.tid < PEKARE_MS) {
      r.pekare = null;
      r.faltbyten++;
      steg(r, `fältbyte: ${m.text ?? ''}`.trim());
    } else {
      steg(r, `har redan fokus: ${m.text ?? ''}`.trim());
    }
    return r;
  }
  if (h.typ === 'keydown') {
    const t = h.tangent ?? '';
    if (!t || MODIFIERARE.has(t)) return r;
    if (h.iTextfalt) {
      if (t.length === 1 || SKRIVTANGENTER.has(t) || (t === 'Enter' && h.iTextruta)) return r;
    } else if (t.length === 1 && t !== ' ') return r;
    r.tangenter++;
    if (h.iLista) r.listaTangent = m.id;
    if (t === 'Tab') r.tab = { tid: h.tid, steg: r.steg.length };
    steg(r, `tangent ${t === ' ' ? 'mellanslag' : t}`);
    return r;
  }
  if (h.typ === 'change') {
    if (!m.lista) return r;
    if (r.listaTangent === m.id) { r.listaTangent = null; r.oppnadLista = null; return r; }
    if (r.oppnadLista === m.id) {
      r.oppnadLista = null;
      r.klick++;
      steg(r, `klick: välj i listan ${m.text ?? ''}`.trim());
    } else {
      // Värdet ändrades utan att listan öppnades med musen eller tangentbordet, till exempel med ett hjälpmedel.
      // Det räknas som en lista som har öppnats och fått ett val, två klick.
      r.klick += 2;
      steg(r, `lista (2 klick): ${m.text ?? ''}`.trim());
    }
    return r;
  }
  return r;
}
