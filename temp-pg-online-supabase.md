Zielbild: Automaker (Offline-First) + Fosco + zentrale Projekt-Übersicht

Du willst das bestehende offline funktionierende Kanban-System so erweitern, dass es zusätzlich eine zentrale, online erreichbare Datenquelle gibt (Postgres via Coolify/Supabase), ohne den Offline-Workflow kaputt zu machen.

Kernprinzip:

Alle arbeiten weiterhin offline (lokales Kanban bleibt “Source of Work”).

Online dient als gemeinsamer Verlauf / Austauschpunkt für:

wer hat was gemacht

welcher Status ist aktuell

was wurde neu erstellt (z. B. von dir oder Kunden)

Sync geschieht über Push & Pull (manuell oder periodisch).

Begriffe / Boards (3 Ansichten)

1. Lokales Team-Board (pro Mitarbeiter)

Jeder Mitarbeiter hat sein eigenes Offline-Board.

Arbeit und Änderungen passieren primär lokal.

Beim Sync werden Änderungen in die zentrale DB gepusht und Updates aus der DB gepullt.

2. Öffentliche Web-Oberfläche intern (Projekt-Board für euch)

Eine online Web-UI für ein Projekt (X/Y/Z), die den aktuellen Stand zeigt.

Dort kannst du (oder intern) Tickets online erstellen, die dann beim nächsten Pull in die Offline-Boards der Mitarbeiter erscheinen.

3. Kunden-Board (vereinfachte öffentliche Projekt-Seite)

Jedes Projekt hat eine öffentliche Subseite für Kunden.

Kunde sieht ein vereinfachtes Kanban, das verständlich ist (nicht zu technisch).

Kunde kann eigene Tickets erstellen, die dann bei eurem Pull bei euch landen.

Phase 1 — Zentrale Datenbasis + Basis-Sync (Push/Pull)
Ziel

Eine Postgres-DB (z. B. via Coolify) als zentrale Stelle, in die alle schreiben und aus der alle lesen können, während jeder weiterhin offline arbeitet.

Anforderungen (funktional)

Mehrere Projekte (Projekt X, Y, Z).

Pro Projekt mehrere User/Mitarbeiter.

Beim Sync wird festgehalten:

Ticket erstellt / geändert / verschoben

Statusänderung (Todo → In Progress → Done etc.)

wer die Änderung gemacht hat

wann es passiert ist

Push: Mitarbeiter “schiebt” seine abgeschlossenen/aktuellen Änderungen in die DB.

Pull: Mitarbeiter “holt” Updates rein (z. B. neue Tickets, Statusänderungen, neue Kommentare etc.).

Optional: Auto-Pull z. B. jede Stunde (Timer).

Anforderungen (Konfiguration)

Es muss konfigurierbar sein:

welcher User gehört zu welchem Projekt

welche Projekte existieren

(optional) Rollen/Permissions: Admin, Mitarbeiter, Kunde

Ergebnis von Phase 1

Du hast Überblick, wer woran arbeitet.

Es gibt einen gemeinsamen Verlauf pro Projekt.

Die Offline-Boards bleiben benutzbar, auch ohne Internet.

Phase 2 — Interne Web-UI: Tickets online erstellen + “In Bearbeitung”-Schutz
Ziel

Du kannst über eine Web-Oberfläche Tickets in einem Projekt erstellen, und Mitarbeiter können diese beim Pull sehen. Außerdem gibt es einen Lock/Claim-Mechanismus, damit nicht mehrere gleichzeitig an einem Ticket arbeiten.

Anforderungen (funktional)

Online Ticket erstellen (im Projektboard):

Titel, Beschreibung, Priorität (optional)

ggf. Labels/Tags

Zuordnung zu Projekt

Mitarbeiter pullt → Ticket erscheint bei ihm lokal.

Mitarbeiter setzt Ticket auf “In Bearbeitung”:

dieser Status wird sofort gepusht

alle anderen sehen: Ticket ist gesperrt/claimed

Abschluss:

Mitarbeiter setzt Ticket auf “Done”

push → alle sehen den Abschluss

Locking/Claiming Regeln (wie du es beschrieben hast)

Sobald ein Mitarbeiter ein Ticket auf In Bearbeitung setzt, gilt:

