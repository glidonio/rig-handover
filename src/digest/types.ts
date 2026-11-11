// One line of runs/<night>.jsonl, after it parsed and passed the checks in read.ts.
export type RunStatus = 'ok' | 'retry' | 'fail';

export type RunLine = {
  at: string; // ISO time with its offset, kept as written in the log
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row of the digest: everything the log says about one job in one night.
// Times keep the offset from the log. `owner` is null when no line named one.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number; // all lines for the job
  retries: number; // lines with status "retry"
  lastStatus: RunStatus;
  lastError: string | null; // error of the newest line that has one
  firstAt: string;
  lastAt: string;
};

// What readNight returns for a night that has a file.
export type NightReading = {
  night: string;
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that did not parse or failed the checks; never thrown
  counts: Record<RunStatus, number>; // valid lines in the night, by status
};

// readNight(runsDir, night) reads runs/<night>.jsonl.
// Returns null when the file does not exist or the night is not YYYY-MM-DD.
export type ReadNight = (runsDir: string, night: string) => NightReading | null;
