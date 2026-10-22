# Import fails after valid preview

If background job history reports `The account no longer has permission to run this job.`, older approved accounts may have no stored `isActive` field. Normal API authentication applies the User schema default, but the previous background worker used a raw lean lookup and rejected that same account. The worker now uses the same hydrated lookup as API authentication. Explicitly inactive, unapproved, demoted or deleted accounts remain blocked.

## Existing laptop installation

1. Extract the import account repair ZIP into the existing application folder containing `Start-Sardar-Pharmacy.bat`. Keep its `scripts` subfolder structure.
2. Run `Apply-Import-Account-Fix.bat`. It backs up the original worker source, applies the narrow lookup fix, then invokes the normal launcher to rebuild changed services. Docker must be running; a rebuild may need internet.
3. Wait for successful startup. Sign out and sign in with an approved Admin or Pharmacist account.
4. Select the same Excel file and confirm the import again. A previously completed identical import is protected against duplicate application.

Do not run Reset-Pharmacy-Data or delete Docker volumes to repair this error. The helper does not alter user permissions or database contents. If it reports an unfamiliar source version, install the full updated application instead of forcing a replacement.

## Verification

`server/integration/jobPermissions.test.js` uses a disposable database to reproduce an approved legacy Admin and Pharmacist with no stored `isActive`. Each previews and imports 35 medicines through the real worker, then replays the file without duplicating records. Additional checks reject inactive, pending, demoted and missing owners and unauthorized backup jobs.
