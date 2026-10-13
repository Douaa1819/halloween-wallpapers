# Cute Halloween wallpapers

## Add a wallpaper

1. **Upload** the image to `source/images/` (**Add file → Upload files**), named like `pumpkin-party.jpg`: lowercase letters, numbers and dashes, portrait, at least 1290×2796.
2. **Edit** `source/catalog.json` (✏️) and add to `"wallpapers"`:
   ```json
   {
     "id": "pumpkin-party",
     "title": "Pumpkin Party",
     "collectionId": "cute-halloween",
     "tone": "ember",
     "tags": ["pumpkin", "halloween"],
     "addedAt": "2026-10-13"
   }
   ```
   - `id` = the file name without its extension
   - `collectionId` = the `id` of a collection (below)
   - `tone`: `midnight`, `ember`, `ocean`, `bloom`, `forest` or `mono`
   - Put a comma between entries
3. **Commit changes** → **Create a new branch and start a pull request** → **Create pull request**.

✅ on the pull request means it's valid. Once merged, it goes live automatically.

## Add a collection (do this before the first wallpaper)

Add to `"collections"` in the same file. `coverWallpaperId` must be a wallpaper that exists:
```json
{ "id": "cute-halloween", "title": "Cute Halloween", "description": "Friendly ghosts, pumpkins and cozy spooky nights.", "coverWallpaperId": "pumpkin-party" }
```

**Never rename or reuse an existing `id`.**

## First-time setup (maintainer)

Firebase project: `cute-halloween-92203`. The site goes live at `https://cute-halloween-92203.web.app`
(manifest: `/v1/manifest.json`, privacy policy: `/privacy.html`, `/app-ads.txt`).

1. Create the GitHub repo, then run `firebase init hosting:github` here. It adds the deploy key to the repo as the
   secret `FIREBASE_SERVICE_ACCOUNT_CUTE_HALLOWEEN_92203`, which the workflows already use.
2. Every push or merge to `master` then builds and deploys automatically.
