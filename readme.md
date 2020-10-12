# peloton-ctx

Converts Peloton workout data to Garmin compatible TCX files that can be uploaded to Garmin Connect.

```
Usage: peloton-tcx [options]

Options:
  --version    Show version number                                     [boolean]
  --username   (Optional) Your Peloton username. If not set, PELOTON_USERNAME
               environment variable will be used.                       [string]
  --password   (Optional) Your Peloton password. If not set, PELOTON_PASSWORD
               environment variable will be used.                       [string]
  --limit, -l  Limit how many workouts to process.  [number] [default: Infinity]
  --out, -o    Specifies output directory to write tcx files. If omitted, output
               will be printed to stdout.                               [string]
  -h, --help   Show help                                               [boolean]
```

> NOTE: Currently only supports treadmill workouts. Bike workouts coming soon.
