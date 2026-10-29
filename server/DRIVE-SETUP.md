# Google Drive photo exchange

The primary flow is **staff delivers an original Drive folder → customer selects from those delivered files → customer submits filenames, Drive file IDs and edit notes → retoucher returns an edited folder**. There is no customer input for arbitrary original-file links and no shared demo gallery substituted for an undelivered album.

In Admin → Quản lý chụp & chỉnh ảnh, the photographer enters the customer's account phone, shoot order code and original Drive folder, reads the folder, reviews the filenames, then sends the album. This is available before an editing request exists. The customer sees their delivered albums under Ảnh của tôi, with a folder preview and an in-app selectable grid. Customer selection comes from the delivered manifest; the folder iframe is only a preview and cannot report selections across origins.

To enable Google access, set `window.AlohaDriveConfig` before loading `js/drive.js` (on both index.html and crm/admin.html):

```js
window.AlohaDriveConfig = {
  clientId: 'YOUR_WEB_OAUTH_CLIENT_ID',
  apiKey: 'YOUR_BROWSER_API_KEY',
  appId: 'YOUR_GOOGLE_CLOUD_PROJECT_NUMBER'
};
```

Enable Google Drive API; configure the OAuth consent screen, the `drive.readonly` scope and authorized JavaScript origins for the website (serve through HTTP/HTTPS, not file:// for real OAuth). Folder import uses a Google read-only token, filters image files directly inside the chosen folder and follows all pagination tokens. Tokens remain in memory, never in storage or request/chat payloads. The customer can connect their own Google account to view private files shared with them. Private image blob URLs are local to that session and are revoked when switching albums. Production OAuth may require Google's verification for the requested scope.

Optional chat attachments still use Picker (`drive.file`); enable Picker API and provide apiKey/appId for that separate feature.

Drive permissions remain controlled by the owner. Before delivery, share the original folder with the customer's Google account. Sending an album does not make originals public or grant Drive access. API album records are owner-scoped; editing requests must reference an album belonging to that same customer and order, and every selected file must occur in its delivered manifest. The server supplies authoritative filenames and original-file URLs from the manifest. Source album records share the edit-request store but are filtered out of request queues; existing request-only internal resultLinkOriginal remains separate.

References: https://developers.google.com/workspace/drive/api/guides/search-files and https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list

Pricing: first submitted round per order includes up to 10 photos, with additional photos at 50,000 VND each. Subsequent rounds charge 50,000 VND per requested photo and require the previous round to be completed. Requests retain their parent ID and round number. Server API computes fees; the existing payment confirmation mechanism is unchanged. Browser-local demo data does not synchronize between devices. The creation lock is process-local; multiple server instances require a database transaction/unique constraint for cross-instance concurrency.
