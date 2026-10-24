# Štýl z referenčného reelu (lissayeva, „Tohle jsem natočila jen z jednoho úhlu“)

## Písmo
- **Typ:** úzky, kontrastný didonský serif (módny „magazínový“ vzhľad). U nás nahradený písmom **Playfair Display** (`fonts/`, licencia OFL).
- **Malé písmená**, biela farba, jemný tmavý tieň pre čitateľnosť.
- **Tesné rozostupy medzi písmenami** (záporný tracking, cca −4 px pri 76 px).
- **Kombinácia rezov v jednej vete:** bežné slová rovným rezom, kľúčové slovo **kurzívou** (napr. „tohle video je natočené *z jednoho úhlu*“).
- **Slovo po slove:** titulky naskakujú v rytme reči, často iba jedno slovo naraz.
- **Umiestnenie:** pri postave, približne vo výške hrudníka alebo vedľa tváre, nie v klasickom pásiku dole.
- **Štítok „pill“:** biely zaoblený obdĺžnik s tmavým kurzívnym textom (napr. „*původní video*“, „*úhly*“).
- Pri delenej obrazovke je text na tmavom vínovom pruhu (približne `#2a0a0c`).

## Uhly a strih
- Jeden pôvodný záber a z neho AI vygenerované **ďalšie uhly** tej istej scény: celok miestnosti, polocelok, detail tváre, záber zhora (laptop na kolenách), záber z boku, iné prostredie (výhľad na more).
- **Delená obrazovka** hore a dole: vrchná časť je nový uhol, spodná je „pôvodné video“.
- Časté **strihy na zväčšenie** (punch-in) na tvár pri dôležitých slovách.
- Strih približne každé 2 až 4 sekundy, teplé svetlo, kamera vo výške očí.

## Použité v NOS — Epizóda 1
- Titulok „10 minutes / *earlier*“: najprv rovným rezom „10 minutes“, o 0,6 s kurzívou „earlier“, vľavo dole, s jemným tieňom.
- Vysvetľujúci titulok pri Mary (scéna 4, pred jej replikou): „the scent was wrong / *and only she noticed*“.
- Koncový nápis „NOS“ písmom Playfair Display.
- Generátor titulkov: `tools/titulok.py`.
