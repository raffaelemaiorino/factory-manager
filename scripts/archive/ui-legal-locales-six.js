'use strict';

function legalBase(t) {
  return {
    title: t.title,
    'sectionAbout.title': 'Factory Manager',
    'sectionAbout.p1': t.aboutP1,
    'sectionAbout.p2': t.aboutP2,
    'sectionIndependence.title': t.indepTitle,
    'sectionIndependence.p1': t.indepP1,
    'sectionIndependence.p2': t.indepP2,
    'sectionIndependence.p3': t.indepP3,
    'sectionIp.title': t.ipTitle,
    'sectionIp.p1': t.ipP1,
    'sectionIp.p2': t.ipP2,
    'sectionIp.p3': t.ipP3,
    'sectionIp.p4': t.ipP4,
    'sectionIp.p5': t.ipP5,
    'sectionName.title': t.nameTitle,
    'sectionName.p1': t.nameP1,
    'sectionName.p2': t.nameP2,
    'sectionName.p3': t.nameP3,
    'sectionFunction.title': t.funcTitle,
    'sectionFunction.p1': t.funcP1,
    'sectionFunction.p2': t.funcP2,
    'sectionFunction.item1': t.funcI1,
    'sectionFunction.item2': t.funcI2,
    'sectionFunction.item3': t.funcI3,
    'sectionFunction.item4': t.funcI4,
    'sectionFunction.item5': t.funcI5,
    'sectionFunction.item6': t.funcI6,
    'sectionFunction.item7': t.funcI7,
    'sectionFunction.p3': t.funcP3,
    'sectionAccuracy.title': t.accTitle,
    'sectionAccuracy.p1': t.accP1,
    'sectionAccuracy.p2': t.accP2,
    'sectionAccuracy.p3': t.accP3,
    'sectionAccuracy.p4': t.accP4,
    'sectionLiability.title': t.liabTitle,
    'sectionLiability.p1': t.liabP1,
    'sectionLiability.item1': t.liabI1,
    'sectionLiability.item2': t.liabI2,
    'sectionLiability.item3': t.liabI3,
    'sectionLiability.item4': t.liabI4,
    'sectionLiability.item5': t.liabI5,
    'sectionLiability.item6': t.liabI6,
    'sectionLiability.item7': t.liabI7,
    'sectionLiability.item8': t.liabI8,
    'sectionLiability.item9': t.liabI9,
    'sectionLiability.p2': t.liabP2,
    'sectionRights.title': t.rightsTitle,
    'sectionRights.p1': t.rightsP1,
    'sectionRights.item1': t.rightsI1,
    'sectionRights.item2': t.rightsI2,
    'sectionRights.item3': t.rightsI3,
    'sectionRights.item4': t.rightsI4,
    'sectionRights.p2': t.rightsP2,
    'sectionRights.p3': t.rightsP3,
    'sectionRights.p4': t.rightsP4,
  };
}