nur dieser kann daran “offiziell” arbeiten

andere sollen es nicht parallel bearbeiten (Schutzmechanismus über Status/Lock)

Wenn jemand anders pullt, sieht er den Claim-Status.

Ergebnis von Phase 2

Du kannst zentral Tickets “reinschieben”.

Ihr verhindert Doppelarbeit über “In Bearbeitung”-Claiming.

Phase 3 — Kunden-Board: öffentliche Projektseite + simples Kanban + Ticket-Eingang
Ziel

Für jedes Projekt existiert eine öffentliche Subseite, die ein Kunde (nach Auth) nutzen kann, um:

den Fortschritt zu sehen

eigene Tickets einzustellen

Anforderungen (Zugriff/Auth)

Pro Projekt eine URL/Subseite.

Zugang über einfaches Passwort (dein Wunsch: “am besten nur ein Passwort”).

Nach Login sieht der Kunde nur projektbezogene Daten.

Anforderungen (UI/UX)

Kunden-Ansicht ist abgespeckt & verständlich:

weniger technische Felder

klare Statusspalten

Fokus auf “Was passiert gerade?”

Kunde kann Tickets erstellen:

Titel + kurze Beschreibung

optional: Kategorie (Bug/Feature/Frage)

Diese Tickets landen in der gleichen zentralen DB und sind beim nächsten Pull für euch sichtbar.

Ergebnis von Phase 3

Kunde kann direkt Arbeit “einwerfen”.

Kunde sieht transparent den Projektfortschritt, ohne euer internes Tool verstehen zu müssen.

Datenmodell (high-level, damit das Ganze sauber zusammenpasst)

Du brauchst (konzeptionell) mindestens:

Project

id, name, publicSlug (für Subseite), …

User

id, name, role (Admin/Mitarbeiter/Kunde), …

ProjectMember

projectId, userId, role im Projekt

Ticket

id, projectId, title, description, status, createdBy, assignedTo/claimedBy, timestamps

TicketEvent / ActivityLog

ticketId, projectId, type (created/moved/claimed/done/comment), payload (was genau), createdBy, createdAt

SyncState (pro Client/Device)

clientId, lastPulledAt/lastEventId, etc. (damit Pull “inkrementell” geht)

(Das ist kein Code, nur die Struktur der “Sachen”, die ihr später speichert.)

Sync-Flow (Push/Pull) so wie du ihn willst
Push

Offline-Änderungen → werden als Events oder “Änderungen” in die zentrale DB geschrieben.

Typische Push-Trigger:

Ticket abgeschlossen

Status geändert (inkl. Claim)

Ticket wurde lokal erstellt (optional)

Pull

Client fragt: “Was ist seit meinem letzten Stand passiert?”

Holt:

neue Tickets (von dir online oder vom Kunden)

Statusupdates anderer

Claimed/Done/Kommentare

Übernimmt sie in die lokale DB.

Optional

Auto-Pull (z. B. jede Stunde), zusätzlich zu manuellem Pull.

Wiederverwendung (wichtig, damit ihr nicht 3 Apps neu baut)

Was du sehr gut wiederverwenden kannst:

Kern-Ticketmodell + Statuslogik (einmal sauber bauen)

Sync-Mechanismus (Push/Pull Engine) für alle Clients

Project/Member/Permissions als gemeinsame Basis

UI-Komponenten für Kanban (Spalten, Karten, Drag/Drop), dann nur “Feature Flags”:

intern voll

lokal voll (offline)

Kunde abgespeckt (weniger Felder/Buttons)

