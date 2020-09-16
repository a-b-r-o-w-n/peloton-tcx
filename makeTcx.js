const { find, max, mean, get } = require("lodash");
const builder = require("xmlbuilder");

const milesToMeters = 1609.34;
const convertToMeters = (d) => d * milesToMeters;
const convertToKmHr = (d) => d * 1.609;
const convertMps = (s) => s / 60 / 60;

const shouldStartLap = (previous, next) => {
  // return true if previous + next crosses a mile threshold
  const miles = Math.floor(previous);
  const currentLap = previous - miles;
};

// convert mph to mps
// multiply by interval
// convert to meters

const processSample = (activity, start, sample) => {
  const distance = (find(sample.summaries, { slug: "distance" }) || {}).value || 0;
  const calories = (find(sample.summaries, { slug: "calories" }) || {}).value || 0;
  const pace = find(sample.metrics, { slug: "pace" });
  const speed = pace && find(pace.alternatives, { slug: "speed" });
  const heartRate = find(sample.metrics, { slug: "heart_rate" });
  const incline = find(sample.metrics, { slug: "incline" }).values;
  const times = sample.seconds_since_pedaling_start;
  const calPerMile = Math.round(calories / distance);

  let lap = activity.ele("Lap");
  lap.att("StartTime", new Date(start).toISOString());

  let track = lap.ele("Track");
  // first point at 0
  track.ele("Trackpoint").ele({
    Time: new Date(start).toISOString(),
    DistanceMeters: 0,
    HeartRateBpm: { Value: heartRate && (heartRate.values || [])[0] },
  });

  let lastLapIndex = 0;
  let totalDistance = 0;
  let totalElevation = 0;
  let lapDuration = 0;

  sample.seconds_since_pedaling_start.forEach((time, i) => {
    const interval = time - (times[i - 1] || 0);
    const mps = convertMps(speed.values[i]);
    const miles = Math.floor(totalDistance);
    const lapSpeeds = get(speed, "values", []).slice(lastLapIndex, i);
    const lapHR = get(heartRate, "values", []).slice(lastLapIndex, i);
    const currentLap = totalDistance - miles;
    const distance = mps * interval;
    const delta = parseFloat((currentLap + distance).toFixed(9));
    const elevGain = distance * (incline[i] / 100);
    const timestamp = new Date(start + time * 1000).toISOString();
    lapDuration += interval;
    totalElevation += elevGain;

    // start new lap
    if (delta > 1) {
      const amtOverMile = delta % 1;
      const amtToMile = distance - amtOverMile;

      // create track point for remainder of mile
      track.ele("Trackpoint").ele({
        Time: timestamp,
        DistanceMeters: convertToMeters(parseFloat((totalDistance + amtToMile).toFixed(3))),
        AltitudeMeters: totalElevation,
        HeartRateBpm: { Value: (heartRate && heartRate.values[i]) || null },
        Extensions: {
          "ns3:TPX": {
            "ns3:Speed": convertToMeters(mps),
          },
        },
      });

      // end lap
      lap.ele("DistanceMeters", convertToMeters(parseFloat(delta.toFixed(3))));
      lap.ele("MaximumSpeed", convertToMeters(convertMps(max(lapSpeeds))));
      lap.ele("TotalTimeSeconds", lapDuration);
      lap.ele("Calories", calPerMile);
      lap.ele("AverageHeartRateBpm").ele({ Value: mean(lapHR) });
      lap.ele("MaximumHeartRateBpm").ele({ Value: max(lapHR) });

      // create new lap with trackpoint for amt over mile
      lapDuration = 0;
      lastLapIndex = i;
      totalDistance += distance;

      lap = activity.ele("Lap");
      lap.att("StartTime", timestamp);
      track = lap.ele("Track");
      track.ele("Trackpoint").ele({
        Time: timestamp,
        DistanceMeters: convertToMeters(totalDistance),
        AltitudeMeters: totalElevation,
        HeartRateBpm: { Value: (heartRate && heartRate.values[i]) || null },
        Extensions: {
          "ns3:TPX": {
            "ns3:Speed": convertToMeters(mps),
          },
        },
      });
    } else {
      // keep adding lap data
      totalDistance += distance;
      track.ele("Trackpoint").ele({
        Time: timestamp,
        DistanceMeters: convertToMeters(totalDistance),
        AltitudeMeters: totalElevation,
        HeartRateBpm: { Value: (heartRate && heartRate.values[i]) || null },
        Extensions: {
          "ns3:TPX": {
            "ns3:Speed": convertToMeters(mps),
          },
        },
      });
    }

    if (i === sample.seconds_since_pedaling_start.length - 1) {
      lap.ele("DistanceMeters", convertToMeters(parseFloat(delta.toFixed(3))));
      lap.ele("MaximumSpeed", convertToMeters(convertMps(max(lapSpeeds))));
      lap.ele("TotalTimeSeconds", lapDuration);
      lap.ele("Calories", Math.ceil(calPerMile * delta));
      lap.ele("AverageHeartRateBpm").ele({ Value: mean(lapHR) });
      lap.ele("MaximumHeartRateBpm").ele({ Value: max(lapHR) });
    }
  });
};

module.exports = async (workout, sample) => {
  const start = workout.start_time * 1000;
  const pace = find(sample.metrics, { slug: "pace" });

  const root = builder.create("TrainingCenterDatabase", { encoding: "UTF-8" });
  root
    .att("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")
    .att(
      "xsi:schemaLocation",
      "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd"
    )
    .att("xmlns:ns2", "http://www.garmin.com/xmlschemas/UserProfile/v2")
    .att("xmlns:ns3", "http://www.garmin.com/xmlschemas/ActivityExtension/v2")
    .att("xmlns:ns5", "http://www.garmin.com/xmlschemas/ActivityGoals/v1")
    .att("xmlns", "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2");

  const activity = root.ele("Activities").ele("Activity").att("Sport", "Running");
  activity.ele("Id", new Date(start).toISOString());

  processSample(activity, start, sample);

  return root.end({ pretty: true });
};
