# Vendored spreadsheet dependency

`xlsx-0.20.3.tgz` is the unmodified SheetJS CE archive from the official vendor:
https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz

Installation guidance: https://docs.sheetjs.com/docs/getting-started/installation/nodejs/

The npm registry release is older. package.json pins this local archive and package-lock.json records its integrity. Preserve the archive and its included license when copying or building this project. Docker copies vendor/ before installing dependencies.
