import fetch from "node-fetch";
import log from "loglevel";

import { User, Workout, WorkoutResults, WorkoutSample } from "./types";
import { makeTcx } from "./makeTcx";

const baseUrl = "https://api.pelotoncycle.com";
const maxPerPage = 50;

export class Peloton {
  private user: User | null = null;
  private workouts: Workout[] = [];
  private samples = new Map<string, WorkoutSample>();

  public async login(username: string, password: string): Promise<void> {
    log.info("Logging in to Peloton.");
    log.debug("fetch: %s", `${baseUrl}/auth/login`);
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "post",
      body: JSON.stringify({
        username_or_email: username,
        password: password,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    const user = await res.json();

    this.user = user;
    log.info("Login success!");
    log.debug("User id: %s", this.userId);
    log.debug("Session id: %s", this.sessionId);
  }

  public async getWorkoutHistory(limit: number): Promise<Workout[]> {
    log.info("Getting last %d workouts.", limit);
    let hasNextPage = true;
    let page = 0;
    const perPage = Math.min(limit, maxPerPage);

    while (hasNextPage) {
      const url = `${baseUrl}/api/user/${this.userId}/workouts?limit=${perPage}&page=${page}`;
      log.debug("fetch: %s", url);
      const res = await fetch(url, {
        headers: this.defaultHeaders,
      });
      const workoutsRes = await res.json();

      for (const w of workoutsRes.data as Workout[]) {
        if (this.workouts.length < limit) {
          this.workouts.push(w);
        } else {
          break;
        }
      }

      hasNextPage = this.workouts.length < limit && !!workoutsRes.show_next;
      page++;
    }

    log.info("Done getting workouts.");
    return this.workouts;
  }

  public async getSamples(): Promise<WorkoutSample[]> {
    const samples = await Promise.all(this.workouts.map((w) => this.getWorkoutSample(w.id)));
    return samples.filter(Boolean) as WorkoutSample[];
  }

  public async getWorkoutSample(workoutId: string): Promise<WorkoutSample | undefined> {
    log.debug(`Fetching performance data for workout ${workoutId}`);
    const sampleUrl = `${baseUrl}/api/workout/${workoutId}/performance_graph?every_n=1&limit=14400`;
    log.debug("fetch: %s", sampleUrl);
    const res = await fetch(sampleUrl);
    const data = (await res.json()) as WorkoutSample;

    if (data) {
      this.samples.set(workoutId, data);

      return data;
    }
  }

  public async processWorkouts(): Promise<WorkoutResults> {
    const results: { [name: string]: string } = {};

    for (const workout of this.workouts) {
      const d = new Date(workout.start_time * 1000);
      const sample = this.samples.get(workout.id);

      if (workout.fitness_discipline === "running" && sample) {
        log.debug("Processing workout: %s", workout.id);
        const xml = await makeTcx(workout, sample);
        results[`${d.toISOString().replace(/T.*/, "")}_${workout.id}.tcx`] = xml;
      }
    }

    return results;
  }

  private get userId() {
    if (!this.user) {
      throw new Error("Must authenticate first.");
    }

    return this.user.user_id;
  }

  private get sessionId() {
    if (!this.user) {
      throw new Error("Must authenticate first.");
    }

    return this.user.session_id;
  }

  private get defaultHeaders() {
    if (!this.user) {
      throw new Error("Must authenticate first.");
    }

    return {
      cookie: `peloton_session_id=${this.sessionId};`,
    };
  }
}
