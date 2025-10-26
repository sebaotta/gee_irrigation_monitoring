/*******************************************************
  OPTRAM — Optical Trapezoid Model (Sentinel-2 MSI)
  -------------------------------------------------
  Implements the OPTRAM optical-trapezoid approach (Sadeghi et al. 2017)
  to estimate relative surface soil moisture from Sentinel-2 optical bands.

  Assumptions:
   - `Sentinel2MSI` collection used here is preprocessed (surface reflectance,
     cloud-masked, QA applied).
   - irrigation_region_1 / irrigation_region_2 are provided as FeatureCollections.

   References:
   - Sadeghi et al. (2017). The optical trapezoid model: A novel approach to remote sensing
     of soil moisture applied to Sentinel-2 and Landsat-8 observation. RSE 198, p. 52-68
*******************************************************/

// === Parameters ===
var series_start = '2021-07-01';
var series_end   = '2024-06-30';

// Define Area of Interest (AOI) from irrigation regions
var irrigation_region_1 = ee.FeatureCollection("users/sebaotta/BID/inspecciones_Jocoli");
var irrigation_region_2 = ee.FeatureCollection("users/sebaotta/BID/inspecciones_Tulumaya");
var AOI = irrigation_region_1.merge(irrigation_region_2);
Map.centerObject(AOI, 9);

// Color palette
var palette = ['red','orange','yellow','green','cyan','blue'];

// === Data ingestion & indices ===
// NOTE: uses preprocessed Sentinel-2 MSI surface reflectance with band names B2,B3,B4,B8,B11,B12
var S2 = Sentinel2MSI
          .filterBounds(AOI)
          .filterDate(series_start, series_end)
          .select(['B2','B3','B4','B8','B11','B12'])
          .map(function(img){ return img.clip(AOI); });

// Compute NDVI and STR per image (STR formula per original script)
var S2_proc = S2.map(function(img){
  var ms = img.multiply(0.0001); // scale factor
  var ndvi = ms.normalizedDifference(['B8','B4']).rename('NDVI');
  // STR as defined in original script: ((1 - SWIR)^2)/(2*SWIR)
  var STR = ms.expression('((1 - SWIR) ** 2) / (2 * SWIR)', {
    'SWIR': ms.select('B12')
  }).rename('STR');
  return ms.addBands([ndvi, STR]).copyProperties(img, img.propertyNames());
});

// Median image for visualization / trapezoid reference
var imgMedian = ee.Image(S2_proc.median()).clip(AOI);
Map.addLayer(imgMedian, {min:0.05, max:0.4, bands: 'B4,B3,B2'}, 'Median S2 RGB', false);
Map.addLayer(imgMedian.select('NDVI'), {min:0, max:0.6, palette:['white','green']}, 'Median NDVI', false);
Map.addLayer(imgMedian.select('STR'), {min:0.7, max:2.7, palette:['red','yellow','green']}, 'Median STR', false);

// === Compute trapezoid vertices from the collection ===
// Helper: store per-image NDVI min/max as image properties
function attachNDVIMinMax(image){
  var mm = image.select('NDVI').reduceRegion({
    reducer: ee.Reducer.minMax(),
    geometry: AOI,
    scale: 20,
    maxPixels: 1e13
  });
  return image.set({
    'NDVI_min': mm.get('NDVI_min'),
    'NDVI_max': mm.get('NDVI_max')
  });
}
var coll = S2_proc.map(attachNDVIMinMax);

// Build STR masks for vegetation classes and compute trapezoid extremes
var STR_full_cover = coll.map(function(image){
  var full = image.select('NDVI').gte(0.6);
  return image.select('STR').updateMask(full);
});

var STR_bare_soil = coll.map(function(image){
  var bare = image.select('NDVI').gte(0.1).and(image.select('NDVI').lte(0.2));
  return image.select('STR').updateMask(bare);
});

// Derive trapezoid corners (using collection-wide stats)
var vw_opt = ee.Number(STR_full_cover.max().reduceRegion({
  reducer: ee.Reducer.max(), geometry: AOI, scale: 20, maxPixels: 1e13
}).values().get(0));

var vd_opt = ee.Number(STR_full_cover.min().reduceRegion({
  reducer: ee.Reducer.min(), geometry: AOI, scale: 20, maxPixels: 1e13
}).values().get(0));

var iw_opt = ee.Number(STR_bare_soil.max().reduceRegion({
  reducer: ee.Reducer.max(), geometry: AOI, scale: 20, maxPixels: 1e13
}).values().get(0));

var id_opt = ee.Number(STR_bare_soil.min().reduceRegion({
  reducer: ee.Reducer.min(), geometry: AOI, scale: 20, maxPixels: 1e13
}).values().get(0));

var sd_opt = vd_opt.subtract(id_opt);
var sw_opt = vw_opt.subtract(iw_opt);

// === OPTRAM soil moisture calculation (median image) ===
var OPTRAM_median = imgMedian.expression(
  '((id + (sd * NDVI) - STR) / ((id - iw) + ((sd - sw) * NDVI))) * 100', {
    'STR': imgMedian.select('STR'),
    'NDVI': imgMedian.select('NDVI'),
    'id': id_opt,
    'sd': sd_opt,
    'iw': iw_opt,
    'sw': sw_opt
  }).rename('soil_moisture');

// Attach metadata (provenance & units)
OPTRAM_median = OPTRAM_median.set({
  'model': 'OPTRAM',
  'model_ref': 'Sadeghi et al. (adapted).',
  'units': '%', // percent soil moisture (relative)
  'notes': 'Relative surface soil moisture estimated by OPTRAM from Sentinel-2 STR & NDVI'
});

// Visualization
Map.addLayer(OPTRAM_median, {min: 10, max: 50, palette: palette}, 'OPTRAM median SM', false);

// === Time series: compute per-image OPTRAM and create collection ===
var optram_series = coll.map(function(image){
  var eq = image.expression(
    '((id + (sd * NDVI) - STR) / ((id - iw) + ((sd - sw) * NDVI))) * 100', {
      'STR': image.select('STR'),
      'NDVI': image.select('NDVI'),
      'id': id_opt,
      'sd': sd_opt,
      'iw': iw_opt,
      'sw': sw_opt
    }).rename('soil_moisture');
  return eq.copyProperties(image, image.propertyNames())
           .set({'model':'OPTRAM','units':'%'}); // propagate metadata
});
Map.addLayer(optram_series, {}, 'OPTRAM series', false);

// === Charts for regions ===
print('Region 1 - OPTRAM SM series',
  ui.Chart.image.series(optram_series.select('soil_moisture'), irrigation_region_1, ee.Reducer.mean(), 20, 'system:time_start'));

print('Region 2 - OPTRAM SM series',
  ui.Chart.image.series(optram_series.select('soil_moisture'), irrigation_region_2, ee.Reducer.mean(), 20, 'system:time_start'));

// === Optional export snippets ===
// Export OPTRAM median map to Drive (uncomment to use)
// Export.image.toDrive({
//   image: OPTRAM_median,
//   description: 'OPTRAM_median_SM',
//   folder: 'GEE_exports',
//   fileNamePrefix: 'OPTRAM_median_SM',
//   scale: 20,            // Explicit scale (optional)
//   crs: 'EPSG:4326',     // Explicit CRS (optional)
//   region: AOI.geometry().bounds(),
//   maxPixels: 1e13
// });
