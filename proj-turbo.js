"use_strict";

// assuming odd number of nums
const median = nums => nums.sort()[Math.floor(nums.length - 2)];

const min = nums => nums.slice().sort((a, b) => Math.sign(a - b))[0];

function turbocharge ({ bbox, debug_level = 0, quiet = false, reproject, threshold: [x_threshold, y_threshold] }) {
  if (debug_level >= 2) console.log("[proj-turbo] starting");
  if (debug_level >= 3) console.log("[proj-turbo] bbox:", bbox);
  if (debug_level >= 3) console.log("[proj-turbo] reproject:", reproject);
  if (debug_level >= 3) console.log("[proj-turbo] threshold:", [x_threshold, y_threshold]);
  if (debug_level >= 3) console.log("[proj-turbo] quiet:", quiet);

  const [xmin, ymin, xmax, ymax] = bbox;
  const width = xmax - xmin;
  if (debug_level >= 3) console.log("[proj-turbo] width:", width);
  const height = ymax - ymin;
  if (debug_level >= 3) console.log("[proj-turbo] height:", height);

  const corners = [
    [xmin, ymax], // top-left
    [xmax, ymax], // top-right
    [xmax, ymin], // bottom-right
    [xmin, ymin] // bottom-left
  ];
  const corner_pairs = corners.map(corner => [corner, reproject(corner)]);

  // how much horizontal change between the top and bottom coordinates
  const x_drift_left_edge = corner_pairs[0][1][0] - corner_pairs[3][1][0];
  const x_drift_right_edge = corner_pairs[1][1][0] - corner_pairs[2][1][0];
  const max_x_drift = Math.max(x_drift_left_edge, x_drift_right_edge);
  if (debug_level >= 3) console.log("max_x_drift:", max_x_drift);

  const y_drift_top_edge = corner_pairs[1][1][1] - corner_pairs[0][1][1];
  const y_drift_bottom_edge = corner_pairs[2][1][1] - corner_pairs[3][1][1];
  const max_y_drift = Math.max(y_drift_top_edge, y_drift_bottom_edge);
  if (debug_level >= 3) console.log("max_y_drift:", max_y_drift);

  const x_offset = width / 100;
  if (debug_level >= 4) console.log("[proj-turbo] x_offset:", x_offset);

  const y_offset = height / 100;
  if (debug_level >= 4) console.log("[proj-turbo] y_offset:", y_offset);

  const train_points = [
    [xmin + width / 4, ymax - height / 4],
    [xmax - width / 4, ymax - height / 4],
    [xmax - width / 4, ymin + height / 4],
    [xmin + width / 4, ymin + height / 4],  

    [xmin + width / 10, ymax - height / 10],
    [xmax - width / 10, ymax - height / 10],
    [xmax - width / 10, ymin + height / 10],
    [xmin + width / 10, ymin + height / 10],  

    // center
    [(xmin + xmax) / 2, (ymin + ymax) / 2]
  ];
  if (debug_level >= 5) console.log("[proj-turbo] train_points: " + JSON.stringify(train_points));

  const train_pairs = train_points.map(point => [point, reproject(point)]);
  if (debug_level >= 5) console.log("[proj-turbo] train_pairs: " + JSON.stringify(train_pairs));
  
  // find the origin, which is the bottom-left of all the points
  const x_origin = min(train_pairs.concat(corner_pairs).map(([pt1, [x2, y2]]) => x2));
  if (debug_level >= 4) console.log("[proj-turbo] x_origin:", x_origin);
  const y_origin = min(train_pairs.concat(corner_pairs).map(([pt1, [x2, y2]]) => y2));
  if (debug_level >= 4) console.log("[proj-turbo] y_origin:", y_origin);

  // get scales from origin
  let scales = train_pairs.map(([[x0, y0], [x1, y1]], i) => {
    if (x1 < x_origin) throw new Error("[proj-turbo] uh oh, x1", x1, "is less than origin", x_origin);
    return [(x1 - x_origin) / (x0 - xmin), (y1 - y_origin) / (y0 - ymin)];
  });
  if (debug_level >= 4) console.log("[proj-turbo] scales: ", scales.map(([x, y]) => [x.toFixed(10), y.toFixed(10)]));

  // remove any NaN which can sometimes happen at the origin
  scales = scales.filter(([x, y]) => !(x < 0 || y < 0 || isNaN(x) || isNaN(y) || x === Infinity && y === Infinity));

  if (scales.length < 3) {
    if (debug_level >= 1) console.log("[proj-turbo] origin: ", [x_origin, y_origin]);
    if (debug_level >= 1) console.log("[proj-turbo] scales: ", scales);
    if (quiet) return undefined;
    else throw new Error("[proj-turbo] not enough scales");
  }

  const x_scale = median(scales.map(([x, y]) => x));
  if (debug_level >= 4) console.log("[proj-turbo] median horizontal scale:", x_scale);

  const y_scale = median(scales.map(([x, y]) => y));
  if (debug_level >= 4) console.log("[proj-turbo] median vertical scale:", y_scale);

  // fwiw, I created a bound function and it was slower
  // to-do: incorporate drift when max drift exceeds error threshold
  const reproj = ([x, y]) => [x_origin + x_scale * (x - xmin), y_origin + y_scale * (y - ymin)];

  const test_pairs = [
    ...corner_pairs, // want to test literal edge cases
    ...train_pairs
  ];

  for (let i = 0; i < test_pairs.length; i++) {
    const [original_point, [x_expected, y_expected]] = test_pairs[i];
    const [predicted_x, predicted_y] = reproj(original_point);
    const x_error = Math.abs(predicted_x - x_expected);
    if (x_error >= x_threshold) {
      if (debug_level >= 1) console.log(`${x_origin} + ${x_scale} * (${original_point[0]} - ${xmin})`);      
      if (debug_level >= 1) console.log(`predicted ${predicted_x}, which is ${x_error} from ${x_expected}, which is greater than the threshold ${x_threshold}`);
      if (quiet) return undefined;
      else throw Error("[proj-turbo] linear function exceeded horizontal error threshold");
    }
    const y_error = Math.abs(predicted_y - y_expected);
    if (y_error >= y_threshold) {
      if (debug_level >= 1) console.log(`${y_origin} + ${y_scale} * (${original_point[1]} - ${ymin})`);      
      if (debug_level >= 1) console.log(`predicted ${predicted_y}, which is ${y_error} from ${y_expected}, which is greater than the threshold ${y_threshold}`);
      if (quiet) return undefined;
      else throw Error("[proj-turbo] linear function exceeded vertical error threshold");
    }
  }

  return { origin: [x_origin, y_origin], reproject: reproj, scale: [x_scale, y_scale], scales };
}

const projturbo = { turbocharge };

if (typeof define === "function" && define.amd) {
  define(function() { return projturbo; });
}

if (typeof module === "object" && module.exports) {
  module.exports = projturbo;
}

if (typeof self === "object") {
  self.projturbo = projturbo;
}

if (typeof window === "object") {
  window.projturbo = projturbo;
}
