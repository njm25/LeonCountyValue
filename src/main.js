import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './style.css'

const BASE = import.meta.env.BASE_URL           // '/leoncountyvalue/' in prod, '/' in dev
const SVC = 'https://intervector.leoncountyfl.gov/intervector/rest/services/MapServices/TLC_OverlayRegionalParcel_D_SP/MapServer/0'
const COLORS = ['#ffffb8', '#fee08b', '#fdae61', '#f46d43', '#e0342b', '#a50026']

const fmt = n => n == null || n === '' ? '—' : '$' + Math.round(n).toLocaleString()
const num = n => n == null || n === '' ? '—' : Math.round(n).toLocaleString()
const M = x => x >= 1e9 ? '$' + (x / 1e9).toFixed(2) + 'B' : x >= 1e6 ? '$' + (x / 1e6).toFixed(1) + 'M' : '$' + Math.round(x / 1e3) + 'k'
const $ = id => document.getElementById(id)

async function boot() {
  const [ZGROUPS, ZBLOCKS, BUNDLE, BREAKS] = await Promise.all(
    ['zones-groups.json', 'zones-blocks.json', 'bundle.json', 'breaks.json']
      .map(f => fetch(BASE + 'data/' + f).then(r => r.json()))
  )
  const STATS = BUNDLE.stats
  const BRK = BREAKS.v
  const stepExpr = prop => { const e = ['step', ['get', prop], COLORS[0]]; BRK.forEach((b, i) => e.push(b, COLORS[i + 1])); return e }

  const map = new maplibregl.Map({
    container: 'map', center: [-84.27, 30.45], zoom: 11.5, minZoom: 9, maxZoom: 19,
    attributionControl: { compact: true },
    style: {
      version: 8,
      sources: {
        sat: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, attribution: 'Esri, Maxar · parcels: Leon County Property Appraiser' },
        ref: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 },
        groups: { type: 'geojson', data: ZGROUPS, generateId: true },
        blocks: { type: 'geojson', data: ZBLOCKS, generateId: true },
        parcels: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }
      },
      layers: [
        { id: 'sat', type: 'raster', source: 'sat' },
        { id: 'groups-fill', type: 'fill', source: 'groups', maxzoom: 13, paint: { 'fill-color': stepExpr('v'), 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.8, 0.55] } },
        { id: 'groups-line', type: 'line', source: 'groups', maxzoom: 13, paint: { 'line-color': '#1c100c', 'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2, 0.4], 'line-opacity': 0.5 } },
        { id: 'blocks-fill', type: 'fill', source: 'blocks', minzoom: 13, maxzoom: 15, paint: { 'fill-color': stepExpr('v'), 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.82, 0.55] } },
        { id: 'blocks-line', type: 'line', source: 'blocks', minzoom: 13, maxzoom: 15, paint: { 'line-color': '#1c100c', 'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2, 0.35], 'line-opacity': 0.5 } },
        { id: 'ref', type: 'raster', source: 'ref', minzoom: 12 },
        { id: 'parcels-fill', type: 'fill', source: 'parcels', minzoom: 15, paint: { 'fill-color': stepExpr('PYR_MARKET'), 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.85, 0.6] } },
        { id: 'parcels-line', type: 'line', source: 'parcels', minzoom: 15, paint: { 'line-color': '#241009', 'line-width': 0.5 } }
      ]
    }
  })
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')

  // ---- tooltip ----
  const ztip = $('ztip'), hud = $('hud'), load = $('load')
  const hideTip = () => { ztip.style.display = 'none' }
  const moveTip = e => { ztip.style.left = Math.max(6, Math.min(e.point.x + 14, innerWidth - 224)) + 'px'; ztip.style.top = Math.max(6, Math.min(e.point.y + 14, innerHeight - 74)) + 'px' }
  map.on('movestart', hideTip); map.on('zoomstart', hideTip)

  // ---- hover feature-state ----
  let hov = null
  const setHov = (src, id) => { if (hov) map.setFeatureState(hov, { hover: false }); hov = (src && id != null) ? { source: src, id } : null; if (hov) map.setFeatureState(hov, { hover: true }) }

  const bboxOf = f => { let x1 = 180, y1 = 90, x2 = -180, y2 = -90; (function walk(c) { if (typeof c[0] === 'number') { if (c[0] < x1) x1 = c[0]; if (c[0] > x2) x2 = c[0]; if (c[1] < y1) y1 = c[1]; if (c[1] > y2) y2 = c[1] } else c.forEach(walk) })(f.geometry.coordinates); return [[x1, y1], [x2, y2]] }
  const zoomToFeat = f => { hideTip(); map.fitBounds(bboxOf(f), { padding: 40, maxZoom: 16, duration: 800 }) }

  const zoneHover = e => {
    const f = e.features[0]; map.getCanvas().style.cursor = 'pointer'; setHov(f.source, f.id)
    const p = f.properties
    ztip.innerHTML = `Σ market value <b>${M(p.smv)}</b><br><span class="sub">Σ land ${M(p.slv)} · ${p.n} parcels<br>avg ${fmt(p.v)} · median ${fmt(p.med)}</span>`
    ztip.style.display = 'block'; moveTip(e)
  }
  ;['groups-fill', 'blocks-fill'].forEach(ly => {
    map.on('mousemove', ly, zoneHover)
    map.on('mouseleave', ly, () => { map.getCanvas().style.cursor = ''; setHov(null, null); hideTip() })
    map.on('click', ly, e => zoomToFeat(e.features[0]))
  })
  map.on('mousemove', 'parcels-fill', e => {
    const f = e.features[0]; map.getCanvas().style.cursor = 'pointer'; setHov('parcels', f.id)
    ztip.innerHTML = `<b>${fmt(f.properties.PYR_MARKET)}</b><br><span class="sub">${f.properties.SITEADDR || ''}</span>`
    ztip.style.display = 'block'; moveTip(e)
  })
  map.on('mouseleave', 'parcels-fill', () => { map.getCanvas().style.cursor = ''; setHov(null, null); hideTip() })
  map.on('click', 'parcels-fill', e => openCard(e.features[0].properties))

  // ---- live parcels (paginated so EVERY parcel in view loads, past the server's 1000/request cap) ----
  let pctrl = null, ptimer = null, pseq = 0
  const PAGE = 1000, MAX_PAGES = 40
  const FIELDS = 'OBJECTID,TAXID,OWNER1,SITEADDR,PYR_MARKET,PYR_LAND,PYR_BLDG,PYR_TAXABL,PYR_TAXES,PYR_EX,YR_BLT,BASE_SQ_FT,NO_BLDGS,CALC_ACREA,PRICE_S1,SALEDTE_S1,PRICE_S2,SALEDTE_S2,PROP_USE,HOMESTEAD,LEGAL1'
  async function refreshParcels() {
    if (map.getZoom() < 15) { map.getSource('parcels').setData({ type: 'FeatureCollection', features: [] }); load.style.display = 'none'; return }
    const seq = ++pseq
    if (pctrl) pctrl.abort()
    pctrl = new AbortController(); const signal = pctrl.signal
    const b = map.getBounds()
    const env = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`
    const base = `${SVC}/query?where=PYR_MARKET%3E0&geometry=${encodeURIComponent(env)}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=${encodeURIComponent(FIELDS)}&outSR=4326&returnGeometry=true&f=geojson`
    load.style.display = 'block'; load.textContent = 'loading parcels…'
    const all = []
    try {
      for (let pg = 0; pg < MAX_PAGES; pg++) {
        const url = `${base}&resultOffset=${pg * PAGE}&resultRecordCount=${PAGE}`
        const gj = await fetch(url, { signal }).then(r => r.json())
        if (seq !== pseq) return                       // a newer move superseded this fetch
        const feats = (gj && gj.features) || []
        for (const f of feats) all.push(f)
        load.textContent = `loading parcels… ${all.length.toLocaleString()}`
        map.getSource('parcels').setData({ type: 'FeatureCollection', features: all })  // progressive draw
        if (feats.length < PAGE) break                 // last page
      }
      if (seq === pseq) load.style.display = 'none'
    } catch (e) { if (seq === pseq) load.style.display = 'none' }
  }
  map.on('moveend', () => { clearTimeout(ptimer); ptimer = setTimeout(refreshParcels, 250) })
  const updHud = () => { const z = map.getZoom(); hud.innerHTML = z >= 15 ? 'live lot lines · <b style="color:var(--gold2)">tap a parcel</b>' : (z >= 13 ? 'census blocks · hover for Σ value · tap to zoom' : 'block groups · hover for Σ value · tap to zoom') }
  map.on('zoom', updHud)

  // ---- parcel card ----
  function openCard(p) {
    $('cJv').textContent = fmt(p.PYR_MARKET)
    $('cAd').textContent = p.SITEADDR || '—'
    $('cOwn').textContent = 'Owner: ' + ((p.OWNER1 || '—') + '').trim()
    $('cUse').textContent = (p.PROP_USE ? useName(p.PROP_USE) : 'parcel')
    const ac = p.CALC_ACREA ? (+p.CALC_ACREA).toFixed(2) + ' ac' : '—'
    const s1 = p.PRICE_S1 ? fmt(p.PRICE_S1) + (p.SALEDTE_S1 ? ' (' + ('' + p.SALEDTE_S1).slice(0, 4) + ')' : '') : '—'
    const s2 = p.PRICE_S2 ? fmt(p.PRICE_S2) + (p.SALEDTE_S2 ? ' (' + ('' + p.SALEDTE_S2).slice(0, 4) + ')' : '') : '—'
    const g = [['Land value', fmt(p.PYR_LAND)], ['Building', fmt(p.PYR_BLDG)], ['Taxable', fmt(p.PYR_TAXABL)], ['Taxes', fmt(p.PYR_TAXES)],
      ['Year built', p.YR_BLT && +p.YR_BLT > 0 ? ('' + p.YR_BLT) : '—'], ['Living area', p.BASE_SQ_FT ? num(p.BASE_SQ_FT) + ' sqft' : '—'],
      ['Lot size', ac], ['Buildings', p.NO_BLDGS != null ? ('' + p.NO_BLDGS) : '—'], ['Last sale', s1], ['Prior sale', s2]]
    $('cGrid').innerHTML = g.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')
    $('cLegal').textContent = p.LEGAL1 ? ('Legal: ' + ('' + p.LEGAL1).trim() + ' · ' + (p.TAXID || '')) : (p.TAXID || '')
    $('card').classList.add('show')
  }
  document.querySelector('#card .x').onclick = () => $('card').classList.remove('show')

  const USE = { 0: 'Vacant residential', 1: 'Single-family home', 2: 'Mobile home', 3: 'Multi-family 10+', 4: 'Condominium', 8: 'Multi-family <10', 9: 'Residential misc', 10: 'Vacant commercial', 11: 'Store / office', 16: 'Shopping center', 17: 'Office building', 19: 'Professional bldg', 21: 'Restaurant', 27: 'Auto / marine', 39: 'Hotel / motel', 48: 'Warehouse', 71: 'Church', 72: 'Private school', 73: 'Hospital', 74: 'Home for the aged', 75: 'Non-profit', 77: 'Club / lodge', 80: 'Institutional', 83: 'Public school', 84: 'College / university', 86: 'County', 87: 'State', 88: 'Federal', 89: 'Municipal', 91: 'Utility', 94: 'Right-of-way', 95: 'River / lake', 97: 'Rec / park', 99: 'Non-ag acreage' }
  const useName = c => { const n = parseInt(c, 10); return isNaN(n) ? ('' + c) : (USE[Math.floor(n / 100)] || ('use ' + c)) }

  // ---- chrome ----
  map.on('load', () => {
    updHud()
    $('stats').innerHTML = [['$' + (STATS.total / 1e9).toFixed(1) + 'B', 'total market'], [(STATS.n / 1000).toFixed(0) + 'k', 'parcels'], ['$' + (STATS.avg / 1000).toFixed(0) + 'k', 'avg'], ['$' + (STATS.land / 1e9).toFixed(1) + 'B', 'total land']]
      .map(([b, s]) => `<div class="st"><b>${b}</b><span>${s}</span></div>`).join('')
    const labels = ['< ' + M(BRK[0]), M(BRK[0]) + '–' + M(BRK[1]), M(BRK[1]) + '–' + M(BRK[2]), M(BRK[2]) + '–' + M(BRK[3]), M(BRK[3]) + '–' + M(BRK[4]), M(BRK[4]) + ' +']
    $('legend').innerHTML = '<div class="t">Avg market value / zone</div>' + labels.map((l, i) => `<div class="r"><span class="sw" style="background:${COLORS[i]}"></span>${l}</div>`).join('') + '<div class="mode">hover for Σ value · <b>tap to zoom in</b></div>'
  })

  const HOODS = [['Whole county', -84.27, 30.45, 11.2], ['FSU / Downtown', -84.290, 30.440, 15.4], ['Myers Park', -84.270, 30.428, 15.4], ['Betton Hills', -84.272, 30.464, 15.2], ['Killearn', -84.213, 30.515, 14.3], ['Southwood', -84.220, 30.386, 14.3], ['Frenchtown', -84.287, 30.452, 15.4]]
  $('chips').innerHTML = HOODS.map((h, i) => `<button class="chip${i === 0 ? ' on' : ''}" data-i="${i}">${h[0]}</button>`).join('')
  $('chips').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; document.querySelectorAll('.chip').forEach(x => x.classList.remove('on')); b.classList.add('on'); const h = HOODS[+b.dataset.i]; map.flyTo({ center: [h[1], h[2]], zoom: h[3], duration: 1100 }) }

  const side = $('side'), sideBody = $('sideBody')
  $('sideToggle').onclick = () => side.classList.add('open')
  $('sideClose').onclick = () => side.classList.remove('open')
  const renderList = w => { sideBody.innerHTML = BUNDLE[w].map((r, i) => `<div class="item" data-w="${w}" data-i="${i}"><div class="jv">${fmt(r.mv)}</div><div class="ad">${r.addr || '—'}</div><div class="mt">${r.use || ''}${r.yr ? ' · built ' + r.yr : ''}${r.owner ? ' · ' + r.owner : ''}</div></div>`).join('') }
  renderList('homes')
  document.querySelectorAll('#side .hd button').forEach(b => b.onclick = () => { document.querySelectorAll('#side .hd button').forEach(x => x.classList.remove('on')); b.classList.add('on'); renderList(b.dataset.t) })
  sideBody.onclick = e => {
    const it = e.target.closest('.item'); if (!it) return
    const r = BUNDLE[it.dataset.w][+it.dataset.i]
    map.flyTo({ center: [r.lon, r.lat], zoom: 17.5, duration: 1200 })
    new maplibregl.Popup({ closeButton: true }).setLngLat([r.lon, r.lat]).setHTML(`<b style="color:#a2202f">${fmt(r.mv)}</b><br>${r.addr || ''}<br><span style="color:#666;font-size:11px">${r.use || ''}${r.yr ? ' · ' + r.yr : ''}</span>`).addTo(map)
    if (innerWidth < 760) side.classList.remove('open')
  }
}

boot()
