# Referències d’interacció

| Referència consultada | Decisió per a aquests reports |
|---|---|
| [Scrollama · russellsamora/scrollama](https://github.com/russellsamora/scrollama) | Una sola lectura vertical amb capítols que responen a la posició de lectura. El quadern Nescafé en pren el patró per mantenir actiu el capítol de navegació. |
| [Observable Plot · interaccions de punter](https://github.com/observablehq/plot/blob/main/docs/interactions/pointer.md) | Al report Continental, enfocar una quinzena mostra el valor exacte. El mateix detall està disponible amb teclat i tacte, i la taula permet contrastar els talls. |
| [Codrops · ScrollBasedLayoutAnimations](https://github.com/codrops/ScrollBasedLayoutAnimations) | Referència de direcció d’art per explorar com una col·lecció d’imatges canvia de disposició mentre es llegeix. Per a les fotografies verticals i horitzontals de Boí s’ha escollit un full de contactes amb visor ampliat i avanç voluntari. |
| [Embla Carousel · davidjerleke/embla-carousel](https://github.com/davidjerleke/embla-carousel) | Alternativa consultada per a galeries tàctils. Amb sis peces la selecció es pot presentar sencera, amb accés directe a cada fotografia i vídeo. |

## Capa de moviment compartida

Les tres pàgines carreguen `comu/`: [GSAP](https://github.com/greensock/GSAP) 3.15.1 amb ScrollTrigger i SplitText, i [Lenis](https://github.com/darkroomengineering/lenis) 1.3.27, inclosos localment amb les seves llicències a `comu/vendor/LICENSES.md`. `comu/motion.js` ofereix revelacions de títols, comptadors, filets que es dibuixen, punter amb inèrcia, botons magnètics, etiqueta contextual del cursor, scrollspy amb indicador lliscant i desplaçament suau. Amb moviment reduït, el contingut es mostra en l’estat final i la navegació continua funcionant. El pla complet és a [PLA_FRONTEND_PREMIUM.md](../02_referencies/PLA_FRONTEND_PREMIUM.md). Les còpies d’una landing s’han de desar dins de `05_landings` perquè la ruta `../comu/` continuï funcionant.

### Moments de signatura

Només s’activen amb moviment i en pantalles de 900 px d’amplada o més. Amb moviment reduït o en una finestra estreta, cada secció es mostra en l’estat final, sense fixar-se.

- **Continental · relleu.** L’escenari queda fixat durant un recorregut de scroll. La càmera passa de la vista amb el nord amunt a l’obliqua mentre les corbes s’escombren de 1.200 a 2.500 m, i les cotes del retall s’il·luminen quan la corba hi arriba. Quan el visitant toca el relleu, el control passa a ell. En passar el ratolí, una sonda indica la cota i la distància al Cap de Comella inferior. La brúixola segueix l’orientació. La roda només fa zoom quan el relleu té el focus del teclat, o amb Ctrl o el gest de pinça. Els botons ← → ↑ ↓ + − permeten girar, inclinar i apropar el relleu sense arrossegar. API: `window.LINE.terreny`.
- **Nescafé · crònica i quadern.** La crònica queda fixada mentre la cita s’omple de vermell paraula per paraula. Una línia d’arxiu introdueix Boí Taüll amb les dates de la galeria. La franja del sorteig s’eixampla fins a ocupar tota l’amplada. El quadern es fixa i avança una peça per cada gest de scroll, amb el comptador i l’indicador vermell. El lightbox conserva el temps del vídeo. El filtre d’estacions s’anima amb View Transitions. API: `window.LINE.quadern`.
- **Portal · sortida.** La targeta clicada s’expandeix fins a omplir la pantalla abans d’obrir l’informe. Els clics amb Cmd o Ctrl i la tecla Retorn naveguen sense animació. Si es torna enrere, el portal es restableix.

### Acabat i comprovacions

- **Continental.** El fons passa del paper al verd fosc del territori i torna al paper seguint l’scroll, amb canvi de tinta al punt d’igual contrast. Activacions mostra un marc fi amb «Material pendent» i l’edició fins que hi hagi fotografies.
- **Editor.** Cada vídeo nou genera una imatge de portada que viatja al ZIP i que el quadern fa servir com a miniatura.
- **Navegació.** Els enllaços directes a una secció (`#activacions`, `#quadern`…) i les recàrregues tornen a la posició correcta encara que hi hagi seccions fixades.
- **Rendiment.** La portada de Continental es serveix en WebP i les miniatures del quadern tenen una versió petita a `nescafe/assets/mostra/miniatures/`. El desplaçament de maquetació en carregar és 0 a Chromium.
- **Prova amb doble clic.** Les tres pàgines i l’editor s’han comprovat obrint els fitxers directament (`file://`) a Chromium i WebKit, el motor de Safari, amb moviment complet i reduït, sense errors de consola. Els `preload` de fonts només s’activen quan les pàgines es serveixen per http.

Els exemples orienten les interaccions. Les landings tenen implementacions locals i s’obren amb doble clic. El ZIP del formulari intern d’edició es genera amb [JSZip](https://github.com/Stuk/jszip), inclòs localment a la carpeta de l’editor.

Les portades s’han creat amb ImageGen per a l’exploració visual. El reportatge de Boí Taüll utilitza material de l’arxiu compartit per en Roger. La signatura de Nescafé prové de la [capçalera del web de Nescafé](https://www.nescafe.com/es/sites/default/files/latest_logo_white.png). El [registre de fonts de Continental](continental/FONTS.md) detalla les dades geogràfiques del visor, el punt de referència d’FGC i el tractament del relleu.
