# Changelog

Tutte le modifiche rilevanti del progetto sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/),
e il versioning [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

## [1.28.0] - 2026-07-20

### Added
- Build desktop con electron-builder: installer NSIS e versione portable Windows (`npm run build`)

## [1.27.0] - 2026-07-20

### Changed
- Dati locali in cartella `factory-manager` (AppData) e database rinominato in `factory-manager.db`, con migrazione automatica dal percorso precedente

## [1.26.5] - 2026-07-19

### Changed
- Albero: maggiore spaziatura tra etichette sui collegamenti paralleli tra gli stessi nodi

## [1.26.4] - 2026-07-19

### Fixed
- Albero (anche gruppi): etichette e curve dei collegamenti tra gli stessi nodi non si sovrappongono più

## [1.26.3] - 2026-07-19

### Removed
- Barra menu nativa (File, Edit, View, ecc.) nascosta all’avvio

## [1.26.2] - 2026-07-19

### Changed
- Logo FACTORY MANAGER aggiornato (dashboard e header)

## [1.26.1] - 2026-07-19

### Changed
- Import schema (produzione ed energia): al nome viene aggiunto « (import)»

## [1.26.0] - 2026-07-19

### Added
- Produzione: pulsante «Importa schema» accanto a «Nuovo schema» — carica uno schema da file JSON
- Energia: export e import schema in JSON (estrazioni, generatori e collegamenti interni), con pulsanti sulla card e in intestazione

## [1.25.2] - 2026-07-19

### Changed
- Popup Info: larghezza raddoppiata per una lettura più comoda del testo legale

## [1.25.1] - 2026-07-19

### Changed
- Footer più compatto: versione e disclaimer sulla stessa riga, senza paragrafi impilati

## [1.25.0] - 2026-07-19

### Added
- Footer: disclaimer breve (fan-made indipendente, non ufficiale, attribuzione Coffee Stain) accanto alla versione

## [1.24.0] - 2026-07-19

### Added
- Pulsante Info nella barra in alto: apre il popup con informazioni legali, attribuzioni e limitazione di responsabilità

## [1.23.0] - 2026-07-19

### Changed
- Nome prodotto rinominato in FACTORY MANAGER (titolo finestra, footer, dashboard, logo e documentazione)

## [1.22.0] - 2026-07-19

### Added
- Produzione: pulsante Esporta schema sulla card — salva uno schema completo in file JSON (estrazioni, schemi risorsa, collegamenti e gruppi)

## [1.21.1] - 2026-07-19

### Fixed
- Produzione: drag&drop dei box nell’albero (anche gruppi) non salta più in basso quando l’area è scrollata

## [1.21.0] - 2026-07-19

### Added
- Produzione: «Visualizzazione ad albero Gruppi» nel dettaglio — disponibile solo se ci sono raggruppamenti; mostra ogni gruppo come nodo con soli input/output principali (senza lavorazioni interne)

## [1.20.0] - 2026-07-19

### Added
- Produzione: pulsante Duplica sulla card dello schema — crea una copia completa (schemi risorsa, estrazioni, collegamenti e raggruppamenti) con nome «… (copia)»

## [1.19.10] - 2026-07-07

### Fixed
- Produzione: stato comprimi/espandi di schemi e raggruppamenti salvato su file in AppData e ripristinato dopo chiusura e riapertura dell’app

## [1.19.9] - 2026-07-07

### Fixed
- Produzione: stato comprimi/espandi dei singoli schemi risorsa memorizzato correttamente e ripristinato dopo la vista ad albero

## [1.19.8] - 2026-07-06

### Fixed
- Produzione: pulsante freccia comprimi/espandi schema sempre neutro (non più arancione quando compresso)

## [1.19.7] - 2026-07-06

### Fixed
- Collegamento estrazione→schema: puoi collegare nodi con output parziale (es. due carbone da 600/min per coprire 1.200/min), come già tra schemi risorsa

## [1.19.6] - 2026-07-05

### Changed
- Dashboard: descrizione estesa di cosa fa FACTORY MANAGER (catalogo, produzione, energia e panoramica progetti)

## [1.19.5] - 2026-07-05

### Fixed
- Logo «FACTORY MANAGER»: sfondo trasparente al posto del rettangolo nero visibile sulla dashboard e nell’header

## [1.19.4] - 2026-07-05

### Fixed
- Pulsante evidenzia schema/raggruppamento: quando attivo mantiene lo stile scuro standard, cambia solo l’icona in X

## [1.19.3] - 2026-07-05

### Changed
- Evidenzia schema e raggruppamento: icona check quando non attivo, X quando attivo; l’icona attiva non è più verde

## [1.19.2] - 2026-07-05

### Fixed
- Evidenzia schema e raggruppamento: verde unificato su card, gruppo, checkbox attive, input/output collegati e testi di stato

## [1.19.1] - 2026-07-05

### Added
- Visualizzazione ad albero: checkbox evidenzia schema in alto a destra su ogni nodo schema, sincronizzato con l’editor

## [1.19.0] - 2026-07-05

### Added
- Checkbox «Evidenzia raggruppamento» accanto alla matita di rinomina: sfondo verde sul gruppo, tutti gli schemi interni evidenziati e stato salvato nel database

## [1.18.0] - 2026-07-05

### Added
- Sezione energia: sotto ogni generatore, nel pannello edificio, compaiono gli input per macchina (combustibile e acqua) con rate attuale e base, come in produzione

## [1.17.0] - 2026-07-05

### Added
- Dashboard KPI: produzione energia totale (MW), generatori separati dalle macchine, conteggio deficit attivi

### Changed
- KPI «Macchine» conta solo gli step di produzione, non i generatori

## [1.16.2] - 2026-07-05

### Changed
- Grafico «Mix generatori»: icone Font Awesome per tipo (fuoco carbone, radiazione nucleare, fulmine carburante), senza sfondo

## [1.16.1] - 2026-07-05

### Fixed
- Unità MW sempre separata dal valore con uno spazio (es. `200.000 MW` invece di `200.000MW`)

## [1.16.0] - 2026-07-05

### Changed
- Numeri in tutta l’app formattati con punto come separatore delle migliaia (es. 200.000 MW, 19.200 m³/min, 5.000 MW)

## [1.15.1] - 2026-07-05

### Fixed
- Grafico «Mix generatori»: icona ⚡ al posto del placeholder vuoto, senza sfondo

## [1.15.0] - 2026-07-05

### Added
- Dashboard: grafici a barre per top 5 deficit risorse, obiettivi di produzione per catena e mix MW generatori (carbone, carburante, nucleare)

## [1.14.0] - 2026-07-05

### Added
- Dashboard operativa: KPI su catene, macchine, nodi e power shard; elenco progetti recenti con stato salute; pannello avvisi per deficit risorse

### Changed
- Stato ambiente e statistiche catalogo spostati da Dashboard a Impostazioni

## [1.13.3] - 2026-07-05

### Changed
- Pulsante evidenzia schema: icona check; il colore dell’icona resta invariato quando attivo (solo lo sfondo del contenitore diventa verde)

## [1.13.2] - 2026-07-05

### Changed
- Checkbox evidenzia schema spostato in alto nell’header: icona check senza etichetta, stesso stile dei pulsanti comprimi/reimposta/elimina

## [1.13.1] - 2026-07-05

### Changed
- Nella visualizzazione ad albero (globale o per raggruppamento) gli schema evidenziati hanno sfondo verde come in lista

## [1.13.0] - 2026-07-05

### Added
- Checkbox «Evidenzia schema» su ogni schema risorsa: sfondo verde e stato salvato nel database

## [1.12.2] - 2026-07-05

### Fixed
- Select gruppo nello schema: si chiude cliccando fuori dal menu a tendina
- Pulsanti comprimi/reimposta/elimina allineati in altezza con la select del raggruppamento

## [1.12.1] - 2026-07-05

### Fixed
- In visualizzazione ad albero i pulsanti «Aggiungi estrazione» e «Aggiungi schema risorsa» restano nascosti (prima `.btn` annullava l’attributo `hidden`)

## [1.12.0] - 2026-07-05

### Added
- Riordino raggruppamenti trascinando l’icona a sinistra nell’header: disponibile solo quando tutti i raggruppamenti sono compressi (con suggerimento visibile finché uno resta aperto)

## [1.11.0] - 2026-07-05

### Added
- Rinomina raggruppamento: icona matita nell’header del gruppo; aggiorna tutti gli schemi del raggruppamento e mantiene stato compresso e layout dell’albero

## [1.10.0] - 2026-07-05

### Added
- Stato comprimi/espandi di raggruppamenti e schemi risorsa memorizzato per progetto: al riavvio dell’app restano come li avevi lasciati

## [1.9.2] - 2026-07-05

### Changed
- In visualizzazione ad albero (intera catena o singolo raggruppamento) i pulsanti «Aggiungi estrazione» e «Aggiungi schema risorsa» sono nascosti; resta solo «Torna all'editor»

## [1.9.1] - 2026-07-05

### Changed
- Pulsante «Visualizzazione ad albero» nel raggruppamento: stesso font, padding e bordi arrotondati del pulsante principale

## [1.9.0] - 2026-07-05

### Added
- Pulsante «Visualizzazione ad albero» nell’header di ogni raggruppamento: mostra il grafico solo degli schemi di quel gruppo (con estrazioni e obiettivi collegati)

## [1.8.3] - 2026-07-05

### Changed
- Output delle estrazioni risorse: inserimento manuale con virgola decimale (es. 120,5/min) per minerali, liquidi e acqua

## [1.8.2] - 2026-07-05

### Changed
- Select gruppo negli header degli schemi di produzione occupa lo spazio orizzontale disponibile accanto al titolo

## [1.8.1] - 2026-07-05

### Changed
- Estrazioni collegate a più schemi: stato rosso «Mancano X/min per gli schemi collegati» quando il fabbisogno totale supera l'output; badge con quota parziale (es. 160/480/min)
- Collegamento estrazione→schema proposto solo se i minuti liberi coprono interamente il fabbisogno dello schema

### Fixed
- «Usato completamente» sull'estrazione non compare più quando gli schemi collegati richiedono più risorsa di quanta ne produce il nodo

## [1.8.0] - 2026-07-05

### Added
- Estrazioni risorse: sezione sinistra divisa in gruppi **Minerali** e **Liquidi** (greggio, acqua)

## [1.7.4] - 2026-07-05

### Fixed
- Input negli schemi risorsa: «Eccedenza collegata» e badge estrazione/schema usano la quota effettivamente allocata al consumatore, non l'output totale del produttore (allineato al calcolo delle estrazioni a sinistra)

## [1.7.3] - 2026-07-05

### Fixed
- Estrazioni a sinistra: colore ed etichetta eccedenza si aggiornano subito quando modifichi output, overclock o nodi (non serve più interagire con gli schemi a destra)

## [1.7.2] - 2026-07-05

### Changed
- Input negli schemi risorsa: verde e «Coperto completamente» solo con collegamenti espliciti a schema o estrazione; rimosso «Coperto dalla catena» e la copertura automatica dal bilancio globale

## [1.7.1] - 2026-07-05

### Changed
- Estrazioni a sinistra: bordo giallo ed etichetta «Eccedenza» anche quando l'output supera quanto collegato agli schemi, incluso se non c'è ancora nessun collegamento esplicito

## [1.7.0] - 2026-07-05

### Added
- Estrazioni a sinistra: bordo verde/giallo/rosso quando collegate agli schemi (bilanciato, eccedenza, insufficiente), badge verso i consumatori e sezione «Collega a schema» con quota disponibile
- Una estrazione può alimentare più schemi: negli elenco compaiono solo schemi compatibili o con capacità libera, come tra schemi risorsa

## [1.6.1] - 2026-07-05

### Fixed
- Collegamento manuale da estrazione: corretta migrazione del database locale che bloccava il salvataggio con errore «NOT NULL constraint failed» su `producer_step_id`

## [1.6.0] - 2026-07-05

### Added
- Input minerali/liquidi negli schemi risorsa: sezione «Collega da estrazione» con checkbox, come «Collega da schema»; senza collegamenti manuali resta attivo il bilancio automatico della catena

## [1.5.4] - 2026-07-05

### Changed
- Nuovo schema risorsa da input: se lo schema di partenza appartiene a un gruppo, anche il nuovo schema viene aggiunto allo stesso gruppo

## [1.5.3] - 2026-07-05

### Changed
- Raggruppamenti schema risorsa: il nome del gruppo è sempre mostrato in maiuscolo, anche se digitato in minuscolo

## [1.5.2] - 2026-07-05

### Fixed
- Nuovo raggruppamento schema risorsa: «+ Nuovo gruppo…» apre il modale di inserimento nome (in Electron `prompt` non è disponibile)

## [1.5.1] - 2026-07-05

### Fixed
- Input e output negli schemi risorsa: spaziatura uniforme tra le righe risorsa, indipendentemente da collegamenti o sezione «Collega da schema»

## [1.5.0] - 2026-07-05

### Added
- Schemi risorsa: raggruppamenti visivi con menu a tendina accanto al nome; ogni gruppo si può espandere o comprimere; il trascinamento riordina gli schemi solo all'interno dello stesso gruppo

## [1.4.3] - 2026-07-05

### Fixed
- Collegamento schemi risorsa: gli schemi già collegati altrove ma con eccedenza (es. 12/min liberi su un tubo da 300/min) compaiono di nuovo nelle opzioni «Collega da schema»; la quota disponibile è indicata nel rate

## [1.4.2] - 2026-07-05

### Fixed
- Collegamento schemi risorsa: nella lista «Collega da schema» compaiono solo produttori non ancora collegati a quell’input, oppure già collegati lì o con eccedenza disponibile; schemi già usati al 100% da altri collegamenti non sono più selezionabili

## [1.4.1] - 2026-07-05

### Fixed
- Comprimi schema risorsa: un solo click nasconde subito tutto (slider, input/output e pannello macchina), senza lo stato intermedio con la macchina ancora visibile a destra

## [1.4.0] - 2026-07-05

### Added
- Schema produzione risorse: pulsante freccia nell’header per comprimere (solo pannello macchina), collassare (solo titolo) o tornare alla vista completa; lo stato resta memorizzato finché non esci dallo schema

## [1.3.3] - 2026-07-05

### Fixed
- Schema produzione risorse: input e output non mostrano più valori spurii (es. 288,015/min invece di 288/min) quando overclock e macchine producono un totale esatto — il rumore floating-point non viene più arrotondato per eccesso

## [1.3.2] - 2026-07-05

### Changed
- Produzione: aggiungendo uno schema risorsa da un input, il nuovo step compare subito sotto quello corrente; con «Aggiungi schema risorsa» resta in fondo all'elenco

## [1.3.1] - 2026-07-05

### Fixed
- Pannello macchina: icone risorse visibili negli input per singola macchina

### Changed
- Pannello macchina: etichette base semplificate (es. «Base: 20/min») senza «per macchina @ 100%»

## [1.3.0] - 2026-07-05

### Added
- Schema produzione risorse: nel pannello macchina a destra compaiono gli input per singola macchina (valore attuale con overclock e base @ 100%), con icona risorsa

## [1.2.5] - 2026-07-05

### Fixed
- Reset schema risorsa: ricette con base frazionaria (es. silice 37,5/min) non arrotondano più l'output a intero (38) con overclock ricalcolato al 101,334%; reset torna a base @ 100%

## [1.2.4] - 2026-07-05

### Fixed
- Underclock (overclock sotto il 100%): l'output minimo era calcolato alla base @ 100%, quindi valori come 25% venivano ignorati e la produzione restava invariata; ora il minimo è alla base @ 1% (come nel gioco) in schema produzione risorse ed estrazioni

## [1.2.3] - 2026-07-05

### Fixed
- Schema produzione risorse: ricette lente (es. barra di uranio 0,4/min, plutonio 0,25/min) partono ora dalla base @ 100% invece di essere forzate a 1/min con overclock al 250%; slider e campo output accettano decimali quando il massimo è sotto 1/min

## [1.2.2] - 2026-07-05

### Changed
- Estrazioni risorse: campi Output, Overclock e Nodi più stretti (−25%); riepilogo macchina (parte destra) leggermente più largo

## [1.2.1] - 2026-07-05

### Added
- Centrale nucleare: output scorie in base al combustibile (scorie di plutonio 1/min, scorie di uranio 10/min; nessuna scoria con barra di ficsonio), visibile nel box Output e nel riepilogo

## [1.2.0] - 2026-07-05

### Added
- Schema energia: centrale nucleare (2500 MW al 100%, overclock, 3 barre combustibile — plutonio, uranio, ficsonio — e acqua 240 m³/min)

## [1.1.2] - 2026-07-05

### Changed
- Energia, slider «Generatori»: massimo portato a 600 (prima 100)

## [1.1.1] - 2026-07-05

### Fixed
- Logo «M» industriale solo come icona finestra/taskbar; nell'app resta il logo «FACTORY MANAGER» (dashboard e header compatto)

## [1.1.0] - 2026-07-05

### Added
- Schema energia: generatore a carburante (250 MW al 100%, overclock, 5 combustibili liquidi — carburante ionizzato, carburante per razzi, turbocarburante, biocarburante liquido, carburante — senza input acqua)

## [1.0.1] - 2026-07-05

### Changed
- Pulsante «Aggiungi schema energia»: icona `industry` al posto di `braille`

## [1.0.0] - 2026-07-05

### Changed
- Pulsanti produzione ed energia con icone Font Awesome: albero (`code-fork`), editor (`align-right`), estrazione (`hammer`), schema (`braille`)
- Nuova icona applicazione (logo «M» industriale) in barra titolo, header e barra delle applicazioni Windows

## [0.3.100] - 2026-07-05

### Fixed
- Energia, riepilogo in alto: la potenza MW compare nella colonna «Prodotta» (non più allineata a «Mancante»); riga verde quando anche gli input sono coperti

## [0.3.99] - 2026-07-05

### Changed
- Rate fluidi senza spazio prima dell'unità: `1200m³/min` (come `1200/min` per i solidi)

## [0.3.98] - 2026-07-05

### Fixed
- Formato rate uniforme ovunque: `1200/min` (niente spazio prima della barra); i fluidi restano `1200 m³/min`

## [0.3.97] - 2026-07-05

### Changed
- Energia, collegamenti da produzione: mostrato solo il nome dello schema (es. «Fabbrica») con la quantità, senza il nome dello schema risorsa

## [0.3.96] - 2026-07-05

### Added
- Energia: su ogni input del generatore (combustibile, acqua) puoi collegare gli obiettivi di produzione con checkbox, come tra schemi risorsa in Produzione
- Il riepilogo energia include nel «Prodotta» anche le risorse collegate dagli schemi di produzione

## [0.3.95] - 2026-07-05

### Added
- Pulsante matita sulle card Produzione ed Energia per rinominare uno schema

### Removed
- Campo stack dalle risorse: rimosso da elenco, modifica, dettaglio e database

## [0.3.94] - 2026-07-04

### Changed
- Energia, tabella riepilogo in alto: mostra tutti gli input richiesti (carbone, carbone compatto, coke, acqua…) con colonne Richiesta, Prodotta e Mancante, come in Pianificazione risorse

## [0.3.93] - 2026-07-04

### Changed
- Energia: acqua e carbone si collegano automaticamente alle estrazioni (come in Pianificazione risorse), senza checkbox manuali

## [0.3.92] - 2026-07-04

### Fixed
- Energia, estrazioni (acqua/carbone): slider output, overclock ed estrattori/nodi funzionano di nuovo come in Pianificazione risorse
- Energia: modificando un'estrazione si aggiornano subito bilancio acqua/carbone e input dei generatori collegati

## [0.3.91] - 2026-07-04

### Fixed
- Campo Macchine negli schemi risorsa: frecce ↑↓ della tastiera incrementano/decrementano di ±1 come Output e Overclock; il massimo si adatta quando superi il limite dello slider

## [0.3.90] - 2026-07-04

### Changed
- Estrattore d'acqua: campo Output accetta digitazione manuale con virgola decimale (es. 120,5 m³/min) in Pianificazione risorse e Energia

## [0.3.89] - 2026-07-04

### Fixed
- Energia, estrattori d'acqua/carbone: stessa logica di Pianificazione risorse — cambiando estrattori, output o overclock i valori restano coerenti (niente reset overclock al 100%)
- Aggiornamento parziale estrazioni: overclock e output esistenti non vengono più sovrascritti quando si modifica un solo campo

## [0.3.88] - 2026-07-04

### Changed
- Estrattori d'acqua: numero massimo di estrattori portato da 25 a 500 (Pianificazione risorse e sezione Energia)

## [0.3.87] - 2026-07-04

### Changed
- Generatori energia: logica allineata a Produzione — più generatori scalano il combustibile totale mantenendo l'overclock; il combustibile regola solo l'overclock; massimo = default × generatori @ 250%

## [0.3.86] - 2026-07-04

### Fixed
- Generatori energia: carbone compatto @ 100% usa il valore esatto **7,142857**/min (non arrotondato a 7,144)

## [0.3.85] - 2026-07-04

### Fixed
- Generatori energia: cambiando tipo combustibile (es. carbone compatto → carbone) il calcolo riparte dal default @ 100% del nuovo combustibile

## [0.3.84] - 2026-07-04

### Fixed
- Generatori energia: il campo combustibile mostra i decimali completi al ripristino predefinito (es. carbone compatto 7,144/min)

## [0.3.83] - 2026-07-04

### Fixed
- Generatori energia: digitando combustibile, overclock o numero generatori si aggiornano subito potenza, input/output, bilanciamento e riepilogo (come con lo slider)

## [0.3.82] - 2026-07-04

### Changed
- Elenco Produzione: tabelle riepilogo allineate a destra nella card; titolo resta a sinistra su una riga

## [0.3.81] - 2026-07-04

### Fixed
- Schemi risorsa: frecce e spinner del campo Output avanzano di ±1 e mantengono valori interi (niente più passi da 0,001 dopo il ricalcolo overclock)

## [0.3.80] - 2026-07-04

### Fixed
- Energia: i campi numerici (output, combustibile, overclock, macchine) si possono digitare come in Produzione
- Pannello edificio a destra: immagine del generatore non più tagliata in altezza

## [0.3.79] - 2026-07-04

### Changed
- Select tipo combustibile (Energia): etichette senza valori tra parentesi

## [0.3.78] - 2026-07-04

### Fixed
- Avvio app: risolto errore che bloccava l'interfaccia (`LINK_BALANCE_TOLERANCE` non inizializzato)

## [0.3.77] - 2026-07-04

### Changed
- Generatori energia: imposti il combustibile in input (/min) e la potenza MW viene calcolata automaticamente
- Input acqua/carbone con collegamento alle estrazioni e indicatore verde quando la catena è coperta (come in Produzione)
- Layout sezione Energia allineato a Produzione; icona ⚡ sull'output elettricità

## [0.3.76] - 2026-07-04

### Changed
- Sezione Energia: layout allineato a Produzione (picker, estrazioni, generatori con schema craft, slider e riepilogo)

## [0.3.75] - 2026-07-04

### Removed
- Dashboard: rimossa la card «Pianificatore produzione» (non ancora disponibile)

## [0.3.74] - 2026-07-04

### Fixed
- Energia: il pulsante «Nuovo schema» apre di nuovo il modale di creazione

## [0.3.73] - 2026-07-04

### Fixed
- Avvio app: le tabelle energia vengono create automaticamente al primo avvio dopo l'aggiornamento

## [0.3.72] - 2026-07-04

### Added
- Nuova sezione **Energia**: crea schemi con estrazioni (acqua e carbone) e generatori
- Generatore a carbone: 75 MW al 100%, overclock, combustibile (carbone, carbone compatto, coke petrolifero) e consumo acqua (45 m³/min)

## [0.3.71] - 2026-07-04

### Fixed
- Elenco Produzione: il titolo dello schema resta su una riga e le tabelle riepilogo partono subito dopo, senza spazio vuoto al centro

## [0.3.70] - 2026-07-04

### Fixed
- Elenco Produzione: tabelle riepilogo corrette già al primo accesso (prima serviva aprire il dettaglio per allineare i dati)

## [0.3.69] - 2026-07-04

### Added
- Elenco Produzione: ogni schema mostra le tabelle riepilogo (Obiettivi, Nodi, Risorse) come nel dettaglio

## [0.3.68] - 2026-07-04

### Changed
- Visualizzazione ad albero: box più larghi per testi completi; etichette sulle linee con icona e nome materiale, centrate sul collegamento

## [0.3.67] - 2026-07-04

### Changed
- Visualizzazione ad albero: diagramma adattato alla larghezza pagina (niente scorrimento orizzontale), etichette sulle linee solo con icona materiale, box schemi con valori input e output

## [0.3.66] - 2026-07-04

### Changed
- Visualizzazione ad albero: layout libero con più spazio tra i box, niente etichette di colonna, drag & drop su ogni nodo e posizioni salvate per progetto

## [0.3.65] - 2026-07-04

### Added
- Pulsante verde «Visualizzazione ad albero» nel dettaglio produzione: diagramma sinistra→destra con estrazioni, schemi, obiettivi e collegamenti con icone materiali e macchine

## [0.3.64] - 2026-07-04

### Changed
- Box Input/Output: testi di stato collegamenti («Coperto completamente», «Usato completamente», ecc.) sempre allineati a destra

## [0.3.63] - 2026-07-04

### Changed
- Slider produzione/estrazione: si disattivano anche quando il mouse esce dal campo (non solo con Tab o clic altrove)

## [0.3.62] - 2026-07-04

### Changed
- Slider di produzione ed estrazione: disattivati finché non ci clicchi; la rotella del mouse li modifica solo quando hanno il focus (come gli input numerici)

## [0.3.61] - 2026-07-04

### Fixed
- Collegamenti parziali + estrazione: se il bilancio globale è coperto (es. 600 da schema + 4800 da estrazione), input e output mostrano verde invece di «Esterno»/«Insufficiente» azzurri
- Output schema linkato: la domanda attribuita al produttore è al massimo la sua produzione, non l'intero fabbisogno del consumatore

## [0.3.60] - 2026-07-04

### Changed
- Box Input/Output negli schemi risorsa: interlinea ridotta tra risorse, collegamenti e sotto-testi

## [0.3.59] - 2026-07-04

### Fixed
- Slider output nelle estrazioni risorse: ogni step imposta un valore intero esatto (67, 68, …) senza decimali derivati dal ricalcolo overclock (niente più 67,001)

## [0.3.58] - 2026-07-04

### Fixed
- Pannello edificio negli schemi risorsa: il totale di produzione resta in alto; icona macchina e dettagli restano centrati sotto

## [0.3.57] - 2026-07-04

### Fixed
- Aggiornando le estrazioni risorse, gli input degli schemi (es. «Mancante in catena» sul minerale di ferro) si aggiornano subito in base al nuovo bilancio
- Slider e frecce di output e overclock nelle estrazioni risorse avanzano sempre di ±1 (niente passi decimali)

## [0.3.56] - 2026-07-04

### Changed
- Valori calcolati a tre decimali (output, overclock, rate): arrotondamento per eccesso (es. 83,333… → 83,334)

## [0.3.55] - 2026-07-04

### Changed
- Pannello edificio (macchine ed estrattori): contenuto sempre allineato in alto, non più centrato verticalmente

## [0.3.54] - 2026-07-04

### Changed
- Deficit e mancanze in catena: box e testo azzurri invece che rossi, più distinguibili dal verde (copertura ok)

## [0.3.53] - 2026-07-04

### Added
- Pannello edificio negli step produzione: totale output sopra l'icona della macchina, stesso stile del titolo schema

## [0.3.52] - 2026-07-04

### Fixed
- Estrattori/miniere: frecce, spinner e rotellina sui campi numerici avanzano di una sola unità (±1), come negli step produzione; overclock usa step interi via slider

## [0.3.51] - 2026-07-04

### Added
- Estrattori e miniere: campo Output con slider, collegato a overclock e nodi come per le macchine di produzione

## [0.3.50] - 2026-07-04

### Changed
- Campi numerici produzione/estrazione (output, overclock, macchine, nodi): readonly finché non ci clicchi; si disattivano uscendo dal campo

## [0.3.49] - 2026-07-04

### Changed
- Mancanza in catena e deficit collegamenti: box e testo in rosso acceso; l'eccedenza resta gialla

## [0.3.48] - 2026-07-04

### Fixed
- Collegamenti tra schemi: eccedenze e deficit inferiori a 0,05/min (o allo 0,1% del flusso) non vengono più mostrati — evita falsi «Eccedenza: 0,01/min» da arrotondamenti con overclock decimale

## [0.3.47] - 2026-07-04

### Changed
- Riepilogo in alto a destra: tabelle Obiettivi, Nodi e Risorse affiancate orizzontalmente (pulsanti invariati)
- Estrazioni risorse: sotto l'edificio, output per singolo nodo/estrattore in grassetto, moltiplicatore e overclock, poi output totale sotto

## [0.3.46] - 2026-07-04

### Changed
- Nuovi schemi risorsa aggiunti sempre in fondo alla lista, indipendentemente dal metodo usato (pulsante, click su input, ecc.)

## [0.3.45] - 2026-07-04

### Added
- Click su un input negli schemi risorsa: apre l'aggiunta schema per quella risorsa (1 schema → aggiunta automatica, più schemi → scelta nel popup)

### Changed
- Selezione risorsa da «Aggiungi schema risorsa»: popup schema anche con più schemi principali, non solo con alternative

## [0.3.44] - 2026-07-04

### Fixed
- Campo Macchine (e altri numerici): digitazione e frecce tornano a funzionare; lo spinner ±1 interviene solo sui click delle freccette interne, la digitazione si conferma uscendo dal campo o con Invio

## [0.3.43] - 2026-07-04

### Changed
- Frecce (tastiera e spinner) nei campi numerici produzione/estrazione: incremento sempre di ±1 su valori interi, come gli slider

## [0.3.42] - 2026-07-04

### Added
- Tabella «Obiettivi» nel dettaglio produzione: elenca gli output degli schemi risorsa senza collegamento verso altri schemi, con quantità e schema di origine

## [0.3.41] - 2026-07-04

### Changed
- Slider overclock: passi sempre di 1 (valori interi); il campo numerico overclock resta con decimali quando calcolato dall'output
- Output totale con fino a 3 decimali quando l'overclock non è un numero intero (es. 63,333% → 19 /min)

## [0.3.40] - 2026-07-04

### Changed
- Output per macchina spostato nel pannello edificio (riga arancione): es. **19 /min** 1× @ 63,333%; rimosso il campo separato sotto overclock/macchine

## [0.3.39] - 2026-07-04

### Added
- Campo in sola lettura «Output / macchina» accanto a overclock e macchine nello step di produzione

### Changed
- Overclock, macchine e output non sono più collegati da un toggle: modificando l'output si ricalcola l'overclock (fino a 3 decimali) senza cambiare le macchine; modificando le macchine si aggiorna solo l'output totale
- Massimo output (campo e slider): valore base × macchine × 250% overclock, con moltiplicatore Somersloop se attivo

### Removed
- Icona e modalità collegamento overclock/macchine

## [0.3.38] - 2026-07-04

### Fixed
- Icona collegamento overclock/macchine centrata orizzontalmente e verticalmente tra i due campi numerici

## [0.3.37] - 2026-07-04

### Changed
- Toggle collegamento overclock/macchine: icone Font Awesome `fa-link` e `fa-link-slash`, centrate tra i campi di testo

## [0.3.36] - 2026-07-04

### Changed
- Header schema produzione: pulsanti «Aggiungi estrazione» e «Aggiungi schema risorsa» spostati in basso a sinistra; tabelle riepilogo risorse allineate in alto a destra per recuperare spazio verticale

## [0.3.35] - 2026-07-04

### Changed
- Estrazioni risorse: overclock, nodi/estrattori, purezza e frammento energetico allineati su un'unica riga

## [0.3.34] - 2026-07-04

### Changed
- Titoli sezione produzione uniformati: **ESTRAZIONI RISORSE** e **SCHEMI RISORSE** con stesso font, colore e dimensione

## [0.3.33] - 2026-07-04

### Changed
- Dettaglio schema produzione: estrazioni a sinistra e schemi risorsa a destra in layout a due colonne

## [0.3.32] - 2026-07-04

### Changed
- All'avvio l'applicazione si apre massimizzata a tutto schermo (finestra non più ridimensionata)

## [0.3.31] - 2026-07-04

### Changed
- Layout principale: larghezza massima del contenuto raddoppiata (1200px → 2400px)

## [0.3.30] - 2026-07-04

### Changed
- Tabella risorse: colonna **Mancante** valorizzata solo se Richiesta > Prodotta

## [0.3.29] - 2026-07-04

### Changed
- Tabella nodi: purezza con iniziale maiuscola (**Impuro**, **Normale**, **Puro**)

## [0.3.28] - 2026-07-04

### Changed
- Tabella riepilogo risorse: colonne **Richiesta**, **Prodotta** e **Mancante** (al posto di una sola quantità)

## [0.3.27] - 2026-07-04

### Changed
- Tabella riepilogo risorse: visibile anche per **Greggio** e **Acqua** richiesti, non solo minerali

## [0.3.26] - 2026-07-04

### Fixed
- Dettaglio risorsa: card schema non più compresse nel modal (input/output e icone edificio visibili per intero)
- Card schema con padding inferiore corretto sulle liste input/output

## [0.3.25] - 2026-07-04

### Fixed
- Dettaglio risorsa e schemi produzione: input/output non più tagliati in basso; padding interno corretto nelle card schema

## [0.3.24] - 2026-07-04

### Changed
- Tabella minerali nascosta se non ci sono minerali richiesti (niente messaggio vuoto)

## [0.3.23] - 2026-07-04

### Changed
- Tabelle **Nodi** e **Minerali** affiancate nel riepilogo in alto, non impilate

## [0.3.22] - 2026-07-04

### Changed
- Somersloop: aumenta solo l'output; gli input restano alla stessa quantità (macchine × overclock)
- Nuovo schema risorsa inserito in cima alla lista, non in fondo

## [0.3.21] - 2026-07-04

### Added
- Tabella **Nodi** sopra i minerali nel riepilogo: elenca minerale + purezza e numero nodi totali dalle estrazioni configurate

## [0.3.20] - 2026-07-04

### Fixed
- Tabella minerali in alto: separatori tra righe uniformi e continui (niente linee spezzate o mancanti con righe verdi/gialle)

## [0.3.19] - 2026-07-04

### Fixed
- Estrazioni minerali: frecce +/- su Overclock incrementano/decrementano di 1 (come Macchine negli schemi risorsa)

## [0.3.18] - 2026-07-04

### Fixed
- Select Trivella/Purezza: selezione voce ora salva correttamente (attributo `data-extraction-id` e aggiornamento etichetta)

## [0.3.17] - 2026-07-04

### Fixed
- Menu Trivella e Purezza nodo: apertura/selezione funzionante (conflitto click globale e menu tagliato dalla griglia)

## [0.3.16] - 2026-07-04

### Added
- Estrazioni minerali: pulsante **+** su ogni riga per aggiungere un'altra estrazione dello stesso minerale; titoli numerati (es. Calcare #2) se ce n'è più di una

## [0.3.15] - 2026-07-04

### Changed
- Tabella minerali in alto: verde se le estrazioni coprono esattamente il fabbisogno, giallo se c'è eccedenza (come i collegamenti input/output)

## [0.3.14] - 2026-07-04

### Changed
- Slider **Nodi** nelle estrazioni minerali: intervallo 1–25 (prima 1–100)

## [0.3.13] - 2026-07-04

### Changed
- Menu Trivella e Purezza nodo: dropdown custom con testo bianco al passaggio del mouse, senza evidenziazione azzurra di sistema

## [0.3.12] - 2026-07-04

### Fixed
- Schemi risorsa: frecce +/- su Output e Overclock incrementano/decrementano di 1 (non più 0,001)

## [0.3.11] - 2026-07-04

### Changed
- Pulsante «Aggiungi estrazione» con lo stesso stile arancione di «Aggiungi schema risorsa»

## [0.3.10] - 2026-07-04

### Added
- Campo **Nodi** nelle estrazioni minerali (numero di trivelle/nodi, con slider): moltiplica output e frammenti energetici

### Fixed
- Pulsanti reset/elimina estrazione allineati agli schemi risorsa (prima apparivano come due lineette senza stile)
- Griglia configurazione estrazione: eliminata colonna vuota causata da layout a 5 colonne con solo 4 campi

## [0.3.9] - 2026-07-04

### Changed
- Tabella minerali in alto: mostra sempre il fabbisogno reale; riga in verde quando le estrazioni configurate coprono interamente la quantità richiesta

## [0.3.8] - 2026-07-04

### Changed
- Menu a tendina (trivella, purezza nodo, categorie): tema scuro coerente con l'app, testo più leggibile e accento arancione al posto del blu di sistema

## [0.3.7] - 2026-07-04

### Added
- Sezione **Estrazioni minerali** negli schemi di produzione: scegli minerale, trivella (Mk.1–3), purezza del nodo e overclock
- Pulsante «Aggiungi estrazione» con picker dedicato ai soli minerali

### Changed
- Tabella riassuntiva in alto mostra solo i **minerali** ancora da coprire, al netto delle estrazioni configurate

## [0.3.6] - 2026-07-04

### Added
- Pulsante reset su ogni schema risorsa: 1 macchina, 100%, niente Somersloop, output predefinito, collegamenti rimossi

## [0.3.5] - 2026-07-04

### Fixed
- Toggle Somersloop: l'output ora scala per rapporto (×1,5 / ×1,25 ecc.) senza drift da arrotondamento macchine

## [0.3.4] - 2026-07-04

### Changed
- Collegamenti input/output: verde se bilanciati, giallo se in eccesso, nessun colore se insufficienti

## [0.3.3] - 2026-07-04

### Fixed
- Preload script: lettura versione app spostata nel processo main (errore `module not found: fs`)

## [0.3.2] - 2026-07-04

### Changed
- Slot Somersloop edifici salvati in `buildings.json` e visibili nelle statistiche di Impostazioni al ripristino dati

## [0.3.1] - 2026-07-04

### Added
- Output collegati colorati in verde (usati del tutto) o giallo (eccedenza) negli schemi di produzione

## [0.3.0] - 2026-07-04

### Added
- Checkbox Somersloop negli schemi risorsa con boost produzione per slot (100% / 50% / 25%)
- Campo `somersloop_slots` nel database edifici per Smelter, Constructor, Assembler, Foundry, Refinery, Converter, Manufacturer, Blender, Particle Accelerator e Quantum Encoder

## [0.2.1] - 2026-07-04

### Changed
- Ridotto lo spazio verticale tra gli schemi risorsa nella vista produzione

## [0.2.0] - 2026-07-04

### Added
- Gestione risorse con categorie, ricerca e dettaglio schemi di crafting
- Catene di produzione con schemi risorsa, collegamenti input/output e ricalcolo live
- Tabella risorse esterne nell'intestazione dello schema di produzione
- Campo «Frammento energetico» calcolato in base a overclock e macchine
- Impostazioni con ripristino dati predefiniti e statistiche database
- Database edifici importato da SCIM
- Versione app nel footer letta automaticamente da `package.json`
- Regola Cursor per bump versione e changelog ad ogni implementazione

### Changed
- Layout schema produzione: info macchina sotto l'immagine, pulsante aggiungi in alto
- Box input collegati: verde se coperti, giallo se parziali
- Slider output, overclock e macchine con step di 1

### Fixed
- Aggiornamento live di copertura input quando cambia uno schema produttore collegato

## [0.1.0] - 2026-07-04

### Added
- Progetto base Electron con SQLite (sql.js) e interfaccia stile SCIM
- Tabelle iniziali per oggetti, schemi e metadati
