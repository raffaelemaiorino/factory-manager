'use strict';

function legalBase(lang) {
  const t = lang;
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

function legalDe() {
  return legalBase({
    title: 'Rechtliche Hinweise, Attributionen und Haftungsausschluss',
    aboutP1:
      'Factory Manager ist unabhängige, inoffizielle Fan-Software als Begleitwerkzeug für Satisfactory-Spieler.',
    aboutP2:
      'Die App hilft bei Berechnung und Visualisierung von Produktionsketten im Spiel: Ressourcenmengen, Rezepte, Taktzeiten, Ein- und Ausgänge, Verbrauch, Maschinenanzahl und Anlagenstruktur.',
    indepTitle: 'Unabhängiges, inoffizielles Projekt',
    indepP1:
      'Factory Manager wird nicht von Coffee Stain Studios AB, Coffee Stain Publishing AB oder anderen Unternehmen der Coffee-Stain-Gruppe entwickelt, veröffentlicht, gesponsert, genehmigt, unterstützt oder autorisiert.',
    indepP2:
      'Die Nutzung begründet kein geschäftliches, gesellschaftsrechtliches, vertragliches oder partnerschaftliches Verhältnis zwischen den Entwicklern von Factory Manager und Coffee Stain Studios.',
    indepP3:
      'Factory Manager ist ein autonomes Community-Projekt von Enthusiasten zu Informations- und Unterstützungszwecken.',
    ipTitle: 'Geistiges Eigentum',
    ipP1:
      'Satisfactory, Name, Marken, Logos, Bilder, Icons, Grafiken, Ressourcen, Maschinen, Gebäude, Gegenstände, Produktionselemente, Rezepte, Namen, Daten, Design und sonstige Originalinhalte des Spiels gehören Coffee Stain Studios AB bzw. den jeweiligen Rechteinhabern und Lizenzgebern.',
    ipP2: 'Alle Rechte an diesen Materialien verbleiben bei den jeweiligen Inhabern.',
    ipP3: 'Die Entwickler von Factory Manager erheben keinen Eigentumsanspruch an Satisfactory-Inhalten.',
    ipP4:
      'Die Verwendung von Spielnamen, Bildern, Icons, Ressourcen, Maschinen, Rezepten, Daten oder anderen Spielbezügen in der Software dient ausschließlich Informations-, Beschreibungs- und Identifikationszwecken für Spielmechaniken.',
    ipP5:
      'Originalcode, Oberfläche, technische Struktur, Berechnungssystem und speziell für Factory Manager entwickelte Funktionen gehören den jeweiligen Autoren, vorbehaltlich aller Rechte an Satisfactory- und Drittinhalten.',
    nameTitle: 'Verwendung des Namens Satisfactory',
    nameP1:
      'Der Name Satisfactory wird nur verwendet, um das kompatible Spiel zu bezeichnen und den Zweck der Software zu beschreiben.',
    nameP2:
      'Das impliziert keine Zugehörigkeit, Genehmigung, Sponsoring oder Billigung durch Coffee Stain Studios.',
    nameP3:
      'Satisfactory ist nicht der Hauptname der Software und dient nicht dazu, Factory Manager als offizielles Produkt darzustellen.',
    funcTitle: 'Funktion der Software',
    funcP1: 'Factory Manager ist ausschließlich ein externes Planungswerkzeug.',
    funcP2: 'Die Software:',
    funcI1: 'ersetzt das Originalspiel nicht;',
    funcI2: 'ermöglicht kein Spielen von Satisfactory;',
    funcI3: 'gewährt keinen kostenlosen Zugang zum Spiel;',
    funcI4: 'verbreitet keine Kopien des Spiels;',
    funcI5: 'ändert Spieldateien nicht direkt;',
    funcI6: 'enthält keinen Code, der zum Ausführen von Satisfactory nötig ist;',
    funcI7: 'ist nicht erforderlich, um das Originalspiel zu nutzen.',
    funcP3:
      'Zum Spielen von Satisfactory musst du das Spiel über offizielle Kanäle erwerben und besitzen.',
    accTitle: 'Datengenauigkeit',
    accP1:
      'Factory Manager wird als Hilfsmittel bereitgestellt und kann Fehler, Auslassungen, Näherungen, Störungen oder veraltete Daten enthalten.',
    accP2:
      'Spielupdates, Rezeptänderungen, Balancing, neue Versionen oder Inhalte können Informationen vorübergehend ungenau machen.',
    accP3:
      'Die Entwickler garantieren nicht, dass alle Daten, Berechnungen, Pläne oder Ergebnisse stets vollständig, korrekt, aktuell oder mit der neuesten Spielversion kompatibel sind.',
    accP4: 'Prüfe Ergebnisse selbst und nutze die Software auf eigenes Risiko.',
    liabTitle: 'Haftungsbeschränkung',
    liabP1:
      'Soweit gesetzlich zulässig, haften die Entwickler von Factory Manager nicht für:',
    liabI1: 'Rechenfehler;',
    liabI2: 'Fehler in der Fabrikplanung;',
    liabI3: 'Datenverlust;',
    liabI4: 'Störungen;',
    liabI5: 'Dienstunterbrechungen;',
    liabI6: 'Inkompatibilitäten;',
    liabI7: 'ungenau Ergebnisse;',
    liabI8: 'direkte oder indirekte Schäden;',
    liabI9: 'Folgen aus Nutzung oder Unmöglichkeit der Nutzung der Software.',
    liabP2:
      'Die Software wird ohne ausdrückliche oder stillschweigende Gewähr für Betrieb, Genauigkeit oder Eignung für einen bestimmten Zweck bereitgestellt, soweit das Recht dies zulässt.',
    rightsTitle: 'Hinweise für Rechteinhaber',
    rightsP1:
      'Hält ein Rechteinhaber Inhalte in Factory Manager für rechtsverletzend, kann er die Entwickler kontaktieren mit:',
    rightsI1: 'dem betroffenen Inhalt;',
    rightsI2: 'dem vermeintlich verletzten Recht;',
    rightsI3: 'Art der Anfrage;',
    rightsI4: 'Informationen zur Prüfung.',
    rightsP2:
      'Berechtigte Meldungen werden geprüft; betroffene Inhalte können bei Bedarf korrigiert, ersetzt oder entfernt werden.',
    rightsP3:
      'Satisfactory und alle zugehörigen Marken, Logos, Bilder, Assets und Inhalte gehören Coffee Stain Studios AB bzw. den jeweiligen Inhabern.',
    rightsP4: 'Alle Rechte vorbehalten.',
  });
}

function legalFr() {
  return legalBase({
    title: 'Informations légales, attributions et clause de non-responsabilité',
    aboutP1:
      'Factory Manager est un logiciel fan-made indépendant et non officiel, conçu comme outil d’accompagnement pour les joueurs de Satisfactory.',
    aboutP2:
      'L’application aide à calculer et visualiser les chaînes de production du jeu : quantités, recettes, cadences, entrées, sorties, consommation, nombre de machines et organisation des lignes.',
    indepTitle: 'Projet indépendant et non officiel',
    indepP1:
      'Factory Manager n’est ni développé, ni publié, ni sponsorisé, ni approuvé, ni soutenu, ni autorisé par Coffee Stain Studios AB, Coffee Stain Publishing AB ou d’autres sociétés du groupe Coffee Stain.',
    indepP2:
      'L’utilisation du logiciel ne crée aucun lien commercial, sociétaire, contractuel, professionnel ou de partenariat entre les développeurs de Factory Manager et Coffee Stain Studios.',
    indepP3:
      'Factory Manager est un projet communautaire autonome, réalisé par des passionnés à des fins d’information et de support.',
    ipTitle: 'Propriété intellectuelle',
    ipP1:
      'Satisfactory, son nom, marques, logos, images, icônes, visuels, ressources, machines, bâtiments, objets, éléments de production, recettes, noms, données, design et tout contenu original du jeu appartiennent à Coffee Stain Studios AB et/ou à leurs titulaires et concédants.',
    ipP2: 'Tous les droits sur ces éléments restent réservés à leurs propriétaires.',
    ipP3: 'Les développeurs de Factory Manager ne revendiquent aucun droit de propriété sur le contenu de Satisfactory.',
    ipP4:
      'L’usage dans le logiciel de noms, images, icônes, ressources, machines, recettes, données ou autres références au jeu vise uniquement l’information, la description, l’illustration et l’identification des mécaniques de jeu.',
    ipP5:
      'Le code original, l’interface, la structure technique, le système de calcul et les fonctions spécifiques à Factory Manager appartiennent à leurs auteurs, sous réserve des droits sur Satisfactory et les contenus tiers.',
    nameTitle: 'Usage du nom Satisfactory',
    nameP1:
      'Le nom Satisfactory sert uniquement à identifier le jeu compatible et à décrire la finalité du logiciel.',
    nameP2:
      'Cet usage n’implique aucune affiliation, autorisation, sponsoring ou approbation de Coffee Stain Studios.',
    nameP3:
      'Satisfactory n’est pas le nom principal du logiciel et ne sert pas à présenter Factory Manager comme un produit officiel.',
    funcTitle: 'Rôle du logiciel',
    funcP1: 'Factory Manager est strictement un aide à la planification externe.',
    funcP2: 'Le logiciel :',
    funcI1: 'ne remplace pas le jeu original ;',
    funcI2: 'ne permet pas de jouer à Satisfactory ;',
    funcI3: 'n’offre pas d’accès gratuit au jeu ;',
    funcI4: 'ne distribue pas de copies du jeu ;',
    funcI5: 'ne modifie pas directement les fichiers du jeu ;',
    funcI6: 'ne contient pas le code nécessaire pour exécuter Satisfactory ;',
    funcI7: 'n’est pas requis pour utiliser le jeu original.',
    funcP3:
      'Pour jouer à Satisfactory, vous devez acheter et posséder le jeu via les canaux officiels.',
    accTitle: 'Exactitude des données',
    accP1:
      'Factory Manager est fourni comme outil d’aide et peut contenir erreurs, omissions, approximations, dysfonctionnements ou données obsolètes.',
    accP2:
      'Mises à jour du jeu, changements de recettes, équilibrage, nouvelles versions ou contenus Satisfactory peuvent rendre certaines informations temporairement inexactes.',
    accP3:
      'Les développeurs ne garantissent pas que toutes les données, calculs, plans ou résultats sont toujours complets, corrects, à jour ou compatibles avec la dernière version du jeu.',
    accP4: 'Vérifiez les résultats vous-même et utilisez le logiciel à vos risques.',
    liabTitle: 'Limitation de responsabilité',
    liabP1:
      'Dans la mesure permise par la loi, les développeurs de Factory Manager ne sauraient être responsables de :',
    liabI1: 'erreurs de calcul ;',
    liabI2: 'erreurs de conception d’usine ;',
    liabI3: 'perte de données ;',
    liabI4: 'dysfonctionnements ;',
    liabI5: 'interruptions de service ;',
    liabI6: 'incompatibilités ;',
    liabI7: 'résultats inexacts ;',
    liabI8: 'dommages directs ou indirects ;',
    liabI9: 'conséquences liées à l’usage ou à l’impossibilité d’utiliser le logiciel.',
    liabP2:
      'Le logiciel est fourni sans garantie expresse ou implicite quant à son fonctionnement, son exactitude ou son adéquation à un usage particulier, dans les limites du droit applicable.',
    rightsTitle: 'Signalements des titulaires de droits',
    rightsP1:
      'Si un titulaire estime qu’un contenu de Factory Manager porte atteinte à ses droits, il peut contacter les développeurs en indiquant :',
    rightsI1: 'le contenu concerné ;',
    rightsI2: 'le droit présumé violé ;',
    rightsI3: 'la nature de la demande ;',
    rightsI4: 'toute information utile à l’examen.',
    rightsP2:
      'Les signalements légitimes seront examinés ; le contenu concerné pourra être corrigé, remplacé ou retiré si nécessaire.',
    rightsP3:
      'Satisfactory et toutes marques, logos, images, assets et contenus associés appartiennent à Coffee Stain Studios AB et/ou à leurs titulaires.',
    rightsP4: 'Tous droits réservés.',
  });
}

function legalEs() {
  return legalBase({
    title: 'Información legal, atribuciones y descargo de responsabilidad',
    aboutP1:
      'Factory Manager es software fan-made independiente y no oficial, desarrollado como herramienta complementaria para jugadores de Satisfactory.',
    aboutP2:
      'La app ayuda a calcular y visualizar cadenas de producción del juego: cantidades, recetas, tiempos de ciclo, entradas, salidas, consumo, número de máquinas y organización del layout.',
    indepTitle: 'Proyecto independiente y no oficial',
    indepP1:
      'Factory Manager no está desarrollado, publicado, patrocinado, aprobado, respaldado ni autorizado por Coffee Stain Studios AB, Coffee Stain Publishing AB u otras empresas del grupo Coffee Stain.',
    indepP2:
      'El uso del software no crea relación comercial, societaria, contractual, profesional ni de colaboración entre los desarrolladores de Factory Manager y Coffee Stain Studios.',
    indepP3:
      'Factory Manager es un proyecto autónomo de la comunidad, hecho por entusiastas con fines informativos y de apoyo.',
    ipTitle: 'Propiedad intelectual',
    ipP1:
      'Satisfactory, su nombre, marcas, logotipos, imágenes, iconos, gráficos, recursos, máquinas, edificios, objetos, elementos de producción, recetas, nombres, datos, diseño y demás contenido original del juego pertenecen a Coffee Stain Studios AB y/o a sus titulares y licenciantes.',
    ipP2: 'Todos los derechos sobre esos materiales permanecen con sus respectivos titulares.',
    ipP3: 'Los desarrolladores de Factory Manager no reclaman propiedad sobre contenido de Satisfactory.',
    ipP4:
      'El uso en el software de nombres, imágenes, iconos, recursos, máquinas, recetas, datos u otras referencias al juego es solo con fines informativos, descriptivos, ilustrativos e identificación de mecánicas.',
    ipP5:
      'El código original, la interfaz, la estructura técnica, el sistema de cálculo y las funciones específicas de Factory Manager pertenecen a sus autores, sin perjuicio de los derechos sobre Satisfactory y materiales de terceros.',
    nameTitle: 'Uso del nombre Satisfactory',
    nameP1:
      'El nombre Satisfactory se usa solo para identificar el juego compatible y describir el propósito del software.',
    nameP2:
      'Ese uso no implica afiliación, autorización, patrocinio ni aprobación por Coffee Stain Studios.',
    nameP3:
      'Satisfactory no es el nombre principal del software ni se usa para presentar Factory Manager como producto oficial.',
    funcTitle: 'Función del software',
    funcP1: 'Factory Manager es exclusivamente una ayuda externa de planificación.',
    funcP2: 'El software:',
    funcI1: 'no sustituye el juego original;',
    funcI2: 'no permite jugar a Satisfactory;',
    funcI3: 'no ofrece acceso gratuito al juego;',
    funcI4: 'no distribuye copias del juego;',
    funcI5: 'no modifica directamente los archivos del juego;',
    funcI6: 'no contiene código necesario para ejecutar Satisfactory;',
    funcI7: 'no es necesario para usar el juego original.',
    funcP3:
      'Para jugar a Satisfactory debes comprar y poseer el juego por canales oficiales.',
    accTitle: 'Exactitud de los datos',
    accP1:
      'Factory Manager se ofrece como herramienta de apoyo y puede contener errores, omisiones, aproximaciones, fallos o datos desactualizados.',
    accP2:
      'Actualizaciones del juego, cambios de recetas, balanceo, nuevas versiones o contenido de Satisfactory pueden hacer que parte de la información sea temporalmente inexacta.',
    accP3:
      'Los desarrolladores no garantizan que todos los datos, cálculos, planes o resultados sean siempre completos, correctos, actuales o compatibles con la última versión del juego.',
    accP4: 'Se recomienda verificar los resultados y usar el software bajo tu responsabilidad.',
    liabTitle: 'Limitación de responsabilidad',
    liabP1:
      'En la medida permitida por la ley, los desarrolladores de Factory Manager no serán responsables de:',
    liabI1: 'errores de cálculo;',
    liabI2: 'errores en el diseño de fábricas;',
    liabI3: 'pérdida de datos;',
    liabI4: 'mal funcionamiento;',
    liabI5: 'interrupciones del servicio;',
    liabI6: 'incompatibilidades;',
    liabI7: 'resultados inexactos;',
    liabI8: 'daños directos o indirectos;',
    liabI9: 'consecuencias del uso o imposibilidad de usar el software.',
    liabP2:
      'El software se proporciona sin garantías expresas o implícitas sobre funcionamiento, exactitud o idoneidad para un fin concreto, en los límites legales aplicables.',
    rightsTitle: 'Avisos a titulares de derechos',
    rightsP1:
      'Si un titular cree que contenido en Factory Manager infringe sus derechos, puede contactar a los desarrolladores indicando:',
    rightsI1: 'el contenido afectado;',
    rightsI2: 'el derecho presuntamente vulnerado;',
    rightsI3: 'la naturaleza de la solicitud;',
    rightsI4: 'información útil para la revisión.',
    rightsP2:
      'Los avisos legítimos serán revisados y, si procede, el contenido podrá corregirse, sustituirse o eliminarse.',
    rightsP3:
      'Satisfactory y todas las marcas, logotipos, imágenes, assets y contenidos relacionados pertenecen a Coffee Stain Studios AB y/o a sus titulares.',
    rightsP4: 'Todos los derechos reservados.',
  });
}

function legalPl() {
  return legalBase({
    title: 'Informacje prawne, atrybucje i wyłączenie odpowiedzialności',
    aboutP1:
      'Factory Manager to niezależne, nieoficjalne oprogramowanie fanowskie — narzędzie towarzyszące dla graczy Satisfactory.',
    aboutP2:
      'Aplikacja pomaga obliczać i wizualizować łańcuchy produkcji z gry: ilości surowców, przepisy, czasy cykli, wejścia, wyjścia, zużycie, liczbę maszyn i układ fabryki.',
    indepTitle: 'Niezależny, nieoficjalny projekt',
    indepP1:
      'Factory Manager nie jest tworzony, publikowany, sponsorowany, zatwierdzany, wspierany ani autoryzowany przez Coffee Stain Studios AB, Coffee Stain Publishing AB ani inne podmioty grupy Coffee Stain.',
    indepP2:
      'Korzystanie z oprogramowania nie tworzy relacji handlowej, korporacyjnej, umownej, zawodowej ani partnerskiej między twórcami Factory Manager a Coffee Stain Studios.',
    indepP3:
      'Factory Manager to autonomiczny projekt społeczności entuzjastów, służący celom informacyjnym i wsparciu graczy.',
    ipTitle: 'Własność intelektualna',
    ipP1:
      'Satisfactory, jego nazwa, znaki towarowe, logotypy, obrazy, ikony, grafiki, zasoby, maszyny, budynki, przedmioty, elementy produkcji, przepisy, nazwy, dane, design i pozostałe oryginalne treści gry należą do Coffee Stain Studios AB i/lub odpowiednich właścicieli i licencjodawców.',
    ipP2: 'Wszelkie prawa do tych materiałów pozostają u właścicieli.',
    ipP3: 'Twórcy Factory Manager nie roszczą sobie praw własności do treści Satisfactory.',
    ipP4:
      'Wykorzystanie w oprogramowaniu nazw, obrazów, ikon, zasobów, maszyn, przepisów, danych lub innych odniesień do gry służy wyłącznie celom informacyjnym, opisowym, ilustracyjnym i identyfikacji mechanik gry.',
    ipP5:
      'Oryginalny kod, interfejs, struktura techniczna, system obliczeń i funkcje stworzone dla Factory Manager należą do ich autorów, z zastrzeżeniem praw do Satisfactory i materiałów osób trzecich.',
    nameTitle: 'Użycie nazwy Satisfactory',
    nameP1:
      'Nazwa Satisfactory służy wyłącznie do wskazania kompatybilnej gry i opisu przeznaczenia oprogramowania.',
    nameP2:
      'Nie oznacza to powiązania, autoryzacji, sponsoringu ani akceptacji przez Coffee Stain Studios.',
    nameP3:
      'Satisfactory nie jest główną nazwą oprogramowania i nie służy do przedstawiania Factory Manager jako produktu oficjalnego.',
    funcTitle: 'Rola oprogramowania',
    funcP1: 'Factory Manager to wyłącznie zewnętrzne narzędzie planowania.',
    funcP2: 'Oprogramowanie:',
    funcI1: 'nie zastępuje oryginalnej gry;',
    funcI2: 'nie umożliwia grania w Satisfactory;',
    funcI3: 'nie zapewnia darmowego dostępu do gry;',
    funcI4: 'nie rozpowszechnia kopii gry;',
    funcI5: 'nie modyfikuje bezpośrednio plików gry;',
    funcI6: 'nie zawiera kodu wymaganego do uruchomienia Satisfactory;',
    funcI7: 'nie jest wymagane do korzystania z oryginalnej gry.',
    funcP3:
      'Aby grać w Satisfactory, musisz legalnie nabyć grę w oficjalnych kanałach.',
    accTitle: 'Dokładność danych',
    accP1:
      'Factory Manager jest narzędziem pomocniczym i może zawierać błędy, pominięcia, przybliżenia, awarie lub nieaktualne dane.',
    accP2:
      'Aktualizacje gry, zmiany przepisów, balans, nowe wersje lub treści Satisfactory mogą czasowo obniżyć dokładność informacji.',
    accP3:
      'Twórcy nie gwarantują, że wszystkie dane, obliczenia, plany lub wyniki są zawsze kompletne, poprawne, aktualne lub zgodne z najnowszą wersją gry.',
    accP4: 'Zaleca się samodzielną weryfikację wyników i korzystanie na własne ryzyko.',
    liabTitle: 'Ograniczenie odpowiedzialności',
    liabP1:
      'W granicach dozwolonych przez prawo twórcy Factory Manager nie ponoszą odpowiedzialności za:',
    liabI1: 'błędy obliczeń;',
    liabI2: 'błędy w projekcie fabryki;',
    liabI3: 'utratę danych;',
    liabI4: 'awarie;',
    liabI5: 'przerwy w działaniu;',
    liabI6: 'niezgodności;',
    liabI7: 'niedokładne wyniki;',
    liabI8: 'szkody bezpośrednie lub pośrednie;',
    liabI9: 'skutki użytkowania lub niemożności użytkowania oprogramowania.',
    liabP2:
      'Oprogramowanie jest dostarczane bez wyraźnych ani dorozumianych gwarancji co do działania, dokładności lub przydatności do określonego celu, w granicach obowiązującego prawa.',
    rightsTitle: 'Zgłoszenia właścicieli praw',
    rightsP1:
      'Jeśli właściciel praw uważa, że treść w Factory Manager narusza jego prawa, może skontaktować się z twórcami, podając:',
    rightsI1: 'dotyczoną treść;',
    rightsI2: 'domniemanie naruszone prawo;',
    rightsI3: 'charakter wniosku;',
    rightsI4: 'informacje ułatwiające weryfikację.',
    rightsP2:
      'Uzasadnione zgłoszenia zostaną rozpatrzone; w razie potrzeby treść może zostać poprawiona, zastąpiona lub usunięta.',
    rightsP3:
      'Satisfactory oraz powiązane znaki, logotypy, obrazy, zasoby i treści należą do Coffee Stain Studios AB i/lub odpowiednich właścicieli.',
    rightsP4: 'Wszelkie prawa zastrzeżone.',
  });
}

function legalPt() {
  return legalBase({
    title: 'Informação legal, atribuições e isenção de responsabilidade',
    aboutP1:
      'Factory Manager é software fan-made independente e não oficial, desenvolvido como ferramenta complementar para jogadores de Satisfactory.',
    aboutP2:
      'A app ajuda a calcular e visualizar cadeias de produção do jogo: quantidades, receitas, tempos de ciclo, entradas, saídas, consumo, número de máquinas e organização do layout.',
    indepTitle: 'Projeto independente e não oficial',
    indepP1:
      'Factory Manager não é desenvolvido, publicado, patrocinado, aprovado, apoiado nem autorizado pela Coffee Stain Studios AB, Coffee Stain Publishing AB ou outras empresas do grupo Coffee Stain.',
    indepP2:
      'O uso do software não cria relação comercial, societária, contratual, profissional ou de parceria entre os developers do Factory Manager e a Coffee Stain Studios.',
    indepP3:
      'Factory Manager é um projeto autónomo da comunidade, feito por entusiastas para informação e apoio.',
    ipTitle: 'Propriedade intelectual',
    ipP1:
      'Satisfactory, o seu nome, marcas, logótipos, imagens, ícones, arte, recursos, máquinas, edifícios, itens, elementos de produção, receitas, nomes, dados, design e demais conteúdo original do jogo pertencem à Coffee Stain Studios AB e/ou aos respetivos titulares e licenciadores.',
    ipP2: 'Todos os direitos sobre esses materiais permanecem com os respetivos titulares.',
    ipP3: 'Os developers do Factory Manager não reivindicam propriedade sobre conteúdo de Satisfactory.',
    ipP4:
      'O uso no software de nomes, imagens, ícones, recursos, máquinas, receitas, dados ou outras referências ao jogo destina-se apenas a fins informativos, descritivos, ilustrativos e identificação de mecânicas.',
    ipP5:
      'O código original, a interface, a estrutura técnica, o sistema de cálculo e as funcionalidades específicas do Factory Manager pertencem aos respetivos autores, sem prejuízo dos direitos sobre Satisfactory e materiais de terceiros.',
    nameTitle: 'Uso do nome Satisfactory',
    nameP1:
      'O nome Satisfactory é usado apenas para identificar o jogo compatível e descrever a finalidade do software.',
    nameP2:
      'Esse uso não implica afiliação, autorização, patrocínio ou aprovação pela Coffee Stain Studios.',
    nameP3:
      'Satisfactory não é o nome principal do software nem serve para apresentar o Factory Manager como produto oficial.',
    funcTitle: 'Função do software',
    funcP1: 'Factory Manager é exclusivamente uma ajuda externa de planeamento.',
    funcP2: 'O software:',
    funcI1: 'não substitui o jogo original;',
    funcI2: 'não permite jogar Satisfactory;',
    funcI3: 'não oferece acesso gratuito ao jogo;',
    funcI4: 'não distribui cópias do jogo;',
    funcI5: 'não modifica diretamente os ficheiros do jogo;',
    funcI6: 'não contém código necessário para executar Satisfactory;',
    funcI7: 'não é necessário para usar o jogo original.',
    funcP3:
      'Para jogar Satisfactory deve comprar e possuir o jogo pelos canais oficiais.',
    accTitle: 'Precisão dos dados',
    accP1:
      'Factory Manager é fornecido como ferramenta de apoio e pode conter erros, omissões, aproximações, falhas ou dados desatualizados.',
    accP2:
      'Atualizações do jogo, alterações a receitas, balanceamento, novas versões ou conteúdo Satisfactory podem tornar temporariamente imprecisa alguma informação.',
    accP3:
      'Os developers não garantem que todos os dados, cálculos, planos ou resultados sejam sempre completos, corretos, atualizados ou compatíveis com a última versão do jogo.',
    accP4: 'Recomenda-se verificar os resultados e usar o software por sua conta e risco.',
    liabTitle: 'Limitação de responsabilidade',
    liabP1:
      'Na medida permitida por lei, os developers do Factory Manager não serão responsáveis por:',
    liabI1: 'erros de cálculo;',
    liabI2: 'erros no desenho da fábrica;',
    liabI3: 'perda de dados;',
    liabI4: 'avarias;',
    liabI5: 'interrupções de serviço;',
    liabI6: 'incompatibilidades;',
    liabI7: 'resultados imprecisos;',
    liabI8: 'danos diretos ou indiretos;',
    liabI9: 'consequências do uso ou impossibilidade de usar o software.',
    liabP2:
      'O software é fornecido sem garantias expressas ou implícitas quanto ao funcionamento, exatidão ou adequação a um fim específico, nos limites legais aplicáveis.',
    rightsTitle: 'Avisos a titulares de direitos',
    rightsP1:
      'Se um titular considerar que conteúdo no Factory Manager viola os seus direitos, pode contactar os developers indicando:',
    rightsI1: 'o conteúdo em causa;',
    rightsI2: 'o direito presumivelmente violado;',
    rightsI3: 'a natureza do pedido;',
    rightsI4: 'informação útil para análise.',
    rightsP2:
      'Denúncias legítimas serão analisadas; o conteúdo pode ser corrigido, substituído ou removido quando necessário.',
    rightsP3:
      'Satisfactory e todas as marcas, logótipos, imagens, assets e conteúdos relacionados pertencem à Coffee Stain Studios AB e/ou aos respetivos titulares.',
    rightsP4: 'Todos os direitos reservados.',
  });
}

function legalNl() {
  return legalBase({
    title: 'Juridische informatie, attributies en disclaimer',
    aboutP1:
      'Factory Manager is onafhankelijke, niet-officiële fan-software, ontwikkeld als hulpmiddel voor Satisfactory-spelers.',
    aboutP2:
      'De app helpt productieketens uit het spel te berekenen en visualiseren: hoeveelheden, recepten, cyclustijden, inputs, outputs, verbruik, aantal machines en lay-out.',
    indepTitle: 'Onafhankelijk, niet-officieel project',
    indepP1:
      'Factory Manager is niet ontwikkeld, gepubliceerd, gesponsord, goedgekeurd, ondersteund of geautoriseerd door Coffee Stain Studios AB, Coffee Stain Publishing AB of andere bedrijven in de Coffee Stain-groep.',
    indepP2:
      'Het gebruik van de software creëert geen commerciële, vennootschaps-, contractuele, professionele of partnerschapsrelatie tussen de ontwikkelaars van Factory Manager en Coffee Stain Studios.',
    indepP3:
      'Factory Manager is een autonoom communityproject van enthusiasts voor informatie en ondersteuning.',
    ipTitle: 'Intellectueel eigendom',
    ipP1:
      'Satisfactory, de naam, merken, logo’s, afbeeldingen, iconen, artwork, grondstoffen, machines, gebouwen, items, productie-elementen, recepten, namen, data, design en overige originele game-inhoud behoren toe aan Coffee Stain Studios AB en/of de respectieve eigenaren en licentiegevers.',
    ipP2: 'Alle rechten op die materialen blijven bij de respectieve eigenaren.',
    ipP3: 'De ontwikkelaars van Factory Manager claimen geen eigendom van Satisfactory-inhoud.',
    ipP4:
      'Gebruik in de software van namen, afbeeldingen, iconen, grondstoffen, machines, recepten, data of andere gamereferenties is uitsluitend voor informatieve, beschrijvende, illustratieve en mechanicidentificatie-doeleinden.',
    ipP5:
      'Originele code, interface, technische structuur, berekeningssysteem en functies specifiek voor Factory Manager behoren toe aan hun auteurs, onder voorbehoud van rechten op Satisfactory en materialen van derden.',
    nameTitle: 'Gebruik van de naam Satisfactory',
    nameP1:
      'De naam Satisfactory wordt alleen gebruikt om het compatibele spel aan te duiden en het doel van de software te beschrijven.',
    nameP2:
      'Dit impliceert geen affiliatie, autorisatie, sponsoring of goedkeuring door Coffee Stain Studios.',
    nameP3:
      'Satisfactory is niet de hoofdnaam van de software en wordt niet gebruikt om Factory Manager als officieel product voor te stellen.',
    funcTitle: 'Functie van de software',
    funcP1: 'Factory Manager is uitsluitend een extern planningshulpmiddel.',
    funcP2: 'De software:',
    funcI1: 'vervangt het originele spel niet;',
    funcI2: 'laat je Satisfactory niet spelen;',
    funcI3: 'biedt geen gratis toegang tot het spel;',
    funcI4: 'verspreidt geen kopieën van het spel;',
    funcI5: 'wijzigt gamebestanden niet direct;',
    funcI6: 'bevat geen code die nodig is om Satisfactory te draaien;',
    funcI7: 'is niet vereist om het originele spel te gebruiken.',
    funcP3:
      'Om Satisfactory te spelen moet je het spel via officiële kanalen kopen en bezitten.',
    accTitle: 'Nauwkeurigheid van gegevens',
    accP1:
      'Factory Manager wordt geleverd als hulpmiddel en kan fouten, weglatingen, benaderingen, storingen of verouderde data bevatten.',
    accP2:
      'Game-updates, receptwijzigingen, balancing, nieuwe versies of Satisfactory-content kunnen informatie tijdelijk onnauwkeurig maken.',
    accP3:
      'De ontwikkelaars garanderen niet dat alle data, berekeningen, plannen of resultaten altijd volledig, correct, actueel of compatibel met de nieuwste gameversie zijn.',
    accP4: 'Controleer resultaten zelf en gebruik de software op eigen risico.',
    liabTitle: 'Beperking van aansprakelijkheid',
    liabP1:
      'Voor zover wettelijk toegestaan zijn de ontwikkelaars van Factory Manager niet aansprakelijk voor:',
    liabI1: 'rekenfouten;',
    liabI2: 'fouten in fabrieksontwerp;',
    liabI3: 'gegevensverlies;',
    liabI4: 'storingen;',
    liabI5: 'dienstonderbrekingen;',
    liabI6: 'incompatibiliteit;',
    liabI7: 'onjuiste resultaten;',
    liabI8: 'directe of indirecte schade;',
    liabI9: 'gevolgen van gebruik of onmogelijkheid tot gebruik van de software.',
    liabP2:
      'De software wordt geleverd zonder uitdrukkelijke of impliciete garanties over werking, nauwkeurigheid of geschiktheid voor een bepaald doel, voor zover de wet dit toelaat.',
    rightsTitle: 'Meldingen door rechthebbenden',
    rightsP1:
      'Als een rechthebbende meent dat inhoud in Factory Manager zijn rechten schendt, kan hij contact opnemen met de ontwikkelaars met:',
    rightsI1: 'de betrokken inhoud;',
    rightsI2: 'het vermeend geschonden recht;',
    rightsI3: 'de aard van het verzoek;',
    rightsI4: 'informatie die beoordeling vergemakkelijkt.',
    rightsP2:
      'Legitieme meldingen worden beoordeeld; inhoud kan indien nodig worden gecorrigeerd, vervangen of verwijderd.',
    rightsP3:
      'Satisfactory en alle gerelateerde merken, logo’s, afbeeldingen, assets en inhoud behoren toe aan Coffee Stain Studios AB en/of de respectieve eigenaren.',
    rightsP4: 'Alle rechten voorbehouden.',
  });
}

module.exports = {
  legalBase,
  legalDe,
  legalFr,
  legalEs,
  legalPl,
  legalPt,
  legalNl,
};