function legalFi() {
  return legalBase({
    title: 'Oikeudelliset tiedot, attribuutiot ja vastuuvapauslauseke',
    aboutP1:
      'Factory Manager on riippumaton, epävirallinen fanitekemä ohjelmisto Satisfactory-pelaajien suunnittelutyökaluna.',
    aboutP2:
      'Sovellus auttaa laskemaan ja visualisoimaan pelin tuotantoketjuja: resurssimäärät, reseptit, sykliajat, syötteet, tuotokset, kulutus, koneiden määrät ja linjojen jäsentely.',
    indepTitle: 'Riippumaton, epävirallinen projekti',
    indepP1:
      'Factory Manageria eivät kehitä, julkaise, sponsoroi, hyväksy, tue tai valtuuta Coffee Stain Studios AB, Coffee Stain Publishing AB tai muut Coffee Stain -konsernin yhtiöt.',
    indepP2:
      'Ohjelmiston käyttö ei luo kaupallista, sopimus-, ammatillista tai kumppanuussuhdetta Factory Managerin kehittäjien ja Coffee Stain Studiosin välille.',
    indepP3:
      'Factory Manager on harrastajien itsenäinen yhteisöprojekti tiedottamiseen ja tuen antamiseen.',
    ipTitle: 'Immateriaalioikeudet',
    ipP1:
      'Satisfactory, sen nimi, tavaramerkit, logot, kuvat, kuvakkeet, grafiikka, resurssit, koneet, rakennukset, esineet, tuotantoelementit, reseptit, nimet, tiedot, design ja muu pelin alkuperäinen sisältö kuuluu Coffee Stain Studios AB:lle ja/tai oikeudenhaltijoille.',
    ipP2: 'Kaikki oikeudet näihin materiaaleihin pysyvät omistajillaan.',
    ipP3: 'Factory Managerin kehittäjät eivät vaadi omistusoikeutta Satisfactory-sisältöön.',
    ipP4:
      'Peliviittausten käyttö ohjelmistossa on vain tiedottamiseen, kuvaamiseen, havainnollistamiseen ja pelimekaniikkojen tunnistamiseen.',
    ipP5:
      'Alkuperäinen koodi, käyttöliittymä, tekninen rakenne, laskentajärjestelmä ja Factory Managerille kehitetyt ominaisuudet kuuluvat tekijöilleen, Satisfactory- ja kolmannen osapuolen oikeudet pidätetään.',
    nameTitle: 'Nimen Satisfactory käyttö',
    nameP1:
      'Nimeä Satisfactory käytetään vain yhteensopivan pelin tunnistamiseen ja ohjelmiston tarkoituksen kuvaamiseen.',
    nameP2: 'Tämä ei tarkoita yhteyttä, valtuutusta, sponsorointia tai hyväksyntää Coffee Stain Studiosilta.',
    nameP3:
      'Satisfactory ei ole ohjelmiston päänimi eikä sitä käytetä esittämään Factory Manageria virallisena tuotteena.',
    funcTitle: 'Ohjelmiston rooli',
    funcP1: 'Factory Manager on vain ulkoinen suunnitteluapu.',
    funcP2: 'Ohjelmisto:',
    funcI1: 'ei korvaa alkuperäistä peliä;',
    funcI2: 'ei mahdollista Satisfactoryn pelaamista;',
    funcI3: 'ei tarjoa ilmaista pääsyä peliin;',
    funcI4: 'ei jaa kopioita pelistä;',
    funcI5: 'ei muokkaa pelitiedostoja suoraan;',
    funcI6: 'ei sisällä koodia Satisfactoryn ajamiseen;',
    funcI7: 'ei ole välttämätön alkuperäisen pelin käyttöön.',
    funcP3: 'Satisfactoryn pelaaminen edellyttää pelin hankkimista virallisista kanavista.',
    accTitle: 'Tietojen paikkansapitävyys',
    accP1:
      'Factory Manager on tukityökalu ja voi sisältää virheitä, puutteita, likiarvoja, häiriöitä tai vanhentuneita tietoja.',
    accP2:
      'Pelin päivitykset, reseptimuutokset, tasapainot, uudet versiot tai sisältö voivat tilapäisesti heikentää tietojen tarkkuutta.',
    accP3:
      'Kehittäjät eivät takaa, että kaikki tiedot, laskelmat, suunnitelmat tai tulokset ovat aina täydellisiä, oikeita, ajantasaisia tai yhteensopivia uusimman peliversion kanssa.',
    accP4: 'Tarkista tulokset itse ja käytä ohjelmistoa omalla vastuullasi.',
    liabTitle: 'Vastuun rajoitus',
    liabP1: 'Lain sallimissa rajoissa Factory Managerin kehittäjät eivät vastaa:',
    liabI1: 'laskentavirheistä;',
    liabI2: 'fabriikan suunnitteluvirheistä;',
    liabI3: 'tietojen menetyksestä;',
    liabI4: 'häiriöistä;',
    liabI5: 'palvelukatkoksista;',
    liabI6: 'yhteensopimattomuuksista;',
    liabI7: 'epätarkoista tuloksista;',
    liabI8: 'suorista tai välillisistä vahingoista;',
    liabI9: 'käytöstä tai käyttökelvottomuudesta aiheutuvista seurauksista.',
    liabP2:
      'Ohjelmisto toimitetaan ilman nimenomaisia tai implisiittisiä takuita toiminnasta, tarkkuudesta tai soveltuvuudesta tiettyyn tarkoitukseen lain sallimissa rajoissa.',
    rightsTitle: 'Ilmoitukset oikeudenhaltijoille',
    rightsP1:
      'Jos oikeudenhaltija katsoo Factory Managerin sisällön loukkaavan oikeuksiaan, hän voi ottaa yhteyttä kehittäjiin ja ilmoittaa:',
    rightsI1: 'asianomaisen sisällön;',
    rightsI2: 'väitetyn loukatun oikeuden;',
    rightsI3: 'pyynnön luonteen;',
    rightsI4: 'tarkistusta helpottavat tiedot.',
    rightsP2:
      'Perustellut ilmoitukset käsitellään; tarvittaessa sisältöä korjataan, korvataan tai poistetaan.',
    rightsP3:
      'Satisfactory ja siihen liittyvät tavaramerkit, logot, kuvat, assetit ja sisältö kuuluvat Coffee Stain Studios AB:lle ja/tai oikeudenhaltijoille.',
    rightsP4: 'Kaikki oikeudet pidätetään.',
  });
}

