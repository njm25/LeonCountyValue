# Leon County Value

An interactive map of **every taxable parcel in Leon County, Florida, colored by market value**.

- **Zoomed out:** value zones — census blocks and block groups shaded by the average market value of the parcels inside them. Hover for the summed market value, land value, and parcel count; click to zoom in.
- **Zoomed in:** live lot lines pulled straight from the county parcel server — click any lot for owner, market/land/building value, taxable value, taxes, year built, living area, acreage, and the last two sales.

Built with [MapLibre GL JS](https://maplibre.org/) + [Vite](https://vitejs.dev/). Static site, no backend.

## Data sources

- **Parcel values & attributes** — Leon County Property Appraiser, via the Tallahassee–Leon County GIS "intervector" ArcGIS server (`TLC_OverlayRegionalParcel_D_SP`, the *Leon Parcels* layer). Value field `PYR_MARKET` = prior-year certified market value. Fetched live for the lot-level view; aggregated into zones for the countywide view.
- **Zone boundaries** — U.S. Census Bureau TIGERweb (2020 census blocks and block groups, Leon County / FIPS 12073).
- **Basemap imagery** — Esri World Imagery.

Countywide totals (from the parcel layer): ~112,000 valued parcels, ~$43B total market value, ~$9.8B land value.

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # static build -> dist/
npm run preview  # preview the build
```

## Deploy

Pushed to `main`, GitHub Actions builds and deploys to GitHub Pages automatically
(see `.github/workflows/deploy.yml`). Enable it once under **Settings → Pages → Source: GitHub Actions**.
Lives at `https://njm25.github.io/leoncountyvalue/`.

## Notes

`PYR_MARKET` is the most recent *certified* roll (prior-year), so values are current-official, not literally today. The lot-level view depends on the county server being reachable and is subject to its 1,000-features-per-request limit, so it activates only when zoomed into a neighborhood.
