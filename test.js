const proj4 = require("proj4-fully-loaded");
const reproject_bbox = require("reproject-bbox");
const test = require("flug");

const { turbocharge } = require("./proj-turbo");

function random_point (bbox = [-180, -90, 180, 90 ]) {
  const [xmin, ymin, xmax, ymax] = bbox;
  const width = xmax - xmin;
  const height = ymax - ymin;
  return [
    xmin + Math.random() * width,
    ymin + Math.random() * height
  ];
}

function random_points (count, bbox) {
  const points = [];
  for (let i = 0; i < count; i++) {
    points.push(random_point(bbox));
  }
  return points;
}

function random_bbox ({ container, max_height = Infinity, max_width = Infinity } = {}) {
  const points = random_points(4, container);
  const xs = points.map(([x, y]) => x);
  const ys = points.map(([x, y]) => y);
  let xmin = Math.min(...xs);
  let xmax = Math.max(...xs);
  const width = xmax - xmin;
  if (width > max_width) {
    const xmean = (xmin + xmax) / 2;
    xmin = xmean - max_width / 2;
    xmax = xmean + max_width / 2;
  }

  let ymin = Math.min(...ys);
  let ymax = Math.max(...ys);
  const height = ymax - ymin;
  if (height > max_height) {
    const ymean = (ymin + ymax) / 2;
    ymin = ymean - max_height / 2;
    ymax = ymean + max_height / 2;
  }

  return [xmin, ymin, xmax, ymax];
}

test("converting from 3857 to 4326", ({ eq }) => {
  let time_proj4 = 0;
  let time_turbo = 0;
  let invalid = 0;
  for (let i = 0; i < 100; i++) {
    const bbox4326 = random_bbox({ max_height: 0.5, max_width: 0.5 });
    const bbox3857 = reproject_bbox({ bbox: bbox4326, from: 4326, to: 3857 });
    const reproject = proj4("EPSG:3857", "EPSG:4326").forward;
    const { reproject: turbofn } = turbocharge({
      bbox: bbox3857,
      reproject,
      debug_level: 0,
      quiet: true,
      threshold: [0.0083, 0.0083]
    }) || {};

    if (!turbofn) {
      invalid++;
      continue;
    }

    for (let ii = 0; ii < 100_000; ii++) {
      const point = random_point(bbox3857);
      const start_proj4 = performance.now();
      reproject(point);
      time_proj4 += performance.now() - start_proj4;

      const start_turbo = performance.now();
      turbofn(point);
      time_turbo += performance.now() - start_turbo;
    }
  }
  console.log("invalid:", invalid);
  console.log("time_proj4:", time_proj4);
  console.log("time_turbo:", time_turbo);
  console.log(time_turbo / time_proj4);
});

test("utm", ({ eq }) => {
  // bounding box corresponding to tile 13/1319/3071 in Northern California
  const container = [ -122.0361328125, 40.97989806962013, -121.9921875, 41.0130657870063 ];

  // utm projection
  // const bbox32610 = reproject_bbox({ bbox: bbox4326, from: 4326, to: 32610 });
  
  let time_proj4 = 0;
  let time_turbo = 0;
  let count = 0;
  let invalid = 0;
  while (count < 100) {
    const bbox4326 = random_bbox({ container, max_height: 0.5, max_width: 0.5 });
    const bbox32610 = reproject_bbox({ bbox: bbox4326, from: 4326, to: 32610 });
    const reproject = proj4("EPSG:32610", "EPSG:4326").forward;
    const pixel_size = 0.0083;
    const { origin, reproject: turbofn, scale, scales } = turbocharge({
      bbox: bbox32610,
      reproject,
      debug_level: 0,
      quiet: false,
      threshold: [pixel_size, pixel_size]
    }) || {};

    if (!turbofn) {
      invalid++;
      console.log({count, invalid})
      continue;
    }
    count++;

    for (let ii = 0; ii < 100_000; ii++) {
      const point = random_point(bbox32610);
      const start_proj4 = performance.now();
      const [x1, y1] = reproject(point);
      time_proj4 += performance.now() - start_proj4;

      const start_turbo = performance.now();
      const [x2, y2] = turbofn(point);
      time_turbo += performance.now() - start_turbo;
      if (Math.abs(x1 - x2) > pixel_size) {
        console.log({ bbox32610, bbox4326, origin, point, scale, scales, expected: [x1, y1], actual: [x2, y2] });
      }
      if (Math.abs(y1 - y2) > pixel_size) throw Error("bad reprojection");
    }
  }
  console.log("count:", count);
  console.log("invalid:", invalid);
  console.log("time_proj4:", time_proj4);
  console.log("time_turbo:", time_turbo);
  console.log(time_turbo / time_proj4);
});