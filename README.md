# Luštidlo

**Napiš, co vidíš. O zbytek se postará samo.**

Luštidlo je pomůcka pro šifrovací hry, která posouvá myšlenku
[Šifrovacích pomůcek Absolutno v3](https://github.com/vasekp/spa3) o několik
stupňů dál v automatizaci: místo abyste sami určovali, o jakou šifru jde, a
vybírali správnou klávesnici, prostě **opíšete, co máte před sebou** – a
aplikace okamžitě nabídne všechna smysluplná čtení, seřazená podle
věrohodnosti.

## Jak to funguje

1. **Rozpoznání struktury** – vstup se analyzuje podle znaků a tvaru tokenů
   (tečky a čárky? dvojice číslic 1–5? skupiny po pěti bitech? dva libovolné
   symboly?), takže se automaticky vyberou všechny systémy, které připadají
   v úvahu.
2. **Všechny varianty najednou** – každý systém se zkusí ve všech obvyklých
   obměnách: převrácené bity, prohozené tečky/čárky, zrcadlený semafor či
   Braille, A = 0 i A = 1, česká abeceda s CH, řádek–sloupec i
   sloupec–řádek, všech 25 posunů abecedy…
3. **Jazykové hodnocení** – každé čtení se oboduje podle četností písmen,
   častých dvojic a malého slovníku (čeština i angličtina). Nejpravděpodobnější
   čtení vyplave nahoru; nemusíte pročítat nesmysly.
4. **Řetězení kroků** – když výstup pořád vypadá jako kód (třeba morseovka,
   ze které vypadnou číslice), Luštidlo ho samo prožene druhým kolem a ukáže
   celou cestu (`morseovka → čísla → písmena`). Tlačítkem *Luštit dál* lze
   libovolný výsledek poslat zpět na vstup ručně.

## Podporované systémy

| Vstup | Systémy |
| --- | --- |
| `.- .... --- .---` | morseovka (i s prohozenými `·`/`–`, slova přes `/`) |
| `xoxo xxxo …` | morseovka z libovolných dvou symbolů, Baconova šifra |
| `01001 …` / `01001000 …` | binárně: 5 bitů = abeceda, 7/8 bitů = ASCII, i s invertovanými bity |
| `20 1 10 5 14 11 1` | čísla → písmena (A = 1, A = 0, Z = 1, mod 26, česká abeceda s CH, ASCII) |
| `20110514111` | souvislé číslice – chytré rozdělení na 1–26 podle jazyka (dynamické programování) |
| `42 11 24 15 33 25 11` | Polybiův čtverec 5×5 (bez Q / I=J, oba směry) a 6×6 s číslicemi |
| `12 23 34 57` nebo `↙→ ↓↙ ←↑ ↓↙` | semafor – dvojice směrů 1–8 (1 = dolů, po směru ručiček) i zápis šipkami, i zrcadlově |
| `1 125 135 245` nebo `⠁⠓⠕⠚` | Braillovo písmo (čísla teček i unicode znaky), i zrcadlově |
| `2 44 444 55` | mobilní klávesnice – opakované stisky |
| `8253` | mobilní klávesnice – jeden stisk = jedno písmeno, jazykový odhad (Viterbi) |
| `48 65 6c 6c 6f` | šestnáctková soustava → ASCII |
| `QWhvag==` | Base64 |
| `XX I X V` | římské číslice (→ čísla → písmena) |
| `BIPK`, `JOHA` | posunutá abeceda (Caesar, všech 25 posunů), Atbash, čtení pozpátku, abeceda ↔ pořadí na klávesnici |
| `Kůň Umí Běhat Anglicky` | první / poslední / n-tá písmena slov |
| `AZHVOEJTS` | každé n-té písmeno textu, rail fence (cikcak, 2–5 řádků) |
| `Z3L3N4 L0UK4` | leet speak – číslice a symboly jako písmena |
| `39 8 88` | protonová čísla → chemické značky (YORa) |
| `1 12 4 11` | čísla měsíců → počáteční písmena (česky i anglicky) |
| `110 145 154` | osmičkové ASCII |
| `KVRTGYOHH` + klíč `KOD` | Vigenère (odečíst/přičíst), Beaufort |
| text + klíč | sloupcová transpozice podle klíče (oběma směry) |

Pokud vstup už vypadá jako čitelný text, Luštidlo to poznamená, ať neluštíte
zbytečně.

## Spuštění

Žádný build, žádný server, žádné odesílání dat – jen statické soubory:

```
otevřete index.html v prohlížeči
```

(případně `python3 -m http.server` a http://localhost:8000).

## Poděkování

Kódové tabulky (morseovka, Braille, semafor) jsou převzaty a ověřeny podle
aplikace [ŠPA3](https://github.com/vasekp/spa3) © Václav Potoček, MIT licence.
Luštidlo je rovněž pod MIT licencí.
