import type { NightReading } from '../digest/types.js';

// A retry count of 3 or more, or a last status of fail, is flagged. Missing owner or error shows as —.
export function DigestTable({ reading }: { reading: NightReading }) {
  return (
    <>
      <h1>digest {reading.night}</h1>
      {reading.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last</th>
              <th>last error</th>
              <th>first</th>
              <th>last at</th>
            </tr>
          </thead>
          <tbody>
            {reading.rows.map((r) => {
              return (
                <tr>
                  <td>{r.job}</td>
                  <td>{r.owner ?? '—'}</td>
                  <td>{r.runs}</td>
                  <td class={r.retries >= 3 ? 'warn' : undefined}>{r.retries}</td>
                  <td class={r.lastStatus === 'fail' ? 'warn' : undefined}>{r.lastStatus}</td>
                  <td>{r.lastError ?? '—'}</td>
                  <td>{r.firstAt}</td>
                  <td>{r.lastAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {reading.badLines > 0 ? (
        <p class="warn">{reading.badLines} bad line(s) in the log, not shown</p>
      ) : null}
    </>
  );
}
