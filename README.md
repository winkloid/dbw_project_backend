# Installationsanleitung

In dieser Datei finden Sie eine kurze Anleitung, um den Backend-Teil der Projektlösung auszuführen.

Stellen Sie zuvor sicher, dass die neueste Version von NPM und Node.js auf Ihrem Gerät installiert sind.

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

- Zum Schluss starten Sie den Backend-Teil über Ihr Terminal (immer noch im "dbw_project_backend"-Verzeichnis befindlich) über folgenden Befehl:

  - ```
    npm run dev
    ```

- Der Backend-Teil der Anwendung sollte nun über http://localhost:49749 erreichbar sein. Wenn Sie ihn wieder beenden möchten, schließen Sie entweder das entsprechende Terminal Fenster oder Drücken Sie STRG + C und bestätigen das Ende der Ausführung.