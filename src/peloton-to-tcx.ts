#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { promisify } from "util";

import yargs from "yargs";
import dotenv from "dotenv";

import { Peloton } from "./peloton";

dotenv.config();

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);

const argv = yargs
  .usage("Usage: $0 [options]")
  .option("username", {
    type: "string",
    describe: "(Optional) Your Peloton username. If not set, PELOTON_USERNAME environment variable will be used.",
  })
  .option("password", {
    type: "string",
    describe: "(Optional) Your Peloton password. If not set, PELOTON_PASSWORD environment variable will be used.",
  })
  .option("limit", {
    alias: "l",
    type: "number",
    default: Infinity,
    describe: "Limit how many workouts to process.",
  })
  .option("out", {
    alias: "o",
    type: "string",
    describe: "Specifies output directory to write tcx files. If omitted, output will be printed to stdout.",
  })
  .help("h")
  .alias("h", "help").argv;

const OUT_DIR = argv.out;
const LIMIT = argv.limit ?? Infinity;
const USERNAME = (argv.username ?? process.env.PELOTON_USERNAME) as string;
const PASSWORD = (argv.password ?? process.env.PELOTON_PASSWORD) as string;

if (!USERNAME || !PASSWORD) {
  console.error(
    "Username or password missing. Set PELOTON_USERNAME or PELOTON_PASSWORD environment variables or pass --username and --password arguments."
  );
  process.exit(1);
}

async function ensureOutDir() {
  if (OUT_DIR) {
    const dirPath = path.resolve(OUT_DIR);
    if (!fs.existsSync(dirPath)) {
      await mkdir(dirPath);
    }
  }
}

async function main() {
  await ensureOutDir();
  const api = new Peloton();
  await api.login(USERNAME, PASSWORD);
  await api.getWorkoutHistory(LIMIT);
  await api.getSamples();
  const results = await api.processWorkouts();

  await Promise.all(
    Object.entries(results).map(([name, xml]) => {
      if (OUT_DIR) {
        return writeFile(path.resolve(OUT_DIR, name), xml);
      }

      console.log(xml);
    })
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
