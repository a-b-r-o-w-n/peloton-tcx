const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const fetch = require("node-fetch");
const { argv } = require("yargs");

const makeTcx = require("./makeTcx");

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);

const FETCH_ALL_DATA = argv.all;
const LIMIT = argv.limit || Infinity;

const USERNAME = process.env.PELOTON_USERNAME;
const PASSWORD = process.env.PELOTON_PASSWORD;

if (!USERNAME || !PASSWORD) {
  console.error("Username or password missing. Set PELOTON_USERNAME or PELOTON_PASSWORD environment variables.");
  process.exit(1);
}

const baseUrl = "https://api.pelotoncycle.com";
class Api {
  constructor() {
    this.cache = new Map();
  }

  async initialize() {
    const files = ["workouts"];

    for (const file of files) {
      await this.loadData(file);
    }
  }

  get userId() {
    if (!this.user) {
      throw new Error("Must authenticate first.");
    }

    return this.user.user_id;
  }

  get sessionId() {
    if (!this.user) {
      throw new Error("Must authenticate first.");
    }

    return this.user.session_id;
  }

  get defaultHeaders() {
    if (!this.user) {
      throw new Error("Must authenticate first.");
    }

    return {
      cookie: `peloton_session_id=${this.sessionId};`,
    };
  }

  get workouts() {
    return this.cache.get("workouts") || [];
  }

  get lastTimestamp() {
    const timestamps = this.workouts().map((w) => w.created_at);
    const max = Math.max(...timestamps);
    return max ? new Date(max * 1000) : null;
  }

  async login() {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "post",
      body: JSON.stringify({
        username_or_email: USERNAME,
        password: PASSWORD,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    const user = await res.json();

    this.user = user;

    return user;
  }

  async getWorkoutHistory() {
    const result = [];
    let hasNextPage = true;
    let page = 0;
    while (hasNextPage) {
      console.log(`Fetching workout history page ${page}`);
      const url = `${baseUrl}/api/user/${this.userId}/workouts?limit=50&page=${page}`;
      const res = await fetch(url, {
        headers: this.defaultHeaders,
      });
      const workouts = await res.json();
      result.push(...workouts.data);

      hasNextPage = !!workouts.show_next;
      page++;
    }

    await this.writeData("workouts", result);
  }

  async getSamples() {
    await Promise.all(
      this.workouts.map((w) => {
        return this.getWorkoutSample(w.id);
      })
    );
  }

  async getWorkoutSample(workoutId) {
    console.log(`Fetching performance data for workout ${workoutId}`);
    const res = await fetch(`${baseUrl}/api/workout/${workoutId}/performance_graph?every_n=1&limit=14400`);
    const data = await res.json();
    await this.writeData(`samples/${workoutId}`, data);
  }

  async processWorkouts() {
    let numProcessed = 0;
    for (const workout of this.workouts) {
      const d = new Date(workout.start_time * 1000);
      if (workout.fitness_discipline === "running") {
        const sample = (await this.loadData(`samples/${workout.id}`)) || {};
        const xml = await makeTcx(workout, sample);
        await this.writeData(`tcx/${d.toISOString().replace(/T.*/, "")}_${workout.id}`, xml, "tcx");
        numProcessed++;
      }

      if (numProcessed >= LIMIT) {
        break;
      }
    }
  }

  async writeData(filename, data, ext = "json") {
    const output = path.join(__dirname, "peloton_data", `${filename}.${ext}`);
    const contents = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    await writeFile(output, contents);
    this.cache.set(filename, data);
  }

  async loadData(filename) {
    const output = path.join(__dirname, "peloton_data", `${filename}.json`);
    let data = null;
    try {
      const contents = await readFile(output, "utf-8");
      data = JSON.parse(contents);
    } catch (err) {
      // do nothing
    }

    this.cache.set(filename, data);
    return data;
  }
}

async function ensureDirs() {
  const dirs = ["samples", "tcx"];

  for (const dir of dirs) {
    const dirPath = path.join(__dirname, "peloton_data", dir);
    if (!fs.existsSync(dirPath)) {
      await mkdir(dirPath);
    }
  }
}

async function main() {
  await ensureDirs();
  const api = new Api();
  await api.initialize();
  if (FETCH_ALL_DATA) {
    await api.login();
    await api.getWorkoutHistory();
    await api.getSamples();
  }
  await api.processWorkouts();

  console.log(api.workouts.length);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
