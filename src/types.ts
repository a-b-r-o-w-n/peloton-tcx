export type User = {
  user_id: string;
  session_id: string;
};

export type Workout = {
  created_at: number;
  end_time: number;
  fitness_discipline: string;
  id: string;
  name: string;
  peloton_id: null;
  start_time: number;
  title: string;
  total_work: number;
  user_id: string;
  workout_type: string;
  created: number;
  device_time_created_at: number;
};

type WorkoutSummary = {
  display_name: string;
  display_unit: string;
  value: number;
  slug: "calories" | "distance" | "total_output" | "elevation";
};

type WorkoutMetricAlternative = Omit<WorkoutMetric, "alternatives">;

type WorkoutMetric = {
  display_name: string;
  display_unit: string;
  max_value: number;
  average_value: number;
  values: number[];
  slug: "heart_rate" | "output" | "incline" | "pace";
  alternatives?: WorkoutMetricAlternative[];
};

export type WorkoutSample = {
  duration: number;
  seconds_since_pedaling_start: number[];
  summaries: WorkoutSummary[];
  metrics: WorkoutMetric[];
};

export type WorkoutResults = { [name: string]: WorkoutXml };
export type WorkoutXml = string;
