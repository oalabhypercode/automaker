# 📎 Phase 3.6: Kunden-Uploads (Supabase Storage)

ULTRATHINK

> **Status:** ✅ Implementiert
> **Abhängigkeiten:** Phase 3.4 (Kunden-Ticket-Eingang), Phase 0.2 (Supabase Setup)
> **Geschätzte Komplexität:** Mittel

---

## 🎯 Ziel dieser Phase

Kunden sollen beim Ticket-Erstellen **Bilder hochladen** können.
Die Dateien werden in **Supabase Storage** gespeichert, die Metadaten im Postgres-DB-Teil.

---

## ✅ Ergebnis (umgesetzt)

- Neues DB-Model: `ticket_attachments`
- Public API erweitert:
  - Ticket-Create akzeptiert `attachments[]` (Base64)
  - Board liefert Attachments mit **Signed URLs**
- UI: Kunden-Formular mit Bild-Upload + Attachment-Vorschau

---

## 🔧 Konfiguration (Server)

`.env` (apps/server):

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=public-ticket-attachments
SUPABASE_SIGNED_URL_TTL=3600
```

---

## 📌 Hinweise

- Uploads laufen **serverseitig** über den Service Role Key.
- Signed URLs sind kurzlebig und werden bei Board-Reload neu erzeugt.