function legalHu() {
  return legalBase({
    title: 'Jogi információk, attribúciók és felelősségkizárás',
    aboutP1:
      'A Factory Manager független, nem hivatalos, rajongói szoftver Satisfactory-játékosok tervezőeszközeként.',
    aboutP2:
      'Az alkalmazás segít kiszámítani és megjeleníteni a játék termelési láncait: nyersanyagmennyiségek, receptek, ciklusidők, bemenetek, kimenetek, fogyasztás, gépek száma és elrendezés.',
    indepTitle: 'Független, nem hivatalos projekt',
    indepP1:
      'A Factory Managert nem fejleszti, adja ki, szponzorálja, hagyja jóvá, támogatja vagy engedélyezi a Coffee Stain Studios AB, a Coffee Stain Publishing AB vagy a Coffee Stain csoport más vállalatai.',
    indepP2:
      'A szoftver használata nem hoz létre kereskedelmi, társasági, szerződéses vagy partnerségi viszonyt a Factory Manager fejlesztői és a Coffee Stain Studios között.',
    indepP3:
      'A Factory Manager önálló közösségi projekt rajongóktól, tájékoztatás és támogatás céljából.',
    ipTitle: 'Szellemi tulajdon',
    ipP1:
      'A Satisfactory, neve, védjegyei, logói, képei, ikonjai, grafikái, erőforrásai, gépei, épületei, tárgyai, termelési elemei, receptjei, nevei, adatai, dizájnja és minden egyéb eredeti játéktartalom a Coffee Stain Studios AB és/vagy jogosultjaik tulajdona.',
    ipP2: 'Ezen anyagok minden joga a tulajdonosoknál marad.',
    ipP3: 'A Factory Manager fejlesztői nem követelnek tulajdonjogot Satisfactory-tartalomra.',
    ipP4:
      'A játékra utaló nevek, képek, ikonok, erőforrások, gépek, receptek és adatok használata kizárólag tájékoztató, leíró és játékmenet-azonosító célú.',
    ipP5:
      'Az eredeti kód, felület, technikai felépítés, számítási rendszer és a Factory Managerre készült funkciók a szerzőik tulajdonát képezi, a Satisfactory és harmadik felek jogai érintetlenek.',
    nameTitle: 'A Satisfactory név használata',
    nameP1:
      'A Satisfactory név csak a kompatibilis játék azonosítására és a szoftver céljának leírására szolgál.',
    nameP2: 'Ez nem jelent kapcsolatot, engedélyt, szponzorálást vagy jóváhagyást a Coffee Stain Studiostól.',
    nameP3:
      'A Satisfactory nem a szoftver fő neve, és nem használjuk a Factory Managert hivatalos termékként bemutatni.',
    funcTitle: 'A szoftver szerepe',
    funcP1: 'A Factory Manager kizárólag külső tervezőeszköz.',
    funcP2: 'A szoftver:',
    funcI1: 'nem helyettesíti az eredeti játékot;',
    funcI2: 'nem teszi lehetővé a Satisfactory játékát;',
    funcI3: 'nem biztosít ingyenes hozzáférést a játékhoz;',
    funcI4: 'nem oszt játékmásolatokat;',
    funcI5: 'nem módosítja közvetlenül a játékfájlokat;',
    funcI6: 'nem tartalmaz a Satisfactory futtatásához szükséges kódot;',
    funcI7: 'nem szükséges az eredeti játék használatához.',
    funcP3: 'A Satisfactory játékához a játékot hivatalos csatornákon kell megvásárolni.',
    accTitle: 'Adatok pontossága',
    accP1:
      'A Factory Manager támogató eszközként érkezhet hibákkal, hiányosságokkal, közelítésekkel, meghibásodásokkal vagy elavult adatokkal.',
    accP2:
      'Játékfrissítések, receptváltozások, balance, új verziók vagy tartalom ideiglenesen pontatlanná tehetnek információkat.',
    accP3:
      'A fejlesztők nem garantálják, hogy minden adat, számítás, terv vagy eredmény mindig teljes, helyes, naprakész vagy kompatibilis a legújabb játékverzióval.',
    accP4: 'Ellenőrizd az eredményeket, és használd a szoftvert saját felelősségre.',
    liabTitle: 'Felelősség korlátozása',
    liabP1: 'A törvény által megengedett mértékig a Factory Manager fejlesztői nem felelnek:',
    liabI1: 'számítási hibákért;',
    liabI2: 'gyártervezési hibákért;',
    liabI3: 'adatvesztésért;',
    liabI4: 'meghibásodásokért;',
    liabI5: 'szolgáltatáskimaradásokért;',
    liabI6: 'inkompatibilitásért;',
    liabI7: 'pontatlan eredményekért;',
    liabI8: 'közvetlen vagy közvetett károkért;',
    liabI9: 'a használatból vagy használhatatlanságból eredő következményekért.',
    liabP2:
      'A szoftver kifejezett vagy hallgatólagos garancia nélkül érkezik működésre, pontosságra vagy adott célra való alkalmasságra a vonatkozó jog szerint.',
    rightsTitle: 'Jogtulajdonosi bejelentések',
    rightsP1:
      'Ha egy jogosult úgy véli, hogy a Factory Manager tartalma sérti jogait, kapcsolatba léphet a fejlesztőkkel:',
    rightsI1: 'az érintett tartalommal;',
    rightsI2: 'a állítólagosan sértett joggal;',
    rightsI3: 'a kérelem jellegével;',
    rightsI4: 'a vizsgálathoz hasznos információkkal.',
    rightsP2:
      'Indokolt bejelentéseket megvizsgáljuk; szükség esetén a tartalmat javítjuk, cseréljük vagy eltávolítjuk.',
    rightsP3:
      'A Satisfactory és kapcsolódó védjegyei, logói, képei, assetjei és tartalma a Coffee Stain Studios AB és/vagy jogosultjaik tulajdona.',
    rightsP4: 'Minden jog fenntartva.',
  });
}

