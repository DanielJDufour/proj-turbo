# proj-turbo
:fire: Turbo-charge your Re-projection Functions

### usage
```js
import proj4 from "proj4";
import { turbocharge } from "proj-turbo";

// convert from EPSG:4326 to EPSG:3857
const reproject = proj4("EPSG:4326", "EPSG:3857");

const reprojectFaster = turbocharge(reproject, {
  // container including points to reproject
  bbox,

  debug_level = 0,

  // default is false
  // set to true to return undefined instead of throwing an error
  // when proj-turbo can't figure out a faster reprojection function
  quiet = false,

  // the reprojection function we want to replace
  // with a faster alternative
  reproject,
  
  // maximum allowable error along the x and y axis
  // in the projection we are reprojecting to.
  // when reprojecting rasters,
  // this will often be the pixel size
  threshold: [x_threshold, y_threshold]
});
```

### thanks
Thanks to [Jim Phillips](https://github.com/jcphill) for inspiring me with the awesome performance optimizations he contributed to [GeoRasterLayer](https://github.com/GeoTIFF/georaster-layer-for-leaflet).
