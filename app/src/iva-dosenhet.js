// Runda 11, r7: dosenheterna för kontinuerliga infusioner i intensivvården. Faktorn räknar om dosen per kilo till
// mg per kilo och timme, så att hastigheten i ml/h och sammanräkningen räknas likadant i iva.js, medicinteknik.js och
// r11r7-rutter.js. µg/kg/min gånger 60 minuter delat med 1 000 µg per mg ger mg/kg/h.
export const DOSFAKTOR = Object.freeze({ 'mg/kg/h': 1, 'µg/kg/min': 0.06 });
export const faktor = (dosEnhet) => (Object.hasOwn(DOSFAKTOR, dosEnhet ?? '') ? DOSFAKTOR[dosEnhet] : 1);
