# Nightscout Authentication für React Frontend

Dieses Dokument erklärt, wie Sie Ihr React Frontend mit Nightscout authentifizieren können.

## Zwei Authentifizierungsmethoden

### ✅ EMPFOHLEN: Subject Tokens (Admin Tools)

**Vorteile:**
- ✅ Granulare Berechtigungen (nur lesen, nur schreiben, etc.)
- ✅ Kann einzeln widerrufen werden
- ✅ Sicherer für Production
- ✅ Ein Token pro Client/App
- ✅ Einfaches Format: `name-hash`

**Nachteile:**
- ⚠️ Muss über Admin-UI erstellt werden
- ⚠️ Erfordert Zugriff auf API_SECRET für die Erstellung

### ⚠️ LEGACY: API_SECRET

**Vorteile:**
- ✅ Einfach zu konfigurieren
- ✅ Funktioniert überall

**Nachteile:**
- ❌ Voller Zugriff auf alles
- ❌ Kann nicht widerrufen werden (nur durch Neustart)
- ❌ Ein Secret für alle Clients
- ❌ Keine granularen Berechtigungen

---

## Subject Token erstellen (Empfohlen)

### Schritt 1: Nightscout Admin Tools öffnen

1. **Öffnen Sie Ihre Nightscout-Instanz** in einem Browser
2. **Klicken Sie auf das Menü-Icon** (☰) oben links
3. **Wählen Sie "Administrator-Werkzeuge"** (Admin Tools)
4. **Geben Sie Ihr API_SECRET ein** (das Master-Passwort)

### Schritt 2: Neuen Subject Token erstellen

1. **Klicken Sie auf den Tab "Zugriffsschlüssel"** (Subjects/Access Keys)
2. **Geben Sie einen Subject-Namen ein** (z.B. "reactviewer")
3. **Wählen Sie die Rollen aus:**

   **Für Read-Only Zugriff (empfohlen für Viewer-Apps):**
   ```
   Subject Name: reactviewer
   Rollen: ☑ readable
   ```

   **Für Full Access (Care Portal, etc.):**
   ```
   Subject Name: reactapp
   Rollen: ☑ readable
           ☑ careportal
           ☑ devicestatus-upload
   ```

4. **Klicken Sie auf "Speichern" oder "Add"**
5. **Kopieren Sie den generierten Token**
   - Format: `subjectname-hexhash` (z.B. `reactviewer-8e0a36cbe0a79ca4`)
   - Der Token wird in der Liste angezeigt

### Schritt 3: Token im React-Projekt verwenden

**Datei: `.env.development.local`** (erstellen, falls nicht vorhanden)

```env
# Your Nightscout Backend
VITE_API_URL=https://ihre-nightscout-instanz.herokuapp.com

# Your Subject Token (from Admin Tools) - RECOMMENDED
VITE_SUBJECT_TOKEN=reactviewer-8e0a36cbe0a79ca4
```

**Wichtig:**
- Verwenden Sie `VITE_SUBJECT_TOKEN` für Subject Tokens (empfohlen)
- Verwenden Sie `VITE_API_SECRET` nur für das Master-Secret (nicht empfohlen)
- Subject Token → URL-Parameter `?token=xxx` (wie im alten Nightscout-Projekt)
- API_SECRET → `api-secret` Header mit SHA1-Hash

### Schritt 4: Dev Server neu starten

```bash
npm run dev
```

**In der Browser Console sollten Sie sehen:**
```
Using Subject Token authentication (from Admin Tools)
```

---

## Legacy API_SECRET verwenden

Falls Sie den Legacy-Ansatz verwenden möchten:

**Datei: `.env.development.local`**

```env
VITE_API_URL=https://ihre-nightscout-instanz.herokuapp.com
VITE_API_SECRET=IhrMasterAPISecret123
```

**In der Browser Console sollten Sie sehen:**
```
Using legacy API_SECRET authentication
```

---

## Token-Verwaltung

### Token widerrufen

1. **Admin Tools öffnen**
2. **Tab "Zugriffsschlüssel"**
3. **Token in der Liste finden**
4. **Klick auf "Widerrufen"**
5. **Bestätigen**