Bevor das alles implementiert wird, müssen wir dafür sorgen, dass bei den Änderungen, wenn wir etwas ändern, dann so, dass wir quasi sehr wenig ändern. Was heißt das? Damit wir nicht auf Merge-Konflikte kommen. Weil dieses Projekt Automaker ist quasi ein Public Repo, aber ich möchte quasi, ich habe jetzt einen Fork, ich möchte das so umprogrammieren, dass es nur minimale Änderungen hat, so dass wir nicht starke Merge-Konflikte bekommen. So, was meine ich damit? Wenn wir irgendwas speichern, dann speichern wir das auch gleichzeitig in Postgres, aber wir sorgen dafür, dass nur eine Zeile hinzugefügt wird und weisen quasi, also eine Methode in da, wo wir quasi was ausführen, wo wir lokal was speichern, da quasi rufen wir noch unsere Methode auf, die aber quasi in einer anderen Klasse ist. Also wir ergänzen nur Klassen, wir versuchen den jetzigen Code nur so wenig wie möglich anzupassen. Also wir erweitern nur durch neue Klassen, so was halt, neue Ordner, so stelle ich mir das vor. Jetzt ist natürlich die Frage, was wäre der beste Ansatz? Also wie gehen wir jetzt vor? Also natürlich die Architektur ist jetzt wichtig. Natürlich haben wir das Public-Projekt, was quasi über Postgres läuft, also Superbase. Und, also was meine ich mit Public? Auf die öffentliche, zugängliche URL, also wenn man das deployed quasi. Richtig. Und da ist jetzt die Frage, wie machen wir das? Machen wir das mit Submodules? Wie wäre es am sinnvollsten? Ist der Automaker ein Submodul? Wird das andere Projekt ein Submodul? Oder machen wir das mit einem getränkten Ordner? Wie würdest du das am besten technisch lösen, sodass du auch als KI das Ganze einfach erweitern kannst? Aber gleichzeitig, dass es getrennt haben wird, aber auch wiederverwendet. Wir haben ja auch ein Kanban-Board, wir müssen halt schauen, was können wir wiederverwenden? Natürlich, das muss halt abgespeckter sein. Der öffentliche, zugängliche ist quasi Dark. Das kann noch, sage ich mal, etwas komplexer sein. Aber das Ziel ist es immer lokal zu arbeiten. In dem öffentlichen packen wir nur Sachen rein, aber wir programmieren nicht wirklich. Der öffentliche soll nur ein Kanban-Board sein. Und das Dependency-Graph am besten auch. Was so alles gelöst worden ist. Ich hoffe, du verstehst, was ich meine. Und dann gibt es quasi nochmal die abgespecktere Version, die quasi für Kunden bereitgestellt werden. Über eine URL oder so. Von bestimmten Projekten. Also wir müssten dann auch mit Search-Params arbeiten, was am besten ist. Beispielsweise haben wir ein Projekt. XYZ-Projekt heißt Finance-Dashboard, das andere Projekt heißt Einkaufssagen. Wie würden dazu die URLs aussehen? Also die öffentlich zugänglichen und die öffentlich zugänglichen für alle Mitarbeiter von uns. Aber auch eine öffentlich zugängliche für Kunden, die quasi auch darüber den Kanban-Board einfügen. Die kommen dann bei uns rein. In den öffentlichen sehen wir die Instant, aber wir müssen die quasi lokal pullen. Was wäre die beste Architektur dafür? Was würdest du hier empfehlen? Versuche dir alle Optionen zu überlegen und dann gib mir die beste Option, was quasi für dich einfach ist zu erweitern. Und wo die Fehleranfälligkeit auch gering ist. Quasi, dass wir, wenn wir das jetzige Projekt Automaker erweitern, dass wir auch direkt wissen, das müssen wir vielleicht in der Postgres-Datenbank eventuell fliegen oder auch nicht. Kommt drauf an. Und was halt wenig Merch-Konflikte verursacht, weil ich pulle immer von Automaker, von dem Git-Repository, was public ist, immer weil ich einen Fork habe. Verstehst du, was ich meine?

Wichtig ist, finder dateien, actions dateien, viel auszulagern, clean code, gute namen für finder, actions, gute Architektur, jede Datei unter 700 Zeilen code

Versuche diese datei immer mit in den chat in jeder phase anzubringen um groben überblick zu verschaffen worum es geht, natürlich auch die globale planung, als auch der aktuelle-task also 3 planungen sollen quasi immer zu jedem chat anfang referenziert werden

Auch wichtig, was ist wiederverwendbar für die öffentlichen Urls, 1x für alle Mitarbeiter, und mehrere für Kunden bzw für jedes Projekt eine URL
Der öffentliche für mitarbeiter, da drüber kann man über einen dropdown alle projekte einsehen ohne urls zu wechseln also am besten wie das jetzige offline
