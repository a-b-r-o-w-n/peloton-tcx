const path = require("path");
const fs = require("fs-extra");

const OUTPUT = path.resolve(__dirname, "output");
const files = fs.readdirSync(OUTPUT).filter((f) => f.endsWith(".tcx"));

for (const f of files) {
  const srcFile = path.join(OUTPUT, f);
  const destFile = path.join(OUTPUT, `NEW-${f}`);
  let content = fs.readFileSync(srcFile, "utf-8");

  content = content.replace("<Creator><Name>PELOTON</Name></Creator>", "");
  content = content.replace(/\.\d+<\/Watts>/gi, "</Watts>");
  content = content.replace(/\.\d+<\/Calories>/gi, "</Calories>");
  content = content.replace(/\.\d+<\/Cadence>/gi, "</Cadence>");
  content = content.replace(
    /\.\d+<\/Value><\/AverageHeartRateBpm>/gi,
    "</Value></AverageHeartRateBpm>"
  );
  content = content.replace(
    /\.\d+<\/Value><\/MaximumHeartRateBpm>/gi,
    "</Value></MaximumHeartRateBpm>"
  );
  content = content.replace(
    /\.\d+<\/Value><\/HeartRateBpm>/gi,
    "</Value></HeartRateBpm>"
  );
  content = content.replace(/\.0\<\//gi, "</");

  fs.writeFileSync(destFile, content);
}