function legalNo() {
  return legalBase({
    title: 'Juridisk informasjon, attribusjon og ansvarsfraskrivelse',
    aboutP1:
      'Factory Manager er uavhengig, uoffisiell fan-programvare utviklet som planleggingsverktøy for Satisfactory-spillere.',
    aboutP2:
      'Appen hjelper deg å beregne og visualisere produksjonskjeder fra spillet: ressursmengder, oppskrifter, syklustider, inn-/utdata, forbruk, antall maskiner og anleggsstruktur.',
    indepTitle: 'Uavhengig, uoffisielt prosjekt',
    indepP1:
      'Factory Manager er ikke utviklet, publisert, sponset, godkjent, støttet eller autorisert av Coffee Stain Studios AB, Coffee Stain Publishing AB eller andre selskaper i Coffee Stain-gruppen.',
    indepP2:
      'Bruk av programvaren skaper ikke noe kommersielt, selskaps-, kontrakts-, profesjonelt eller partnerskapsforhold mellom Factory Manager-utviklerne og Coffee Stain Studios.',
    indepP3:
      'Factory Manager er et autonomt community-prosjekt laget av entusiaster for informasjon og støtte.',
    ipTitle: 'Immaterielle rettigheter',
    ipP1:
      'Satisfactory, navnet, varemerker, logoer, bilder, ikoner, grafikk, ressurser, maskiner, bygninger, gjenstander, produksjonselementer, oppskrifter, navn, data, design og annet originalt spillinnhold tilhører Coffee Stain Studios AB og/eller rettighetshavere.',
    ipP2: 'Alle rettigheter til slikt materiale forblir hos eierne.',
    ipP3: 'Factory Manager-utviklerne gjør ikke eiendomskrav på Satisfactory-innhold.',
    ipP4:
      'Bruk av spillnavn, bilder, ikoner, ressurser, maskiner, oppskrifter og data i programvaren er utelukkende til informasjon, beskrivelse, illustrasjon og identifikasjon av spillmekanikk.',
    ipP5:
      'Original kode, grensesnitt, teknisk struktur, beregningssystem og funksjoner utviklet for Factory Manager tilhører deres forfattere, med forbehold om Satisfactory og tredjeparts rettigheter.',
    nameTitle: 'Bruk av navnet Satisfactory',
    nameP1:
      'Navnet Satisfactory brukes kun for å identifisere spillet Factory Manager er laget for, og for å beskrive programmets formål.',
    nameP2: 'Dette innebærer ikke tilknytning, autorisasjon, sponsing eller godkjenning fra Coffee Stain Studios.',
    nameP3:
      'Satisfactory er ikke programvarens hovednavn og brukes ikke for å fremstille Factory Manager som et offisielt produkt.',
    funcTitle: 'Programmets rolle',
    funcP1: 'Factory Manager er utelukkende et eksternt planleggingsverktøy.',
    funcP2: 'Programvaren:',
    funcI1: 'erstatter ikke originalspillet;',
    funcI2: 'lar deg ikke spille Satisfactory;',
    funcI3: 'gir ikke gratis tilgang til spillet;',
    funcI4: 'distribuerer ikke kopier av spillet;',
    funcI5: 'endrer ikke spillfiler direkte;',
    funcI6: 'inneholder ikke kode som kreves for å kjøre Satisfactory;',
    funcI7: 'er ikke nødvendig for å bruke originalspillet.',
    funcP3: 'For å spille Satisfactory må du kjøpe og eie spillet via offisielle kanaler.',
    accTitle: 'Datapålitelighet',
    accP1:
      'Factory Manager leveres som støtteverktøy og kan inneholde feil, utelatelser, tilnærminger, feilfunksjoner eller utdaterte data.',
    accP2:
      'Spilloppdateringer, oppskriftsendringer, balansering, nye versjoner eller innhold kan midlertidig gjøre informasjon unøyaktig.',
    accP3:
      'Utviklerne garanterer ikke at alle data, beregninger, planer eller resultater alltid er fullstendige, korrekte, oppdaterte eller kompatible med siste spillversjon.',
    accP4: 'Du oppfordres til å verifisere resultater selv og bruke programvaren på eget ansvar.',
    liabTitle: 'Ansvarsbegrensning',
    liabP1: 'I den grad loven tillater det, er Factory Manager-utviklerne ikke ansvarlige for:',
    liabI1: 'beregningsfeil;',
    liabI2: 'feil i fabrikkdesign;',
    liabI3: 'datatap;',
    liabI4: 'feilfunksjoner;',
    liabI5: 'avbrudd i tjenesten;',
    liabI6: 'inkompatibilitet;',
    liabI7: 'unøyaktige resultater;',
    liabI8: 'direkte eller indirekte skader;',
    liabI9: 'følger av bruk eller manglende mulighet til bruk.',
    liabP2:
      'Programvaren leveres uten uttrykkelige eller underforståtte garantier om drift, nøyaktighet eller egnethet for et bestemt formål, i den grad loven tillater.',
    rightsTitle: 'Meldinger fra rettighetshavere',
    rightsP1:
      'Hvis en rettighetshaver mener innhold i Factory Manager krenker deres rettigheter, kan de kontakte utviklerne med:',
    rightsI1: 'det aktuelle innholdet;',
    rightsI2: 'den påstått krenkede rettigheten;',
    rightsI3: 'naturen av forespørselen;',
    rightsI4: 'informasjon som hjelper vurdering.',
    rightsP2:
      'Berettigede meldinger vurderes; ved behov kan innhold korrigeres, erstattes eller fjernes.',
    rightsP3:
      'Satisfactory og tilhørende varemerker, logoer, bilder, assets og innhold tilhører Coffee Stain Studios AB og/eller rettighetshavere.',
    rightsP4: 'Alle rettigheter forbeholdes.',
  });
}

