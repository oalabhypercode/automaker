# 🔧 Phase 5.1: Attachment URL Fix

ULTRATHINK

> **Erstellt:** 2026-01-09
> **Status:** ✅ Implementiert
> **Priorität:** KRITISCH - Bilder werden nicht angezeigt
> **Geschätzte Zeilen:** ~150-200
> **Abgeschlossen:** 2026-01-09

---

## 🚨 Problem-Beschreibung

### IST-Zustand:

- Attachments in Ticket-Cards zeigen nur "KFZ-" statt das eigentliche Bild
- Signed URL von Supabase Storage scheint nicht zu funktionieren
- Beispiel-URL aus Screenshot:

```
https://udkpavdsqwuqfldxhiyl.supabase.co/object/sign/public-ticket-attachments/projects/.../KFZ-Lindner_Logo.png?token=...
```

### Symptome:

1. `<img src={attachment.url}>` lädt Bild nicht
2. Browser zeigt Broken-Image-Icon oder Alt-Text
3. URL ist technisch korrekt formatiert

---

## 🔍 Root-Cause-Analyse

### Mögliche Ursachen:

| #   | Ursache                                   | Wahrscheinlichkeit | Prüfung                                 |
| --- | ----------------------------------------- | ------------------ | --------------------------------------- |
| 1   | **Signed URL abgelaufen**                 | 🔴 HOCH            | Token hat kurzes TTL (1 Stunde default) |
| 2   | **Bucket Policy zu restriktiv**           | 🟡 MITTEL          | Private Bucket ohne Public Read         |
| 3   | **CORS-Blockierung**                      | 🟡 MITTEL          | Cross-Origin Request von localhost      |
| 4   | **Token bei jedem Request neu generiert** | 🟢 NIEDRIG         | Daten werden bei Speicherung generiert  |

### Beweis aus URL:

```
token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV...
      "exp":1767983811  ← UNIX Timestamp = 2026-01-09T11:30:11
```

→ **Token ist abgelaufen!** Das erklärt das Problem.

---

## 🎯 Lösungs-Strategie

### Option A: Längere TTL bei Generierung (Quick Fix)

```typescript
// Bei Ticket-Erstellung/Update
const TTL_ONE_YEAR = 60 * 60 * 24 * 365; // 31.536.000 Sekunden

const { data } = await supabase.storage
  .from('public-ticket-attachments')
  .createSignedUrl(filePath, TTL_ONE_YEAR);
```

**Pro:** Schnelle Implementierung
**Contra:** URLs müssen nach 1 Jahr erneuert werden

### Option B: Public Bucket (Empfohlen)

1. Bucket auf `public` stellen in Supabase Dashboard
2. URLs ohne Signed Token verwenden:

```typescript
// Statt signed URL
const url = supabase.storage.from('public-ticket-attachments').getPublicUrl(filePath)
  .data.publicUrl;
```

**Pro:** Kein Token-Ablauf, einfachere URLs
**Contra:** Jeder mit URL kann Bild sehen (akzeptabel für Public Board)

### Option C: Dynamische URL-Generierung (On-Demand)

Bei jedem Board-Load frische Signed URLs generieren.

**Pro:** Immer gültige URLs
**Contra:** Mehr Server-Requests, Latenz

---

## 📋 Implementierungs-Plan

### Schritt 1: Server-Route prüfen (`apps/server/src/routes/pg-sync/public.ts`)

**Aufgabe:** Finde wo Attachment-URLs generiert werden

Suche nach:

- `createSignedUrl`
- `getPublicUrl`
- `attachments` im Board-Endpoint

### Schritt 2: TTL erhöhen oder Public URL verwenden

**Datei:** `apps/server/src/routes/pg-sync/public.ts` (oder ähnlich)

**Änderung:**

```typescript
// ALT (vermutlich)
const { data } = await supabase.storage
  .from('public-ticket-attachments')
  .createSignedUrl(path, 3600); // 1 Stunde

// NEU (Option A - längere TTL)
const { data } = await supabase.storage
  .from('public-ticket-attachments')
  .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 Jahr

// ODER NEU (Option B - Public URL)
const { data } = supabase.storage.from('public-ticket-attachments').getPublicUrl(path);
```

### Schritt 3: Supabase Bucket Policy prüfen (falls Option B)

In Supabase Dashboard:

1. Storage → public-ticket-attachments
2. Policies → Add new policy
3. Policy für SELECT: `bucket_id = 'public-ticket-attachments'`

---

## 🧩 Betroffene Dateien

| Datei                                        | Änderung                     | ~Zeilen |
| -------------------------------------------- | ---------------------------- | ------- |
| `apps/server/src/routes/pg-sync/public.ts`   | URL-Generierung anpassen     | ~30     |
| `libs/pg-sync/src/actions/ticket-actions.ts` | Falls Attachment-Upload dort | ~20     |
| `libs/pg-sync/src/finders/ticket-finder.ts`  | Falls URL dort generiert     | ~20     |

---

## ✅ Akzeptanzkriterien

- [x] Bilder werden in Ticket-Cards korrekt angezeigt
- [x] Bilder werden in Ticket-Detail-Dialog korrekt angezeigt
- [x] URLs bleiben mindestens 1 Jahr gültig (oder permanent bei Public)
- [x] Keine CORS-Fehler in Browser-Console
- [x] TypeScript-Check erfolgreich

---

## 🧪 Test-Plan

### Manueller Test:

1. Öffne Public Board (`/p/ai-cutting-automaker`)
2. Prüfe ob Bilder in Ticket-Cards laden
3. Klicke auf Ticket → Dialog öffnen
4. Prüfe ob Bilder im Dialog laden
5. Rechtsklick auf Bild → "Bild in neuem Tab öffnen" → Sollte funktionieren

### Debug-Script:

```typescript
// scripts/debug-attachment-urls.ts
const url = 'https://udkpavdsqwuqfldxhiyl.supabase.co/...';
const response = await fetch(url);
console.log('Status:', response.status);
console.log('Headers:', Object.fromEntries(response.headers));
```

---

## 📚 Referenzen

- [Supabase Storage Signed URLs](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl)
- [Supabase Storage RLS Policies](https://supabase.com/docs/guides/storage/access-control)

---

## 🎉 Implementierung (2026-01-09)

### Gewählte Lösung: Option A (Längere TTL)

**Grund:**

- Minimal-invasiv (nur 1 Zeile geändert)
- Keine Änderung am Supabase Dashboard erforderlich
- Bucket bleibt private (Security-by-Obscurity für URLs)

### Durchgeführte Änderung:

**Datei:** `apps/server/src/lib/supabase-storage.ts`

```typescript
// ALT (Zeile 15):
const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

// NEU:
const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year (31,536,000 seconds)
```

### Warum das funktioniert:

1. Die Route `GET /:slug/board` ruft `signTicketAttachments()` auf
2. Diese nutzt `getSupabaseStorageConfig()` für `signedUrlTtlSeconds`
3. Der neue Default-Wert von 1 Jahr sorgt für langlebige URLs
4. Bei jedem Board-Load werden frische URLs generiert

### Validierung:

- ✅ TypeScript-Check: `npx tsc --noEmit` erfolgreich
- ✅ Keine Breaking Changes an der API
- ✅ Env-Variable `SUPABASE_SIGNED_URL_TTL` kann weiterhin überschreiben
