'use strict';

/* Datové tabulky Luštidla.
 * Kódové tabulky (morseovka, Braille, semafor) převzaty/ověřeny podle
 * ŠPA3 (https://github.com/vasekp/spa3, MIT licence, © Václav Potoček). */

const LDATA = {

  MORSE: {
    '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F',
    '--.': 'G', '....': 'H', '..': 'I', '.---': 'J', '-.-': 'K', '.-..': 'L',
    '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P', '--.-': 'Q', '.-.': 'R',
    '...': 'S', '-': 'T', '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X',
    '-.--': 'Y', '--..': 'Z',
    '-----': '0', '.----': '1', '..---': '2', '...--': '3', '....-': '4',
    '.....': '5', '-....': '6', '--...': '7', '---..': '8', '----.': '9'
  },

  /* Braillovo písmo – klíč = vzestupně seřazená čísla teček (1–6):
   *   1 4
   *   2 5
   *   3 6  */
  BRAILLE: {
    '1': 'A', '12': 'B', '14': 'C', '145': 'D', '15': 'E', '124': 'F',
    '1245': 'G', '125': 'H', '24': 'I', '245': 'J', '13': 'K', '123': 'L',
    '134': 'M', '1345': 'N', '135': 'O', '1234': 'P', '12345': 'Q',
    '1235': 'R', '234': 'S', '2345': 'T', '136': 'U', '1236': 'V',
    '2456': 'W', '1346': 'X', '13456': 'Y', '1356': 'Z'
  },

  /* Semafor – klíč = dvojice poloh paží 0–7 (0 = dolů, dále po směru
   * hodinových ručiček z pohledu čtenáře), vzestupně. */
  SEMAPHORE: {
    '01': 'A', '02': 'B', '03': 'C', '04': 'D', '05': 'E', '06': 'F',
    '07': 'G', '12': 'H', '13': 'I', '46': 'J', '14': 'K', '15': 'L',
    '16': 'M', '17': 'N', '23': 'O', '24': 'P', '25': 'Q', '26': 'R',
    '27': 'S', '34': 'T', '35': 'U', '47': 'V', '56': 'W', '57': 'X',
    '36': 'Y', '67': 'Z'
  },

  /* Mobilní klávesnice */
  KEYPAD: {
    '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL',
    '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ'
  },

  ROMAN: { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 },

  /* Česká abeceda s CH (27 znaků) pro variantu 1–27 */
  CZ_ALPHABET: ['A','B','C','D','E','F','G','H','CH','I','J','K','L','M',
    'N','O','P','Q','R','S','T','U','V','W','X','Y','Z'],

  /* Relativní četnosti písmen (diakritika sloučena k základnímu písmenu), v %. */
  FREQ: {
    cs: { A: 8.9, B: 1.6, C: 3.2, D: 3.6, E: 10.4, F: 0.3, G: 0.3, H: 2.2,
      I: 7.6, J: 2.1, K: 3.7, L: 5.1, M: 3.2, N: 6.5, O: 8.7, P: 3.4,
      Q: 0.05, R: 4.9, S: 5.3, T: 5.8, U: 3.9, V: 4.6, W: 0.08, X: 0.1,
      Y: 3.0, Z: 3.2 },
    en: { A: 8.2, B: 1.5, C: 2.8, D: 4.3, E: 12.7, F: 2.2, G: 2.0, H: 6.1,
      I: 7.0, J: 0.15, K: 0.77, L: 4.0, M: 2.4, N: 6.7, O: 7.5, P: 1.9,
      Q: 0.1, R: 6.0, S: 6.3, T: 9.1, U: 2.8, V: 1.0, W: 2.4, X: 0.15,
      Y: 2.0, Z: 0.1 }
  },

  /* Časté dvojice písmen – bonus při hodnocení. */
  BIGRAMS: {
    cs: 'ST PR PO NI OV NE TE RA LA KO EN NO TO SE LE VA ME DO AL CE LI KA RO VE TA NA JE HO OD VY TI MI OS TR OU AN DE CH NY KY LO VO SL EM ER ES RE ED IT AK NE'.split(' '),
    en: 'TH HE IN ER AN RE ON AT EN ND TI ES OR TE OF ED IS IT AL AR ST TO NT NG SE HA AS OU IO LE VE CO ME DE HI RI RO IC NE EA RA CE LI CH LL BE MA SI OM UR'.split(' ')
  },

  /* Malý slovník častých slov (šifrovací kontext) – bonus při hodnocení. */
  WORDS: {
    cs: ('JE TO SE NA DO OD PRO POD NAD PRES HESLO TAJENKA KOD SIFRA KLIC ' +
      'STANOVISTE CIL START KROKU METRU KROKY METRY SEVER JIH VYCHOD ZAPAD ' +
      'VLEVO VPRAVO ROVNE ZPET DALE DALSI JDI JDETE BEZTE CESTA CESTOU ' +
      'STROM MOST POTOK SKALA KAMEN STUDANKA AHOJ DOBRY DEN ANO NE POKRACUJ ' +
      'HLEDEJ HLEDEJTE NAJDI NAJDETE ZPRAVA ODPOVED').split(' '),
    en: ('THE AND YOU ARE FOR NOT GO NORTH SOUTH EAST WEST LEFT RIGHT ' +
      'STEPS METERS NEXT CLUE CODE PASSWORD KEY HELLO WORLD YES NO FIND ' +
      'FOLLOW CONTINUE ANSWER SECRET MESSAGE').split(' ')
  }
};