function legalSk() {
  return legalBase({
    title: 'Právne informácie, atribúcie a zrieknutie sa zodpovednosti',
    aboutP1:
      'Factory Manager je nezávislý, neoficiálny fan-made softvér ako plánovací nástroj pre hráčov Satisfactory.',
    aboutP2:
      'Aplikácia pomáha počítať a vizualizovať produkčné reťazce zo hry: množstvá surovín, recepty, cykly, vstupy, výstupy, spotrebu, počet strojov a usporiadanie linky.',
    indepTitle: 'Nezávislý, neoficiálny projekt',
    indepP1:
      'Factory Manager nie je vyvíjaný, vydávaný, sponzorovaný, schválený, podporovaný ani autorizovaný spoločnosťou Coffee Stain Studios AB, Coffee Stain Publishing AB ani inými firmami skupiny Coffee Stain.',
    indepP2:
      'Používanie softvéru nevytvára obchodný, zmluvný, profesionálny ani partnerský vzťah medzi vývojármi Factory Manager a Coffee Stain Studios.',
    indepP3:
      'Factory Manager je autonómny community projekt nadšencov na informačné účely a podporu hráčov.',
    ipTitle: 'Duševné vlastníctvo',
    ipP1:
      'Satisfactory, jeho názov, ochranné známky, logá, obrázky, ikony, grafika, suroviny, stroje, budovy, predmety, produkčné prvky, recepty, názvy, dáta, dizajn a ostatný pôvodný obsah hry patria Coffee Stain Studios AB a/alebo príslušným vlastníkom.',
    ipP2: 'Všetky práva k týmto materiálom zostávajú u vlastníkov.',
    ipP3: 'Vývojári Factory Manager si ne nárokujú vlastníctvo obsahu Satisfactory.',
    ipP4:
      'Použitie mien, obrázkov, ikon, surovín, strojov, receptov a dát zo hry slúži výhradne na informovanie, popis, ilustráciu a identifikáciu herných mechaník.',
    ipP5:
      'Pôvodný kód, rozhranie, technická štruktúra, výpočtový systém a funkcie vytvorené pre Factory Manager patria autorom, s výhradou práv Satisfactory a tretích strán.',
    nameTitle: 'Použitie názvu Satisfactory',
    nameP1:
      'Názov Satisfactory sa používa len na identifikáciu kompatibilnej hry a popis účelu softvéru.',
    nameP2: 'Neznamená to prepojenie, autorizáciu, sponzorstvo ani schválenie Coffee Stain Studios.',
    nameP3:
      'Satisfactory nie je hlavným názvom softvéru a nepoužíva sa na prezentáciu Factory Manager ako oficiálneho produktu.',
    funcTitle: 'Úloha softvéru',
    funcP1: 'Factory Manager je výhradne externý plánovací nástroj.',
    funcP2: 'Softvér:',
    funcI1: 'nenahrádza pôvodnú hru;',
    funcI2: 'neumožňuje hrať Satisfactory;',
    funcI3: ' neposkytuje bezplatný prístup k hre;',
    funcI4: 'nešíri kópie hry;',
    funcI5: 'priamo nemení herné súbory;',
    funcI6: 'neobsahuje kód potrebný na spustenie Satisfactory;',
    funcI7: 'nie je potrebný na používanie pôvodnej hry.',
    funcP3: 'Na hranie Satisfactory musíte hru legálne získať cez oficiálne kanály.',
    accTitle: 'Presnosť údajov',
    accP1:
      'Factory Manager je poskytovaný ako podporný nástroj a môže obsahovať chyby, opomenutia, približnosti, poruchy alebo zastarané údaje.',
    accP2:
      'Aktualizácie hry, zmeny receptov, balance, nové verzie alebo obsah môžu dočasne znížiť presnosť informácií.',
    accP3:
      'Vývojári nezaručujú, že všetky údaje, výpočty, plány alebo výsledky sú vždy úplné, správne, aktuálne alebo kompatibilné s najnovšou verziou hry.',
    accP4: 'Odporúčame overiť výsledky sami a používať softvér na vlastné riziko.',
    liabTitle: 'Obmedzenie zodpovednosti',
    liabP1: 'V rozsahu povolenom zákonom vývojári Factory Manager nezodpovedajú za:',
    liabI1: 'chyby vo výpočtoch;',
    liabI2: 'chyby v návrhu fabriky;',
    liabI3: 'stratu údajov;',
    liabI4: 'poruchy;',
    liabI5: 'prerušenia služby;',
    liabI6: 'nekompatibilitu;',
    liabI7: 'nepresné výsledky;',
    liabI8: 'priame alebo nepriame škody;',
    liabI9: 'následky používania alebo nemožnosti používať softvér.',
    liabP2:
      'Softvér sa poskytuje bez výslovných ani implicitných záruk prevádzky, presnosti alebo vhodnosti na konkrétny účel v rámci platného práva.',
    rightsTitle: 'Oznámenia držiteľov práv',
    rightsP1:
      'Ak sa držiteľ práv domnieva, že obsah vo Factory Manager porušuje jeho práva, môže kontaktovať vývojárov s:',
    rightsI1: 'dotknutým obsahom;',
    rightsI2: 'údajne porušeným právom;',
    rightsI3: 'povahou požiadavky;',
    rightsI4: 'informáciami na overenie.',
    rightsP2:
      'Oprávnené podnety sa posúdia; obsah môže byť v prípade potreby opravený, nahradený alebo odstránený.',
    rightsP3:
      'Satisfactory a súvisiace ochranné známky, logá, obrázky, assety a obsah patria Coffee Stain Studios AB a/alebo príslušným vlastníkom.',
    rightsP4: 'Všetky práva vyhradené.',
  });
}

