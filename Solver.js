function yield() {
  return new Promise(r=>setTimeout(r,1));
}

class Solver {
  constructor(weights={}) {
    this.setWeights(weights.buildRate, weights.expBonus, weights.flaggy)
  }
  
  setWeights(buildRate, expBonus, flaggy) {
    this.weights = {
      buildRate: buildRate,
      expBonus: expBonus,
      flaggy: flaggy
    }
  }
  
  getScoreSum(score) {
    let res = 0;
    res += score.buildRate * this.weights.buildRate;
    res += score.expBonus * this.weights.expBonus * (score.expBoost + 10) / 10; // For now we just assume 10 players...
    res += score.flaggy * this.weights.flaggy * (score.flagBoost + 4) / 4;
    return res;
  }
  
  static _yield() {
    return new Promise(r=>setTimeout(r,1));
  }

  // Do the two 2x2 blocks (given by their top-left board keys) share any cell?
  // Overlapping block moves are skipped to keep moveExcogia's swap unambiguous.
  _overlaps2x2(aKey, bKey) {
    const COLS = 12;
    const cells = (k) => {
      const r = Math.floor(k / COLS), c = k % COLS;
      return new Set([k, r*COLS+c+1, (r+1)*COLS+c, (r+1)*COLS+c+1]);
    };
    const a = cells(aKey), b = cells(bKey);
    for (const x of a) if (b.has(x)) return true;
    return false;
  }
  
  /**
   * solveTime: Number - Time in ms how long the solver should run
   */
  async solve(inventory, solveTime=1000) {
    if (inventory.flagPose.length === 0) {
      // No flaggs placed means no use for flaggy rate
      this.weights.flaggy = 0;
    }
    let lastYield = Date.now();
    let state = inventory.clone();
    const solutions = [state];
    const startTime = Date.now();
    // Only the main board (keys 0-95) is a valid optimization destination.
    // availableSlotKeys also contains build (96-107) and unlocked spare/tiny
    // slots (>=108); swapping board cogs into those would move cogs off the
    // board and leave holes, so restrict swap targets to board slots here.
    const allSlots = inventory.availableSlotKeys.filter((k) => k < 96);
    const hasExcogia = inventory.excogiaAnchor() !== null;
    const excogiaAnchors = hasExcogia ? inventory.validExcogiaAnchors() : [];
    let counter = 0;
    let currentScore = this.getScoreSum(state.score);

    while(Date.now() - startTime < solveTime) {
      if(Date.now() - lastYield > 100) {
        // Prevent UI from freezing with very high solve times
        await Solver._yield();
        lastYield = Date.now();
      }
      counter++;
      if (counter % 10000 === 0) {
        state = inventory.clone();
        this.shuffle(state);
        currentScore = this.getScoreSum(state.score);
        solutions.push(state);
      }

      // Every so often, try relocating the whole Excogia block to a random valid
      // 2x2. Yin cogs are never moved by 1x1 swaps (they'd break the formation),
      // so this block move is how the solver explores Excogia placement.
      if (hasExcogia && counter % 7 === 0 && excogiaAnchors.length) {
        const src = state.excogiaAnchor();
        if (src !== null) {
          const dest = excogiaAnchors[Math.floor(Math.random() * excogiaAnchors.length)];
          if (!this._overlaps2x2(src, dest)) {
            state.moveExcogia(src, dest);
            const su = this.getScoreSum(state.score);
            if (su > currentScore) currentScore = su;
            else state.moveExcogia(dest, src); // revert
          }
        }
        continue;
      }

      const slotKey = allSlots[Math.floor(Math.random() * allSlots.length)];
      // Moving a cog to an empty space changes the list of cog keys, so we need to re-fetch this
      const allKeys = state.cogKeys;
      const cogKey = allKeys[Math.floor(Math.random() * allKeys.length)];
      const slot = state.get(slotKey);
      const cog = state.get(cogKey);

      // Only rearrange cogs within the board. Skip if either endpoint is fixed,
      // tiny, or Yin (Yin moves only as a 2x2 block, above), and require the cog
      // being moved to currently live on the board -- never pull a build/spare
      // cog onto the board (that would move a board cog off-board, leaving a
      // hole). slotKey is already board-only (allSlots filtered to <96).
      if (slot.fixed || cog.fixed || cog.isTiny || slot.isTiny || cog.isYin || slot.isYin
          || cog.position().location !== "board") continue;
      state.move(slotKey, cogKey);
      const scoreSumUpdate = this.getScoreSum(state.score);
      if (scoreSumUpdate > currentScore) {
        currentScore = scoreSumUpdate;
      } else {
        state.move(slotKey, cogKey);
      }
    }
    const scores = solutions.map((s)=>this.getScoreSum(s.score));
    const bestIndex = scores.indexOf(scores.reduce((a,b)=>Math.max(a,b)));
    let best = solutions[bestIndex];
    if (g.best === null || this.getScoreSum(g.best.score) < scores[bestIndex]) {
      g.best = best;
    } else {
      best = g.best;
    }
    this.removeUselesMoves(best);
    return best;
  }
  
  shuffle(inventory, n = 500) {
    const allSlots = inventory.availableSlotKeys.filter((k) => k < 96);
    for (let i = 0; i < n; i++) {
      const slotKey = allSlots[Math.floor(Math.random() * allSlots.length)];
      // Moving a cog to an empty space changes the list of cog keys, so we need to re-fetch this
      const allKeys = inventory.cogKeys;
      const cogKey = allKeys[Math.floor(Math.random() * allKeys.length)];
      const slot = inventory.get(slotKey);
      const cog = inventory.get(cogKey);

      // Freeze tiny and Yin cogs (see solve()); only rearrange board cogs.
      if (slot.fixed || cog.fixed || cog.isTiny || slot.isTiny || cog.isYin || slot.isYin
          || cog.position().location !== "board") continue;
      inventory.move(slotKey, cogKey);
    }
  }
  
  removeUselesMoves(inventory) {
    const goal = inventory.score;
    const cogsToMove = Object.values(inventory.cogs)
      // Yin cogs move only as a 2x2 block; never try to revert them individually
      // here, which would break the Excogia formation.
      .filter((c) => c.key !== c.initialKey && !c.isYin);
    // Check if move still changes something
    for (let i = 0; i < cogsToMove.length; i++) {
      const cog1 = cogsToMove[i];
      const cog1Key = cog1.key;
      const cog2Key = cog1.initialKey;
      inventory.move(cog1Key, cog2Key);
      const changed = inventory.score;
      if (changed.buildRate === goal.buildRate
        && changed.flaggy === goal.flaggy
        && changed.expBonus === goal.expBonus
        && changed.expBoost === goal.expBoost
        && changed.flagBoost === goal.flagBoost) {
        continue;
      }
      inventory.move(cog1Key, cog2Key);
    }
  }
}