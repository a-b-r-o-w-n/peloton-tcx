import fetch from "node-fetch";

import { User, Workout, WorkoutResults, WorkoutSample } from "./types";
import { makeTcx } from "./makeTcx";

const baseUrl = "https://api.pelotoncycle.com";
const maxPerPage = 50;

export class Peloton {
  private user: User | null = null;
  private workouts: Workout[] = [];
  private samples = new Map<string, WorkoutSample>();

  public async login(username: string, password: string): Promise<void> {
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
  }

  public async getWorkoutHistory(limit: number): Promise<Workout[]> {
    let hasNextPage = true;
    let page = 0;
    const perPage = Math.min(limit, maxPerPage);

    while (hasNextPage) {
      const url = `${baseUrl}/api/user/${this.userId}/workouts?limit=${perPage}&page=${page}`;
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

    return this.workouts;
  }

  public async getSamples(): Promise<WorkoutSample[]> {
    const samples = await Promise.all(this.workouts.map((w) => this.getWorkoutSample(w.id)));
    return samples.filter(Boolean) as WorkoutSample[];
  }

  public async getWorkoutSample(workoutId: string): Promise<WorkoutSample | undefined> {
    console.log(`Fetching performance data for workout ${workoutId}`);
    const res = await fetch(`${baseUrl}/api/workout/${workoutId}/performance_graph?every_n=1&limit=14400`);
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
