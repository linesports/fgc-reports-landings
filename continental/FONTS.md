# Continental × LINE · materials i dades

La portada és una imatge conceptual generada amb ImageGen per a aquesta exploració. El prompt descrivia una carretera amb una corba de muntanya entre avets i neu, un vehicle discret i llum freda de primera hora, en composició panoràmica per a portada editorial. El JPEG optimitzat és a `assets/portada.jpg`. La fotografia evoca el territori i no documenta una acció ni una ubicació verificades.

El logotip de Continental prové del [fitxer de Continental Tire](https://continentaltire.com/themes/custom/nextcontinental/assets/images/logo-dark.svg). El signe de LINE prové del manual local de restyling, pàgina 7. S’han reutilitzat els dos vectors i la tipografia Lab Grotesque de la [primera maqueta](../../03_maqueta/assets/).

Els valors de gener de 2027 procedeixen del joc de simulació local de La Molina. La lectura interactiva permet enfocar cada quinzena amb el punter, el tacte o el teclat i consultar les quantitats exactes. S’inspira en el patró d’enfocament d’una categoria d’[Observable Plot a GitHub](https://github.com/observablehq/plot/blob/main/docs/interactions/pointer.md). La implementació és pròpia i no necessita descarregar llibreries.

Per actualitzar l’edició, editeu [edicio.js](edicio.js). Cada període conté visites i obertura per quinzena i temporada i els valors d’oferta el dia de tancament. Un `null` numèric es mostra com «Pendent». El camp `activacions` accepta una llista d’entrades amb `data`, `titol`, `comentari` i `fotos`, cadascuna amb `fitxer` local i `descripcio`. La mostra rebuda per a Nescafé pertany al report d’aquella marca.

## Relleu de La Molina

La malla correspon a un quadrat aproximat de 6 × 6 km al voltant de la càmera del Cap de Comella inferior. FGC publica el punt 42.33504 N, 1.936987 E i identifica la càmera a 1.664 m. El punt groc del model correspon a aquestes coordenades. [Webcams dels equipaments turístics d’FGC](https://dadesobertes.fgc.cat/explore/assets/webcams-actives-tim/explore/)

El model es va extreure l’11/11/2026 de Mapzen Terrain Tiles al registre AWS. Les quatre tessel·les Terrarium de nivell 12 són [2069/1514](https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/2069/1514.png), [2070/1514](https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/2070/1514.png), [2069/1515](https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/2069/1515.png) i [2070/1515](https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/2070/1515.png). Les altures es descodifiquen en metres, amb interpolació bilineal, mostreig a intervals d’uns 100 m i arrodoniment al metre. Es guarden 61 × 61 mostres en ordre nord-sud i oest-est. El retall va d’1.900530 E a 1.973444 E i de 42.308085 N a 42.361984 N. Les cotes mínima i màxima són les d’aquesta malla. La vista exagera l’altura 1,7 vegades. [Registre de dades](https://registry.opendata.aws/terrain-tiles/) · [Format Terrarium](https://github.com/tilezen/joerd/blob/master/docs/formats.md)

Europe terrain data produced using Copernicus data and information funded by the European Union — EU-DEM layers. Global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey. Global ETOPO1 terrain data courtesy of U.S. National Oceanic and Atmospheric Administration. Processament local del retall per al report. [Atribució de Mapzen / Tilezen](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)