function legalSv() {
  return legalBase({
    title: 'Juridisk information, attribution och ansvarsfriskrivning',
    aboutP1:
      'Factory Manager är oberoende, inofficiell fan-programvara utvecklad som planeringsverktyg för Satisfactory-spelare.',
    aboutP2:
      'Appen hjälper dig att beräkna och visualisera produktionskedjor från spelet: resursmängder, recept, cykeltider, in-/utdata, förbrukning, antal maskiner och anläggningsstruktur.',
    indepTitle: 'Oberoende, inofficiellt projekt',
    indepP1:
      'Factory Manager utvecklas, publiceras, sponsras, godkänns, stöds eller auktoriseras inte av Coffee Stain Studios AB, Coffee Stain Publishing AB eller andra bolag i Coffee Stain-gruppen.',
    indepP2:
      'Användning av programvaran skapar inget kommersiellt, bolags-, avtals-, professionellt eller partnerskapsförhållande mellan Factory Manager-utvecklarna och Coffee Stain Studios.',
    indepP3:
      'Factory Manager är ett autonomt community-projekt av entusiaster för information och stöd.',
    ipTitle: 'Immateriella rättigheter',
    ipP1:
      'Satisfactory, dess namn, varumärken, logotyper, bilder, ikoner, grafik, resurser, maskiner, byggnader, föremål, produktionselement, recept, namn, data, design och annat originalt spelinnehåll tillhör Coffee Stain Studios AB och/eller rättighetsinnehavare.',
    ipP2: 'Alla rättigheter till sådant material förblir hos ägarna.',
    ipP3: 'Factory Manager-utvecklarna gör inga äganderättsanspråk på Satisfactory-innehåll.',
    ipP4:
      'Användning av spelnamn, bilder, ikoner, resurser, maskiner, recept och data i programvaran sker enbart i informationssyfte, beskrivning, illustration och identifiering av spelmekanik.',
    ipP5:
      'Original kod, gränssnitt, teknisk struktur, beräkningssystem och funktioner utvecklade för Factory Manager tillhör respektive författare, med förbehåll för Satisfactory och tredje parts rättigheter.',
    nameTitle: 'Användning av namnet Satisfactory',
    nameP1:
      'Namnet Satisfactory används endast för att identifiera spelet Factory Manager är avsett för och beskriva programmets syfte.',
    nameP2: 'Detta innebär ingen anknytning, auktorisation, sponsring eller godkännande från Coffee Stain Studios.',
    nameP3:
      'Satisfactory är inte programvarans huvudnamn och används inte för att presentera Factory Manager som en officiell produkt.',
    funcTitle: 'Programmets roll',
    funcP1: 'Factory Manager är enbart ett externt planeringsverktyg.',
    funcP2: 'Programvaran:',
    funcI1: 'ersätter inte originalspelet;',
    funcI2: 'låter dig inte spela Satisfactory;',
    funcI3: 'ger inte gratis tillgång till spelet;',
    funcI4: 'distribuerar inte kopior av spelet;',
    funcI5: 'ändrar inte spelfiler direkt;',
    funcI6: 'innehåller inte kod som krävs för att köra Satisfactory;',
    funcI7: 'krävs inte för att använda originalspelet.',
    funcP3: 'För att spela Satisfactory måste du köpa och äga spelet via officiella kanaler.',
    accTitle: 'Dataprecision',
    accP1:
      'Factory Manager tillhandahålls som stödverktyg och kan innehålla fel, utelämnanden, approximationer, felfunktioner eller inaktuella data.',
    accP2:
      'Speluppdateringar, receptändringar, balansering, nya versioner eller innehåll kan tillfälligt göra information felaktig.',
    accP3:
      'Utvecklarna garanterar inte att all data, beräkningar, planer eller resultat alltid är fullständiga, korrekta, uppdaterade eller kompatibla med senaste spelversionen.',
    accP4: 'Du uppmuntras att verifiera resultat själv och använda programvaran på egen risk.',
    liabTitle: 'Ansvarsbegränsning',
    liabP1: 'I den utsträckning lagen medger ansvarar Factory Manager-utvecklarna inte för:',
    liabI1: 'beräkningsfel;',
    liabI2: 'fel i fabriksdesign;',
    liabI3: 'dataförlust;',
    liabI4: 'felfunktioner;',
    liabI5: 'avbrott i tjänsten;',
    liabI6: 'inkompatibilitet;',
    liabI7: 'felaktiga resultat;',
    liabI8: 'direkta eller indirekta skador;',
    liabI9: 'följder av användning eller oförmåga att använda programvaran.',
    liabP2:
      'Programvaran tillhandahålls utan uttryckliga eller underförstådda garantier gällande drift, noggrannhet eller lämplighet för visst syfte, i den utsträckning lagen medger.',
    rightsTitle: 'Meddelanden från rättighetsinnehavare',
    rightsP1:
      'Om en rättighetsinnehavare anser att innehåll i Factory Manager kränker deras rättigheter kan de kontakta utvecklarna med:',
    rightsI1: 'det aktuella innehållet;',
    rightsI2: 'den påstått kränkta rättigheten;',
    rightsI3: 'naturen av begäran;',
    rightsI4: 'information som underlättar granskning.',
    rightsP2:
      'Berättigade anmälningar granskas; vid behov kan innehåll korrigeras, ersättas eller tas bort.',
    rightsP3:
      'Satisfactory och tillhörande varumärken, logotyper, bilder, assets och innehåll tillhör Coffee Stain Studios AB och/eller rättighetsinnehavare.',
    rightsP4: 'Alla rättigheter förbehållna.',
  });
}

