const path = require("path");
const fs = require("fs-extra");
const rimraf = require("rimraf");
const { gunzipSync } = require("zlib");

const ACTIVITIES = path.resolve(__dirname, "activities");
const OUTPUT = path.resolve(__dirname, "output");
const files = fs.readdirSync(ACTIVITIES);

// clear output
rimraf.sync(OUTPUT);
fs.mkdir(OUTPUT);

// for each file, either copy to output or unzip then copy
for (const f of files) {
  const srcFile = path.join(ACTIVITIES, f);
  const destFile = path.join(OUTPUT, f).replace(".gz", "");
  if (f.endsWith(".gz")) {
    // read file
    // unzip with zlib
    const input = fs.readFileSync(srcFile);
    const output = gunzipSync(input);

    fs.writeFileSync(destFile, output);
  } else {
    fs.copySync(srcFile, destFile);
  }
}
