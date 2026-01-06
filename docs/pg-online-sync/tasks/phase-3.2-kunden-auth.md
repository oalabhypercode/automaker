# 🔐 Phase 3.2: Kunden-Auth (Passwort)

ULTRATHINK

> **Status:** ⏳ Offen
> **Abhängigkeiten:** Phase 3.1 (URLs)
> **Geschätzte Komplexität:** Mittel

---

## 🎯 Ziel dieser Phase

Implementierung eines **einfachen Authentifizierungs-Schutzes** für öffentliche Boards.
Kunden sollen sich mit einem **Projekt-Passwort** einloggen müssen, bevor sie das Board sehen können. Dies ist kein voller User-Account, sondern ein Shared-Password-Mechanismus.

Wichtige Aspekte:

- Passwort-Hash Speicherung (Argon2/Bcrypt)
- Login-Screen vor Board-Zugriff
- Session-Management via Cookie (`customer-token`)
- Logout-Funktion

---

## ❓ Proaktive F&A

### Q1: Warum keine echten User-Accounts für Kunden?

✅ **Einfachheit & Hürde:**
Viele Kunden wollen sich nicht registrieren. Ein Passwort, das per E-Mail geteilt wird, ist die geringste Hürde und für den Anwendungsfall (Projekt-Status checken) oft ausreichend.

### Q2: Wie sicher ist das?

✅ **Standard-Verschlüsselung:**
Das Passwort liegt gehasht in der DB. Die Session läuft über ein signiertes HttpOnly Cookie (JWT). Brute-Force-Protection (Rate Limiting) sollte beachtet werden.

### Q3: Muss jedes Projekt ein Passwort haben?

✅ **Optional:**
Projekte können auch komplett öffentlich sein (`is_public: true` UND `password_protected: false`), aber der Standardfall für Kundenprojekte ist Passwortschutz.

---

## 🏛️ Architektur & Datenfluss

### Login Flow

```
User besucht /p/slug
      │
      ▼
┌──────────────┐
│  Middleware  │
└──────┬───────┘
      │
      ├─► Kein Passwort nötig? ──► Zeige Board
      │
      ├─► Hat gültiges Cookie? ──► Zeige Board
      │
      ▼
 Zeige Login-Formular
      │
      │ (Input Password)
      ▼
┌──────────────┐       ┌──────────────┐
│  API Route   │ ──►   │  Postgres DB │
│ /api/auth/   │ Check │ (Hash check) │
│ customer     │       └──────────────┘
└──────┬───────┘
      │ OK
      ▼
  Set Cookie
  Redirect -> /p/slug
```

---

## 📋 Anforderungen

### Datenmodell

Erweiterung der `projects` Tabelle (oder `project_auth` Table):

| Feld               | Typ     | Beschreibung               |
| ------------------ | ------- | -------------------------- |
| `password_hash`    | text    | Gehashtes Projekt-Passwort |
| `password_enabled` | boolean | Ob Schutz aktiv ist        |

### Security

- **Hashing:** Nutzung von `bcrypt` oder `argon2` via Node-Module.
- **Cookie:** `project_session_[projectId]` oder Sammel-Token.
- **Expiration:** Session valid für z.B. 30 Tage.

---

## 💻 Implementation Details

### 1. Action: `validateProjectPassword`

Datei: `libs/pg-sync/src/actions/auth-actions.ts`

```typescript
export async function validateProjectPassword(projectId: string, plain: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { passwordHash: true },
  });

  if (!project?.passwordHash) return false;

  return await verifyHash(plain, project.passwordHash);
}
```

### 2. UI: `CustomerLoginForm`

Datei: `apps/web/src/components/auth/customer-login-form.tsx`
Ein schickes, reduziertes Formular, zentriert auf dem Bildschirm.

- Input: password
- Button: "Zugang freischalten"

### 3. Middleware Update

Datei: `apps/web/src/middleware.ts`
Die Middleware muss erkennen:

1. Ist es eine `/p/*` Route?
2. Braucht das Projekt Auth? (Ggf. via Edge Config oder DB check - Achtung Performance. Alternativ: Check in `page.tsx` und Redirect wenn nötig, ist einfacher für SSR.)

**Strategie:** Check in `page.tsx`.

```tsx
// page.tsx
if (project.passwordEnabled) {
  const cookie = cookies().get(`auth-${project.id}`);
  if (!isValid(cookie)) {
    return <CustomerLoginScreen project={project} />;
  }
}
```

_Anmerkung: Das Rendern des Login-Screens direkt in der Component verhindert unnötige Redirects._

---

## 🧩 Modifizierte Dateien

### Neue Dateien

| Datei                                                  | Zweck                         | ~Zeilen |
| ------------------------------------------------------ | ----------------------------- | ------- |
| `apps/web/src/components/auth/customer-login-form.tsx` | UI Komponente                 | ~80     |
| `apps/web/src/actions/customer-auth.ts`                | Server Actions (Login/Logout) | ~60     |

### Erweiterungen

| Datei                                         | Zweck                  | ~Zeilen |
| --------------------------------------------- | ---------------------- | ------- |
| `apps/web/src/app/(public)/p/[slug]/page.tsx` | Auth-Logik integrieren | +30     |
| `libs/pg-sync/src/db/schema.ts`               | `passwordHash` Feld    | +5      |

---

## ✅ Abschlusskriterien

- [ ] Admin kann im internen Bereich ein Passwort für ein Projekt setzen (Update Action).
- [ ] Zugriff auf `/p/slug` wird blockiert, wenn Passwort aktiv und kein Cookie da ist.
- [ ] Login funktioniert, setzt Cookie.
- [ ] Nach Login ist Board sichtbar.
- [ ] Cookie ist HttpOnly und Secure.
- [ ] Passwort-Hash wird sicher in DB gespeichert.

---

## 🔗 Referenzen

- `phase-3.1-projekt-urls.md`
- `libs/pg-sync` Auth Utilities
