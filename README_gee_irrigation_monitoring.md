# gee_irrigation_monitoring

### Earth Observation Workflows for Irrigation Impact and Hydrological Monitoring
*(Google Earth Engine | Remote Sensing | Empirical Modelling)*

---

## 🌍 Overview

This repository provides a suite of **Google Earth Engine (GEE) workflows** developed to monitor key **hydrological parameters** and evaluate the **impact of irrigation investments** in arid and semi-arid regions.  
It integrates **empirical ecological models** and **optical–thermal remote-sensing approaches** to derive spatial estimates of **actual evapotranspiration** and **surface soil moisture** from multispectral imagery.

Developed and applied in **irrigated drylands of central–western Argentina**, these workflows demonstrate how cloud-based EO analytics can support **evidence-based water-resources management and agricultural decision-making**.

---

## 📁 Repository structure

```
gee_irrigation_monitoring/
│
├── actual_ET.js                # EVI-MAP empirical model for actual evapotranspiration (Landsat 5–7)
│
├── soil_moisture_OPTRAM.js     # Optical Trapezoid Model for soil moisture (Sentinel-2 MSI)
│
├── soil_moisture_TOTRAM.js     # Thermal-Optical Trapezoid Model for soil moisture (Landsat 8)
│
├── docs/
│   └── TECHNICAL_NOTES.md      # Calibration parameters, model equations, and notes on units
│
└── LICENSE                     # MIT License
```

Each workflow is modular and can be directly executed within the GEE Code Editor.  
Preprocessing of satellite collections (surface reflectance correction, cloud masking, QA) should be performed prior to use.

---

## ⚙️ Methodological summary

### 1. **Actual Evapotranspiration (EVI-MAP)**
Implements the empirical ecological model proposed by **Contreras et al. (2011)**, relating **Enhanced Vegetation Index (EVI)** anomalies and **precipitation** through the hydrological equilibrium hypothesis (Nemani & Running, 1989).  
Adapted by **Otta et al. (2022)** for irrigated areas of the Monte ecoregion, this model estimates **annual actual ET (mm·yr⁻¹)** using Landsat-derived EVI and CHIRPS precipitation data.

**Outputs:**
- Annual ET maps and time-series charts per irrigation management unit.
- Spatial anomalies highlighting zones of irrigation water use.

---

### 2. **Surface Soil Moisture (OPTRAM)**
The **Optical Trapezoid Model (OPTRAM)** uses the relationship between the **Shortwave Infrared Transmittance Ratio (STR)** and **NDVI** to infer soil-moisture dynamics from Sentinel-2 MSI data.  
It estimates **relative surface soil moisture (%)** within the trapezoidal domain of vegetation and bare-soil conditions.

**Outputs:**
- Instantaneous and median soil-moisture maps.
- Temporal soil-moisture series for irrigation polygons.

---

### 3. **Surface Soil Moisture (TOTRAM)**
The **Thermal-Optical Trapezoid Model (TOTRAM)** combines **NDVI** and **Land Surface Temperature (LST)** from Landsat-8 to quantify relative soil-moisture conditions, linking radiative surface temperature and vegetation vigor.

**Outputs:**
- Multi-temporal soil-moisture estimates at 30 m resolution.
- Comparative analysis with OPTRAM to assess irrigation efficiency.

---

## 🔧 Requirements

- **Google Earth Engine** account (https://earthengine.google.com/)
- Access to preprocessed image collections:
  - *Landsat 5 TM / Landsat 7 ETM+* (`LANDSAT/LT05_C01/T1_SR`, `LANDSAT/LE07_C01/T1_SR`)
  - *Landsat 8 OLI/TIRS* (`LANDSAT/LC08_C01/T1_SR`)
  - *Sentinel-2 MSI Surface Reflectance* (`COPERNICUS/S2_SR`)
- AOI FeatureCollections (`irrigation_region_1`, `irrigation_region_2`) stored in user assets.
- Optional: CHIRPS v2.0 precipitation dataset for cross-analysis.

---

## ▶️ Usage

1. Open the GEE Code Editor and import each script (`actual_ET.js`, `soil_moisture_OPTRAM.js`, or `soil_moisture_TOTRAM.js`).
2. Adapt the **AOI FeatureCollection** and **date range** parameters to your study area.
3. Run the script to visualize:
   - Spatial maps of ET or soil moisture.
   - Time-series charts for irrigation management units.
4. (Optional) Uncomment export tasks to generate GeoTIFF or CSV outputs in Google Drive.

---

## 📖 References

- Contreras, S., Jobbágy, E. G., Villagra, P. E., Nosetto, M. D., & Puigdefábregas, J. (2011). *Remote sensing estimates of water balance in arid ecosystems*. **Ecohydrology**, 4(4), 454–466.
- Otta, S. A., Villagra, P. E., Jobbágy, E. G., & Garay, V. M. (2022). *Hydrological and ecological effects of irrigation expansion in central-western Argentina*. **Geoacta**, 47(1), 41–58.
- Sadeghi, M., et al. (2017). *Optical Trapezoid Model (OPTRAM) for soil moisture retrieval using optical data*. **Remote Sensing of Environment**, 198, 52–68.

---

## 🧩 Citation

If you use or adapt these workflows, please cite the relevant methodological references above and credit:

**Sebastián A. Otta**  
*Environmental Scientist – Remote Sensing & Hydro-climatic Analysis*  
📧 sebaotta.irnr@gmail.com

---

## 📜 License
Distributed under the **MIT License**. See `LICENSE` for details.