function legalTr() {
  return legalBase({
    title: 'Yasal bilgiler, atıflar ve sorumluluk reddi',
    aboutP1:
      'Factory Manager, Satisfactory oyuncuları için geliştirilmiş bağımsız, resmi olmayan hayran yapımı bir planlama aracıdır.',
    aboutP2:
      'Uygulama oyundaki üretim zincirlerini hesaplamaya ve görselleştirmeye yardımcı olur: kaynak miktarları, tarifler, döngü süreleri, girdiler, çıktılar, tüketim, makine sayısı ve tesis düzeni.',
    indepTitle: 'Bağımsız, resmi olmayan proje',
    indepP1:
      'Factory Manager; Coffee Stain Studios AB, Coffee Stain Publishing AB veya Coffee Stain grubundaki diğer şirketler tarafından geliştirilmez, yayımlanmaz, sponsor edilmez, onaylanmaz, desteklenmez veya yetkilendirilmez.',
    indepP2:
      'Yazılımın kullanımı Factory Manager geliştiricileri ile Coffee Stain Studios arasında ticari, sözleşmesel veya ortaklık ilişkisi oluşturmaz.',
    indepP3:
      'Factory Manager, bilgilendirme ve destek amacıyla meraklılar tarafından oluşturulmuş özerk bir topluluk projesidir.',
    ipTitle: 'Fikri mülkiyet',
    ipP1:
      'Satisfactory, adı, markaları, logoları, görselleri, simgeleri, kaynakları, makineleri, binaları, öğeleri, üretim unsurları, tarifleri, adları, verileri, tasarımı ve diğer tüm orijinal oyun içeriği Coffee Stain Studios AB ve/veya ilgili hak sahiplerine aittir.',
    ipP2: 'Bu materyallerle ilgili tüm haklar sahiplerinde kalır.',
    ipP3: 'Factory Manager geliştiricileri Satisfactory içeriği üzerinde mülkiyet iddia etmez.',
    ipP4:
      'Yazılımda oyun adları, görseller, simgeler, kaynaklar, makineler, tarifler ve veriler yalnızca bilgilendirme, açıklama, illüstrasyon ve oyun mekaniği tanımlama amacıyla kullanılır.',
    ipP5:
      'Orijinal kod, arayüz, teknik yapı, hesaplama sistemi ve Factory Manager için geliştirilen özellikler ilgili yazarlara aittir; Satisfactory ve üçüncü taraf hakları saklıdır.',
    nameTitle: 'Satisfactory adının kullanımı',
    nameP1:
      'Satisfactory adı yalnızca uyumlu oyunu belirtmek ve yazılımın amacını açıklamak için kullanılır.',
    nameP2: 'Bu, Coffee Stain Studios ile bağ, yetki, sponsorluk veya onay anlamına gelmez.',
    nameP3:
      'Satisfactory yazılımın ana adı değildir ve Factory Manager resmi ürün olarak sunulmaz.',
    funcTitle: 'Yazılımın işlevi',
    funcP1: 'Factory Manager yalnızca harici bir planlama aracıdır.',
    funcP2: 'Yazılım:',
    funcI1: 'orijinal oyunun yerine geçmez;',
    funcI2: 'Satisfactory oynamanızı sağlamaz;',
    funcI3: 'oyuna ücretsiz erişim sunmaz;',
    funcI4: 'oyunun kopyalarını dağıtmaz;',
    funcI5: 'oyun dosyalarını doğrudan değiştirmez;',
    funcI6: 'Satisfactory çalıştırmak için gerekli kodu içermez;',
    funcI7: 'orijinal oyunu kullanmak için gerekli değildir.',
    funcP3: 'Satisfactory oynamak için oyunu resmi kanallardan satın alıp sahip olmalısınız.',
    accTitle: 'Veri doğruluğu',
    accP1:
      'Factory Manager destek aracı olarak sunulur; hata, eksiklik, yaklaşık değer, arıza veya güncel olmayan veri içerebilir.',
    accP2:
      'Oyun güncellemeleri, tarif değişiklikleri, denge ayarları, yeni sürümler veya içerik bazı bilgileri geçici olarak hatalı kılabilir.',
    accP3:
      'Geliştiriciler tüm verilerin, hesaplamaların, planların veya sonuçların her zaman eksiksiz, doğru, güncel veya son oyun sürümüyle uyumlu olduğunu garanti etmez.',
    accP4: 'Sonuçları kendiniz doğrulamanız ve yazılımı kendi sorumluluğunuzda kullanmanız önerilir.',
    liabTitle: 'Sorumluluğun sınırlandırılması',
    liabP1: 'Yasanın izin verdiği ölçüde Factory Manager geliştiricileri şunlardan sorumlu tutulamaz:',
    liabI1: 'hesaplama hataları;',
    liabI2: 'fabrika tasarım hataları;',
    liabI3: 'veri kaybı;',
    liabI4: 'arızalar;',
    liabI5: 'hizmet kesintileri;',
    liabI6: 'uyumsuzluk;',
    liabI7: 'hatalı sonuçlar;',
    liabI8: 'doğrudan veya dolaylı zararlar;',
    liabI9: 'kullanımdan veya kullanılamamaktan doğan sonuçlar.',
    liabP2:
      'Yazılım, yürürlükteki hukuk çerçevesinde işleyiş, doğruluk veya belirli bir amaca uygunluk konusunda açık veya zımni garanti olmaksızın sunulur.',
    rightsTitle: 'Hak sahiplerine bildirimler',
    rightsP1:
      'Bir hak sahibi Factory Manager içeriğinin haklarını ihlal ettiğini düşünürse geliştiricilerle şunları belirterek iletişime geçebilir:',
    rightsI1: 'ilgili içerik;',
    rightsI2: 'iddia edilen ihlal;',
    rightsI3: 'talebin niteliği;',
    rightsI4: 'incelemeye yardımcı bilgiler.',
    rightsP2:
      'Haklı bildirimler incelenir; gerekirse içerik düzeltilir, değiştirilir veya kaldırılır.',
    rightsP3:
      'Satisfactory ve ilgili markalar, logolar, görseller, varlıklar ve içerik Coffee Stain Studios AB ve/veya ilgili sahiplere aittir.',
    rightsP4: 'Tüm hakları saklıdır.',
  });
}

module.exports = {
  legalBase,
  legalFi,
  legalHu,
  legalNo,
  legalSk,
  legalSv,
  legalTr,
};
