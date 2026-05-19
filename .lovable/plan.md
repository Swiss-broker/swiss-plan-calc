
## Objectif

Ajouter un onglet **« Documents »** dans la fiche client. Le courtier génère un **lien sécurisé** à envoyer au client (email/WhatsApp/SMS). Le client ouvre le lien sans créer de compte, choisit une catégorie et dépose ses fichiers. Tout atterrit directement dans la fiche, organisé par catégories.

## Catégories fixes

```text
- Attestation LPP / certificat de prévoyance
- Fiche de salaire
- Déclaration fiscale / taxation
- Pièce d'identité (CI, passeport, permis)
- Police 3e pilier (3a / 3b)
- Police LCA / assurance vie
- Certificat AVS / AI
- Documents bancaires
- Autres
```

## Architecture

### Stockage
- Nouveau bucket **privé** `client-documents` (pas d'accès anonyme).
- Chemin : `{broker_id}/{client_id}/{category}/{uuid}_{filename}`.

### Tables Supabase
- **`client_documents`** : un enregistrement par fichier
  - `client_id`, `broker_id`, `category`, `original_filename`, `storage_path`, `mime_type`, `size_bytes`, `uploaded_by` (`broker` ou `client_link`), `upload_link_id` (nullable).
  - RLS : le courtier voit/gère ses propres docs (`auth.uid() = broker_id`).
- **`client_document_links`** : un lien d'upload par client
  - `client_id`, `broker_id`, `token` (random 32 chars), `expires_at` (défaut 14j), `revoked`, `max_uploads` (défaut 30), `upload_count`, `created_at`, `last_used_at`.
  - RLS : le courtier gère ses propres liens.

### Endpoints publics (server routes TanStack, pas d'auth utilisateur)
- `GET /api/public/client-upload/:token` → valide le token, retourne `{ clientName, brokerName, allowedCategories, expiresAt }`. Pas de PII sensible.
- `POST /api/public/client-upload/:token` → reçoit `multipart/form-data` (fichier + catégorie), valide :
  - token non révoqué/expiré
  - quota `upload_count < max_uploads`
  - taille max 20 MB par fichier
  - types MIME autorisés : PDF, JPG, PNG, WEBP, HEIC
  - nom du fichier sanitizé
  - upload via `supabaseAdmin` dans `client-documents`, insertion ligne `client_documents` avec `uploaded_by = 'client_link'`.
- Pas de retour de signed URL au client (il ne reverra pas ses fichiers, c'est unidirectionnel).

### Server functions (côté courtier, auth)
- `listClientDocuments(clientId)` → liste + signed URLs (10 min) pour preview/téléchargement.
- `deleteClientDocument(documentId)` → supprime ligne + fichier storage.
- `createUploadLink(clientId, { expiresInDays, maxUploads })` → crée un lien, retourne URL complète `https://.../client-upload/{token}`.
- `listUploadLinks(clientId)` / `revokeUploadLink(linkId)`.
- `uploadClientDocumentAsBroker(clientId, category, file)` — bonus, au cas où le courtier veuille aussi déposer lui-même (option 3 dans le futur, on garde la fonction prête).

## UI courtier

Nouvel onglet **« Documents »** dans `src/routes/_app/clients/$clientId.tsx`, à côté des onglets existants.

Contenu :
1. **Bloc « Lien client »** en haut
   - Bouton « Générer un lien d'upload » → ouvre une modale (durée 7/14/30 jours, max fichiers 10/30/50).
   - Affiche le lien actif s'il existe : URL copiable, bouton WhatsApp prérempli, bouton e-mail prérempli, statut (X fichiers reçus / N restants, expire le ...), bouton « Révoquer ».
2. **Liste des documents** groupée par catégorie (accordéon).
   - Par ligne : icône type, nom du fichier, taille, date, source (badge « 📤 client » ou « 👤 courtier »), boutons Aperçu / Télécharger / Supprimer.
   - Aperçu PDF/image inline dans une modale via signed URL.
3. **Compteur global** : « 8 documents dans 4 catégories ».

## UI client (page publique)

Nouvelle route publique `src/routes/client-upload.$token.tsx` (hors `_app`, pas d'auth).
- Header brandé : nom du courtier + logo (récupéré via le endpoint public).
- Phrase d'accroche : « Bonjour {prénom du client}, déposez ici les documents demandés par {courtier}. »
- Sélecteur de catégorie (les 9 catégories).
- Zone drag-and-drop + sélecteur de fichier (multi-fichiers).
- Progression d'upload par fichier, message succès/erreur clair.
- Liste des fichiers déjà envoyés dans la session (juste pour confirmation visuelle, pas de relecture).
- Pas de listing des anciens uploads (sécurité).
- Si lien expiré/révoqué/quota atteint : écran d'erreur clair « Lien invalide, contactez votre courtier ».

## Sécurité

- Bucket privé, jamais d'URL publique directe.
- Token de lien généré côté serveur (32 chars, crypto-random).
- Validation MIME stricte côté server route (pas seulement extension).
- Limite 20 MB par fichier, 30 fichiers par lien par défaut.
- Filename sanitization (regex `[^a-zA-Z0-9._-]` → `_`).
- Rate limiting simple : max 10 uploads / minute par token (compteur in-memory dans le handler).
- Aucun PII renvoyé sur l'endpoint public hors prénom du client et nom du courtier.
- Signed URLs côté courtier expirent en 10 min.

## Intégration synthèse PDF

Optionnel mais utile : dans le PDF de synthèse client déjà existant, ajouter une section « Documents au dossier » qui liste les noms de fichiers par catégorie (sans les fichiers eux-mêmes, juste l'inventaire). Le courtier voit d'un coup d'œil ce qu'il a reçu.

## Hors scope (à voir plus tard si tu veux)

- Notifications email/push au courtier quand le client dépose un fichier.
- Aperçu / annotation des PDF.
- Versionning (remplacement vs nouveau fichier).
- Signature électronique.

## Vérification

- Créer un lien, l'ouvrir en navigation privée, déposer un PDF → vérifier qu'il apparaît dans la fiche.
- Tenter d'uploader un .exe → refusé.
- Tenter un fichier > 20 MB → refusé.
- Révoquer le lien, retenter → écran d'erreur.
- Supprimer un document côté courtier → fichier disparaît du storage aussi.
