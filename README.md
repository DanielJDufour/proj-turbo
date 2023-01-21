:warning: this is new and highly experimental and has only been tested on 3 projections so far.  I suggest testing it on your data before using it.


# proj-turbo
:fire: Turbo-charge your Re-projection Functions

## features
- reproject from [Web Mercator](https://en.wikipedia.org/wiki/Web_Mercator_projection) to EPSG:4326 (Latitude/Longitude) ~3x faster
- reproject from [UTM](https://en.wikipedia.org/wiki/Universal_Transverse_Mercator_coordinate_system) to EPSG:4326 ~5x faster
- zero dependencies
- works great with [proj4js](https://www.npmjs.com/package/proj4)
- isomorphic (works in the browser and in NodeJS)

## algorithm
This basically checks if reprojection within the given bbox can be modeled by the following function without exceeding the error threshold.
```js
([x, y]) => ([
  x_origin + x_scale * (x - xmin), // x_origin is the smallest possible x output value, xmin is from the given bbox
  y_origin + y_scale * (y - ymin) // y_origin is the smallest possible y output value , ymin is from the given bbox
]);
```

### usage
```js
import proj4 from "proj4";
import { turbocharge } from "proj-turbo";

// convert from EPSG:4326 to EPSG:3857
const reproject = proj4("EPSG:4326", "EPSG:3857");

const reprojectFaster = turbocharge(reproject, {
  // container including points to reproject
  // in the srs that you are reprojecting from
  bbox,

  debug_level = 0,

  // default is false
  // set to true to return undefined instead of throwing an error
  // when proj-turbo can't figure out a faster reprojection function
  quiet = false,

  // the reprojection function we want to try to replace
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
