# Installationsanleitung

In dieser Datei finden Sie eine kurze Anleitung, um den Backend-Teil der Projektlösung auszuführen.

Stellen Sie zuvor sicher, dass eine aktuelle Version von NPM und Node.js auf Ihrem Gerät installiert sind.

- Sie können die Installation von Node.JS in einem Terminalfenster mit folgendem Befehl prüfen:

  - ```
    node --version
    ```

- Sie können die Installation von NPM (Node Package Manager) in einem Terminalfenster mit folgendem Befehl prüfen:

  - ```
    npm --version
    ```

- sollten Node.js oder NPM nicht installiert sein, so können Sie beide Softwares über folgenden Link beziehen: https://nodejs.org/de/download/

Außerdem sollte eine MongoDB-Serverinstanz lokal auf Ihrem Gerät laufen und über den MongoDB-Standardport kontaktierbar sein. Der MongoDB-Community-Server ist unter https://www.mongodb.com/try/download/community verfügbar.

- **Hinweis**: Wenn die MongoDB-Instanz über eine Verbindungs-URL erreichbar ist (Details hierzu im weiteren Verlauf der Anleitung), ist auch kein weiteres Skript zur Initialisierung der Datenbank erforderlich. Entsprechend der Verbindungs-URL zur MongoDB-Instanz wird meine Projektlösung selbst eine Datenbank und die darin einzupflegenden Collections und Dokumente anlegen. Mehr Hinweise im folgenden Abschnitt.

## 1. Installation der Dependencies

Alle Dependencies der Projektlösung sind in dbw_project_backend/package.json aufgeführt. Um diese automatisch durch NPM installieren zu lassen, navigieren Sie zunächst in den Projektordner des Backend-Teils der Projektlösung. Hierzu können Sie unter Windows beispielsweise Windows PowerShell verwenden:

- Öffnen Sie ein Terminalfenster

- Navigieren Sie mithilfe des cd-Befehls in das "dbw_project_backend"-Verzeichnis, z.B.:

  - ```
    cd C:\Users\MaxMustermann\Downloads\dbw_project_backend
    ```

- Führen Sie in diesem Verzeichnis über Ihr Terminal nun den folgenden Befehl aus:

  - ```
    npm install
    ```

- Sie sollten nun ein neues Verzeichnis "node_modules" innerhalb des "dbw_project_backend"-Verzeichnisses sehen, in dem die Dateien der notwendigen Dependencies enthalten sind.

- Legen Sie im Root des "dbw_project_backend"-Verzeichnisses eine neue Datei namens ".env" an (ohne Anführungszeichen). Darin fügen Sie die Verbindungs-URL zu Ihrer MongoDB-Instanz, sowie Ihren Benutzername und Ihr Passwort für die Anmeldung beim Web-Trust-Center der TU Chemnitz nach folgendem Schema ein und speichern die Datei anschließend:

  - ```
    MONGODB_CONNECTION_STRING = "mongodb://127.0.0.1:27017/dbw_project_winkler"
    WTC_PASSWORD="<Ihr WTC-Paswort>"
    WTC_USERNAME="<Ihr WTC-Benutzername>"
    ```

  - Hinweise zum MONGODB_CONNECTION_STRING:

    - der erste Teil des Strings (im Beispiel: "mongodb://127.0.0.1:27017") gibt an, unter welcher Adresse die MongoDB-Instanz erreichbar ist.

    - der Name der eigentlichen Datenbank, die die Webanwendung darin erstellen soll, wird durch den zweiten Teil des Strings bestimmt. Im Beispiel wird eine Datenbank mit dem Namen "dbw_project_winkler" angelegt.
      - Bitte stellen Sie sicher, dass noch keine andere Datenbank mit dem im zweiten Teil des Connection-Strings angegebenen Datenbanknamen über Ihre MongoDB-Instanz läuft

- Zum Schluss starten Sie den Backend-Teil über Ihr Terminal (immer noch im "dbw_project_backend"-Verzeichnis befindlich) über folgenden Befehl:

  - ```
    npm run dev
    ```

- Der Backend-Teil der Anwendung sollte nun über http://localhost:49749 erreichbar sein. Wenn Sie ihn wieder beenden möchten, schließen Sie entweder das entsprechende Terminalfenster oder drücken Sie STRG + C und bestätigen das Ende der Ausführung.