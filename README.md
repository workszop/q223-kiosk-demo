# Quantica Lab · prezentacja stoiskowa

Zapętlona prezentacja siedmiu symulacji produktów Quantica Lab (Zagłoba, Dyndalski, Gerwazy, Klara, Kmicic, Ocena modeli, Papkin) na ekran stoiska targowego. Bez budowania, bez zależności: statyczne pliki, działa z GitHub Pages i z `file://`.

- `index.html` – cienka powłoka; parametr `?p=N` startuje od produktu N (0–6)
- `kiosk-core.js` – silnik pętli (zegar scenariusza, pauza, tempo, tryb ręczny z powrotem do pętli), widoki produktowe, motyw
- `kiosk-data.js` – dane scenariuszy (teksty 1:1 ze stron produktów)
- `kiosk.css` – tokeny, motyw ciemny/jasny, scena i widoki (jednostki `cqw` = szerokość ekranu)
- `kiosk-icons.js` – ikony Lucide osadzone lokalnie (stoisko bez sieci)
- `robot.js` – voxelowy robot i kot (włączane w ustawieniach)
- `theme.css`, logotypy – współdzielone z quanticalab.ai

Klawisze: `1–3` scenariusz · `spacja` pauza · `←/→` scenariusz · `↑/↓` produkt · `R` od nowa · `S` ustawienia · `F` pełny ekran.

Kopia robocza demo żyje w `q223/mockups/`; ten repozytorium jest wersją publikowaną.
