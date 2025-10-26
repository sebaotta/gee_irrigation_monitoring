/*******************************************************
  TOTRAM — Thermal-Optical Trapezoid Model (Landsat 8)
  ---------------------------------------------------
  Implements the Thermal-Optical trapezoid approach (Sadeghi et al. 2015, 2017) to
  estimate relative surface soil moisture using Landsat 8 surface reflectance (optical)
  and thermal band (LST) inputs.

  Assumptions:
   - `Landsat8` collection used here is preprocessed (surface reflectance,
     thermal scaling applied, cloud-masked, QA applied).
   - irrigation_region_1 / irrigation_region_2 are provided as FeatureCollections.

  References:
   - Sadeghi et al. (2015). A linear physically-based model for remote sensing of soil
     moisture using short wave infrared bands. Remote Sens. Environ. 164, 66–76.
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
var palette = ['FFFFFF','CE7E45','DF923D','F1B555','FCD163','99B718',
               '74A901','66A000','529400','3E8601','207401','056201',
               '004C00','023B01','012E01','011D01','011301'];

// === Data ingestion & preparation ===
// NOTE: expects Landsat8 with SR bands named SR_B* and thermal band ST_B10 (or ST_B*)
// Filter and clip
var landsat = Landsat8
              .filterBounds(AOI)
              .filterDate(series_start, series_end)
              .filter(ee.Filter.lt('CLOUD_COVER', 20))
              .map(function(img){ return img.clip(AOI); });

// Build parameters: scaled optical + NDVI + LST
var parameters = landsat.map(function(img){
  // optical scaling for SR bands
  var ms = img.select('SR_B.*').multiply(0.0000275).add(-0.2);
  // NDVI from NIR (SR_B5) and RED (SR_B4)
  var ndvi = ms.normalizedDifference(['SR_B5','SR_B4']).rename('NDVI');
  // Thermal scaling for LST (ST_B10)
  var lst = img.select('ST_B10').multiply(0.00341802).add(149).rename('LST');
  return ee.Image.cat([ndvi, lst]).copyProperties(img, img.propertyNames());
});

// === Build thermal-optical trapezoid corners ===
// Full vegetation (high NDVI) and bare soil (low NDVI) masks per image
var lst_full_cover = parameters.map(function(img){
  var ndvi_full = img.select('NDVI').gt(0.3);
  return img.select('LST').updateMask(ndvi_full).copyProperties(img, img.propertyNames());
});

var lst_bareland = parameters.map(function(img){
  var ndvi_bare = img.select('NDVI').gte(0).and(img.select('NDVI').lt(0.2));
  return img.select('LST').updateMask(ndvi_bare).copyProperties(img, img.propertyNames());
});

// Derive trapezoid extremes (vw/vd for vegetation; iw/id for bare soil)
var vw = ee.Number(lst_full_cover.min().reduceRegion({
  reducer: ee.Reducer.min(), geometry: AOI, scale: 100, maxPixels: 1e13
}).values().get(0));

var vd = ee.Number(lst_full_cover.max().reduceRegion({
  reducer: ee.Reducer.max(), geometry: AOI, scale: 100, maxPixels: 1e13
}).values().get(0));

var iw = ee.Number(lst_bareland.min().reduceRegion({
  reducer: ee.Reducer.min(), geometry: AOI, scale: 100, maxPixels: 1e13
}).values().get(0));

var id = ee.Number(lst_bareland.max().reduceRegion({
  reducer: ee.Reducer.max(), geometry: AOI, scale: 100, maxPixels: 1e13
}).values().get(0));

// Trapezoid deltas
var sd = id.subtract(vd);
var sw = iw.subtract(vw);

// === Soil moisture calculation per image (series) ===
var sm_series = parameters.map(function(img){
  var eq = img.expression(
    '(id + sd * NDVI - LST) / (id - iw + (sd - sw) * NDVI)', {
      'id': id, 'sd': sd, 'NDVI': img.select('NDVI'), 'LST': img.select('LST'),
      'iw': iw, 'sw': sw
    }).rename('soil_moisture');
  return eq.copyProperties(img, img.propertyNames()).set({'model':'TOTRAM','units':'relative'});
});

// Mean soil moisture map (mean across series)
var sm_mean = sm_series.mean().rename('sm_mean').set({
  'model':'TOTRAM','units':'relative','notes':'Thermal-optical relative soil moisture (TOTRAM)'
});
Map.addLayer(sm_mean, {min: 0.1, max: 0.4, palette: palette}, 'sm_mean (TOTRAM)', false);

// Example single-date (month) composite demonstration
var sm_july = sm_series.filterDate('2022-07-01','2022-07-31').mean();
Map.addLayer(sm_july, {min:0.1, max:0.4, palette: palette}, 'SM July 2022 (TOTRAM)', false);

// === Charts for regions ===
print('Region 1 - TOTRAM SM series',
  ui.Chart.image.series(sm_series.select('soil_moisture'), irrigation_region_1, ee.Reducer.mean(), 30, 'system:time_start'));

print('Region 2 - TOTRAM SM series',
  ui.Chart.image.series(sm_series.select('soil_moisture'), irrigation_region_2, ee.Reducer.mean(), 30, 'system:time_start'));

// === Optional export snippet ===
// Export.image.toDrive({
//   image: sm_mean,
//   description: 'TOTRAM_sm_mean',
//   folder: 'GEE_exports',
//   fileNamePrefix: 'TOTRAM_sm_mean',
//   scale: 30,            // Explicit scale (optional)
//   crs: 'EPSG:4326',     // Explicit CRS (optional)
//   region: AOI.geometry().bounds(),
//   maxPixels: 1e13
// });
