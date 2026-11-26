import { MAP_LABELS } from './map'

export default function PhantomGuide() {
  return (
    <section className="phantom-guide" aria-labelledby="phantom-guide-title">
      <h3 id="phantom-guide-title">How to play</h3>
      <p>Collect at least 60% of the coins to unlock the green exit. Reach it before time runs out to advance. Touching a phantom ends the run.</p>
      <p>Coins are worth 100 points, a level clear earns 500, and collecting every coin adds a 200-point bonus.</p>

      <div className="phantom-guide-grid">
        <section>
          <h4>Enemies</h4>
          <dl>
            <div><dt className="phantom-patroller">Patroller</dt><dd>The purple phantom follows a predictable route.</dd></div>
            <div><dt className="phantom-chaser">Chaser</dt><dd>The pink phantom pursues you through nearby passages. An alert marker shows when it has spotted you.</dd></div>
          </dl>
        </section>
        <section>
          <h4>Map types</h4>
          <dl>
            <div><dt>{MAP_LABELS.arena}</dt><dd>Open space with scattered obstacles.</dd></div>
            <div><dt>{MAP_LABELS.rooms}</dt><dd>Rooms linked by narrow corridors.</dd></div>
            <div><dt>{MAP_LABELS.hybrid}</dt><dd>Wider chambers and tight passages, from level 4.</dd></div>
            <div><dt>{MAP_LABELS.labyrinth}</dt><dd>Winding passages and alternate routes, from level 7.</dd></div>
          </dl>
        </section>
      </div>

      <p className="phantom-seed-note">The run seed and level number determine the map. Retry Maze restarts at level 1 with the same seed. New Maze picks a new seed.</p>
    </section>
  )
}