Der Token ist sofort ungültig. Das React-Frontend erhält dann `401 Unauthorized` Fehler.

### Token erneuern

Access Tokens können ein Ablaufdatum haben. Wenn ein Token abläuft:

1. **Erstellen Sie einen neuen Token** (wie oben beschrieben)
2. **Ersetzen Sie den alten Token** in `.env.development.local`
3. **Dev Server neu starten**
4. **(Optional) Widerrufen Sie den alten Token**

---

## Verfügbare Rollen

| Rolle | Beschreibung |
|-------|--------------|
| `readable` | Nur lesen - Einträge, Treatments, Profile, Device Status |
| `careportal` | Care Portal verwenden - Treatments anlegen |
| `devicestatus-upload` | Device Status hochladen |
| `api:entries:create` | Neue Einträge erstellen |
| `api:entries:update` | Einträge bearbeiten |
| `api:entries:delete` | Einträge löschen |
| `admin` | Volle Admin-Rechte |

**Für dieses React-Frontend (aktuell nur Viewer):**
- ✅ **Nur `readable` erforderlich**

**Zukünftig (mit Care Portal):**
- ✅ `readable` + `careportal`

---

## Troubleshooting

### "401 Unauthorized" Fehler

**Mögliche Ursachen:**
- Token ist abgelaufen
- Token wurde widerrufen
- Falscher Token
- Token-Format falsch

**Lösung:**
1. Neuen Token erstellen
2. `.env.development.local` aktualisieren
3. Dev Server neu starten

### "403 Forbidden" Fehler

**Ursache:**
- Token hat nicht die erforderlichen Rollen

**Lösung:**
1. Prüfen Sie, welche Rolle fehlt (siehe Fehler-Details)
2. Neuen Token mit richtigen Rollen erstellen

### Token wird als API_SECRET erkannt

**Ursache:**
- Token hat nicht das richtige Format `name-hash`
- Kein Bindestrich im Token

**Lösung:**
1. Prüfen Sie, dass Sie den kompletten Token kopiert haben
2. Subject Tokens enthalten IMMER einen Bindestrich `-`
3. Format: `reactviewer-8e0a36cbe0a79ca4`
4. Keine Leerzeichen am Anfang/Ende

### Console zeigt "Using legacy API_SECRET authentication"

**Das bedeutet:**
- Sie verwenden das alte API_SECRET
- Keine Subject Token-Authentifizierung

**Wenn Sie Subject Token verwenden wollen:**
1. Prüfen Sie, dass `VITE_API_SECRET` einen Bindestrich `-` enthält
2. Format muss sein: `name-hash`
3. Prüfen Sie auf Tippfehler
4. Dev Server neu starten

---

## Sicherheits-Best Practices

### ✅ DO's

- ✅ Verwenden Sie Access Tokens für Production
- ✅ Erstellen Sie separate Tokens für verschiedene Clients/Apps
- ✅ Verwenden Sie minimale Berechtigungen (Principle of Least Privilege)
- ✅ Setzen Sie Ablaufdaten für Tokens
- ✅ Widerrufen Sie Tokens, die nicht mehr benötigt werden
- ✅ Speichern Sie Tokens sicher (nicht in Git!)

### ❌ DON'Ts

- ❌ Committen Sie niemals `.env.development.local` in Git
- ❌ Teilen Sie niemals Ihr API_SECRET öffentlich
- ❌ Verwenden Sie nicht das gleiche Token für alle Apps
- ❌ Geben Sie nicht mehr Berechtigungen als nötig

---

## Git Ignore

**WICHTIG:** Stellen Sie sicher, dass `.env.development.local` in `.gitignore` ist!

```gitignore
# .gitignore
.env.development.local
.env.production.local
.env.local
```

`.env.development` kann committed werden (mit Beispiel-Werten), aber `.env.development.local` sollte NIEMALS in Git landen!

---

## Weitere Informationen

- [Nightscout Documentation](https://nightscout.github.io/)
- [Nightscout Admin Tools](https://nightscout.github.io/nightscout/security/)