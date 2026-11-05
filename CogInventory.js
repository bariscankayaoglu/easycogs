const ICON_QUALITY_MAP = {
  ["0"]: "Nooby",
  ["1"]: "Decent",
  ["2"]: "Superb",
  ["3"]: "Ultimate",
  ["Y"]: "Yang",
  ["Z"]: "Yin"
};
const ICON_TYPE_MAP = {
  ["A00"]: "Cog",
  ["A0"]: "CogB",
  ["A1"]: "Average",
  ["A2"]: "Spur",
  ["A3"]: "Stacked",
  ["A4"]: "Deckered",
  ["B0"]: "Double",
  ["B1"]: "Trips",
  ["B2"]: "Trabble",
  ["B3"]: "Quad",
  ["B4"]: "Penta",
  ["ad"]: "Adjacent",
  ["di"]: "Diagonal",
  ["up"]: "Up",
  ["do"]: "Down",
  ["le"]: "Left",
  ["ri"]: "Right",
  ["ro"]: "Row",
  ["co"]: "Column",
  ["cr"]: "Corner",
};
const YIN_MAP = {
  ["A00"]: "Yin_Top_Left_Cog",
  ["A01"]: "Yin_Top_Right_Cog",
  ["A02"]: "Yin_Bottom_Left_Cog",
  ["A03"]: "Yin_Bottom_Right_Cog"
};
// Crystal (gem) cogs CogCry0..CogCry5, in game order.
const CRYSTAL_ICON_MAP = {
  [0]: "Topaz_Cog",
  [1]: "Ruby_Cog",
  [2]: "Amethyst_Cog",
  [3]: "Garnet_Cog",
  [4]: "Emerald_Cog",
  [5]: "Bluegem_Cog"
};
// Placeholder art used when a cog code is recognized as a real cog but we have
// no dedicated icon for it (e.g. newer Idleon cog types). Keeps the board
// rendering instead of 404ing or crashing the load.
const UNKNOWN_COG_ICON = "assets/cpu.png";
const BLANK_COG_ICON = "assets/cog_blank.png";
const INV_ROWS = 8;
const INV_COLUMNS = 12;
const SPARE_START = 108;

class Cog {
  constructor(initialValues = {}) {
    this._key = initialValues.key;
    this.icon = initialValues.icon;
    this.initialKey = initialValues.initialKey !== undefined ? initialValues.initialKey : initialValues.key;
    this.buildRate = initialValues.buildRate;
    this.isPlayer = initialValues.isPlayer;
    this.isTiny = initialValues.isTiny;
    this.isFlag = initialValues.isFlag;
    this.expGain = initialValues.expGain;
    this.flaggy = initialValues.flaggy;
    this.expBonus = initialValues.expBonus;
    this.buildRadiusBoost = initialValues.buildRadiusBoost;
    this.expRadiusBoost = initialValues.expRadiusBoost;
    this.flaggyRadiusBoost = initialValues.flaggyRadiusBoost;
    this.boostRadius = initialValues.boostRadius;
    this.flagBoost = initialValues.flagBoost;
    this.nothing = initialValues.nothing; // Description: +% Nothing! LOL
    this.fixed = initialValues.fixed;
    this.blocked = initialValues.blocked;
    // Yin / Excogia: quadrant identity and the per-quadrant board-wide boost
    // values, used to compute the Excogia bonus live from formation.
    this.isYin = initialValues.isYin;
    this.yinQuadrant = initialValues.yinQuadrant;
    this.yinBuildBoost = initialValues.yinBuildBoost;
    this.yinExpBoost = initialValues.yinExpBoost;
    this._position = null;
  }
  get key() {
    return this._key
  }
  set key(v) {
    this._position = null;
    this._key = Number.parseInt(v)
  }
  position(keyNum) {
    const isDefault = keyNum === undefined;
    if (this._position && isDefault) return this._position;
    keyNum = keyNum ?? Number.parseInt(this.key);
    // board = 0-95
    // build = 96-107
    // spare = 108-*
    const location = keyNum >= 96 ? keyNum <= 107 ? "build" : "spare" : "board";
    let perRow = 3;
    let offset = SPARE_START;
    if (location === "board") {
      perRow = INV_COLUMNS;
      offset = 0;
    } else if (location === "build") {
      offset = 96;
    }
    const y = Math.floor((keyNum - offset) / perRow);
    const x = Math.floor((keyNum - offset) % perRow);
    const res = { location, x, y };
    if (isDefault) {
      this._position = res;
    }
    return res;
  }
}

class FakeBoard {
  constructor(inventory) {
    this.inventory = inventory;
    
    this.length = INV_ROWS;
    this[Symbol.Iterator] = function*() {
      for (let s = 0; s < INV_ROWS; s++) yield s;
    }

    for (let i = 0; i < INV_ROWS; i++) {
      const columnProxy = {
        length: INV_COLUMNS,
        [Symbol.Iterator]: function* () {
          for (let s = 0; s < INV_COLUMNS; s++) yield s;
        }
      }
      for (let j = 0; j < INV_COLUMNS; j++) {
        const key = i * INV_COLUMNS + j;
        Object.defineProperty(columnProxy, j, {
          get: () => this.inventory.get(key)
        });
      }
      Object.defineProperty(this, i, {
        get: () => columnProxy
      });
    }
  }
}

class CogInventory {
  constructor(cogs={}, slots={}) {
    this.cogs = cogs;
    this.slots = slots;
    this.flagPose = [];
    this.flaggyShopUpgrades = 0;
    this.availableSlotKeys = [];
    // Whether this account has unlocked the tiny-cog (mini) board, and which
    // spare-region slot keys are the active tiny-cog slots. Set in load().
    this.tinyBoardUnlocked = false;
    this.tinyBoardSlotKeys = [];
    this._score = null;
    // Saved for performance
    this._board = new FakeBoard(this);
  }
  
  get cogKeys() {
    return Object.keys(this.cogs);
  }
  
  get(key) {
    return this.cogs[key] || this.slots[key]
  }
  
  static _saveGet(arr, ...indexes) {
    while(indexes.length) {
      if (arr === undefined) break;
      arr = arr[indexes.splice(0, 1)[0]];
    }
    return arr;
  }
  
  load(save) {
    this.availableSlotKeys = [];
    this._score = null;

    let foo = [];
    foo[1] = "Beginner"; // White
    foo[2] = "Journeyman";
    foo[3] = "Maestro";
    foo[7] = "Warrior"; // 
    foo[8] = "Barbarian";
    foo[9] = "Squire";
    foo[10] = "Blood Berserker";
    foo[12] = "Divine Knight";
    foo[19] = "Archer"; // 
    foo[20] = "Bowman";
    foo[21] = "Hunter";
    foo[22] = "Siege Breaker";
    foo[25] = "Beast Master";
    foo[31] = "Mage"; // 
    foo[32] = "Wizard";
    foo[33] = "Shaman";
    foo[34] = "Elemental Sorcerer";

    const hatIcons = {};
    const playerNames = save["playerNames"];
    if (playerNames) {
      playerNames.forEach((v, i) => {
        const classNameSlot = `CharacterClass_${i}`;
        const classNameIndex = save[classNameSlot];
        const className = foo[classNameIndex];

        if (classNameIndex >= 31) {
          // Mage
          window.player._colorHead(.9, .77, 1);
        } else if (classNameIndex >= 19) {
          // Archer
          window.player._colorHead(.58, 1, .6);
        } else if (classNameIndex >= 7) {
          // Warrior
          window.player._colorHead(1, .77, .75);
        } else if (classNameIndex === 9) {
          // Squire
          window.player._colorHead(1, 1, 0);
        } else {
          // Beginner
          // Journeyman
          window.player._colorHead(.5, .91, .92);
        }

        const equipmentSlot = `EquipOrder_${i}`;
        const equipment = save[equipmentSlot];
        let hatFound = false;

        equipment.forEach((slots) => {
          const length = slots.length;
          for (let i = 0; i < length; i++) {
            const eqName = slots[i];
            if (eqName.indexOf("Hats") !== -1) {
              const match = eqName.match(/EquipmentHats(\d+)(?:_x1)?/);
              if (match.length === 2) {
                const index = parseInt(match[1]);
                hatIcons[v] = {
                  type: "hat",
                  path: window.player.render(index)
                };
                hatFound = true;
              }
              break;
            }
          }
        });
        if (!hatFound) {
          hatIcons[v] = {
            type: "head",
						path: "icons/head.png"
          };
        }
      });
    }

    // Fetch Gem-Shop flaggy upgrades
    this.flaggyShopUpgrades = JSON.parse(save["GemItemsPurchased"])[118];
    // Fetch the list of available cogs
    const cogRaw = JSON.parse(save["CogM"]);
    const cogCodes = JSON.parse(save["CogO"]);
    const cogIcons = cogCodes.map(c => CogInventory._decodeIcon(c, hatIcons));
    const cogArray = Object.entries(cogRaw).map(([key, c]) => {
      const keyNum = Number.parseInt(key);
      const code = cogCodes[keyNum];
      // Yin quadrant: "A00" (top-left), "A01" (top-right), "A02" (bottom-left),
      // "A03" (bottom-right). The game bakes boostRadius "everything" onto these
      // tiles ONLY while the 4 are in formation. We must NOT trust that static
      // flag once the solver can move tiles, so for Yin cogs we strip the
      // generic boostRadius and instead compute the board-wide bonus live from
      // the formation (see score()). The per-quadrant boost values (e/f) are
      // kept on yinBuildBoost / yinExpBoost for that live calculation.
      const yinMatch = typeof code === "string" ? code.match(/^CogZ(A0[0-3])$/) : null;
      const isYin = !!yinMatch;
      return new Cog({
        key: keyNum,
        icon: cogIcons[keyNum] || "Blank",
        buildRate: c.a,
        isPlayer: c.b > 0,
        expGain: c.b,
        flaggy: c.c,
        expBonus: c.d,
        buildRadiusBoost: isYin ? undefined : c.e,
        expRadiusBoost: isYin ? undefined : c.f,
        flaggyRadiusBoost: c.g,
        boostRadius: isYin ? undefined : c.h,
        flagBoost: c.j,
        nothing: c.k,
        // Yin quadrants are movable (the solver should be free to keep/form the
        // Excogia). Only non-Yin "everything" cogs stay fixed.
        fixed: !isYin && c.h === "everything",
        blocked: false,
        isYin: isYin,
        yinQuadrant: isYin ? yinMatch[1] : undefined,
        yinBuildBoost: isYin ? c.e : undefined,
        yinExpBoost: isYin ? c.f : undefined
      });
    });
    // Get the available board
    this.flagPose = JSON.parse(save["FlagP"]).filter(v=>v>=0); // Only first 4 are used
    const flagU = JSON.parse(save["FlagU"]);
    const slots = flagU.map((n, i) => {
      if (n > 0 && this.flagPose.includes(i)) return new Cog({ key: i, fixed: true, blocked: true, isFlag: true, icon: "Blank" });
      if (n !== -11) return new Cog({ key: i, fixed: true, blocked: true });
      return new Cog({ key: i, icon: "Blank" });
    });
    // Detect the tiny-cog (mini) board. Its slots live beyond the main board +
    // build region (key >= SPARE_START). The tiny board only exists in the
    // matrix once unlocked: an account without it has FlagU === 0 for the whole
    // spare region (see example2), while an account with it has active slots
    // there (FlagU === -11 for a usable tiny slot, or a non-zero "special"
    // value for a tiny slot currently being unlocked via a flag). So any
    // spare-region slot with FlagU !== 0 marks the tiny board as present.
    this.tinyBoardSlotKeys = [];
    for (let i = SPARE_START; i < flagU.length; i++) {
      if (flagU[i] !== 0) this.tinyBoardSlotKeys.push(i);
    }
    this.tinyBoardUnlocked = this.tinyBoardSlotKeys.length > 0;
    // Map slots and cogs to a key -> obj map
    this.slots = {};
    for (const slot of slots) {
      this.slots[slot.key] = slot;
      if (!slot.fixed) {
        this.availableSlotKeys.push(slot.key);
      }
    }
    this.cogs = {};
    for (const cog of cogArray) {
      this.cogs[cog.key] = cog;
    }

    // Tiny cogs (CogSm*) are intentionally NOT instantiated as cog objects.
    // They live on the separate tiny board (left/right columns), which we do
    // not draw or optimize yet, and the data cannot reliably tell an unlocked
    // tiny slot from a locked one. Leaving them out keeps the optimizer valid
    // (it can never move a tiny cog onto the main board) and the main board is
    // unaffected since tiny cogs carry no CogM stats.

    this._assignLabels();

    document.getElementById("notify").style.display = "none";
  }
  
  // Decode a single CogO entry into a renderable icon. This is intentionally
  // fault-tolerant: unknown or newer cog codes (e.g. Crystal "CogCry*" or the
  // "CogSm*" shelf family) resolve to a placeholder instead of throwing, so a
  // single unrecognized code can never abort the whole load. hatIcons maps a
  // player name -> its resolved hat/head icon (built earlier in load()).
  static _decodeIcon(c, hatIcons = {}) {
    if (typeof c !== "string" || c === "Blank") {
      return { type: "blank", path: BLANK_COG_ICON };
    }
    if (c.startsWith("Player")) {
      return hatIcons[c.substring(7)] || { type: "head", path: "icons/head.png" };
    }
    if (c === "CogY") {
      return { type: "cog", path: "icons/cogs/Yang_Cog.png" };
    }

    // Crystal cogs: CogCry0..CogCry5 map to the gem icons in game order.
    const cry = c.match(/^CogCry(\d+)$/);
    if (cry) {
      const name = CRYSTAL_ICON_MAP[Number.parseInt(cry[1])];
      if (name) return { type: "cog", path: "icons/cogs/" + name + ".png" };
      return { type: "cog", path: UNKNOWN_COG_ICON };
    }

    // Tiny cogs (tiny-board cog type). Metal is encoded by the family letter:
    //   CogSmb* -> gold   (TG)
    //   CogSma* -> silver (TS)
    //   CogSm_* -> bronze (TB)
    // Shown as text until dedicated art exists.
    if (c.startsWith("CogSm")) {
      if (c.startsWith("CogSmb")) return { type: "cog", text: "TG", tiny: true, metal: "gold" };
      if (c.startsWith("CogSma")) return { type: "cog", text: "TS", tiny: true, metal: "silver" };
      return { type: "cog", text: "TB", tiny: true, metal: "bronze" };
    }

    // Classic format: Cog<quality><type>, e.g. Cog0di, Cog3ro, CogZA00.
    const parsed = c.match(/^Cog([0123YZ])(.{2,3})$/);
    if (parsed) {
      const quality = parsed[1];
      const type = parsed[2];
      if (quality === "Z") {
        const name = YIN_MAP[type];
        if (name) return { type: "cog", path: "icons/cogs/" + name + ".png" };
      } else {
        const typeName = ICON_TYPE_MAP[type];
        const qualityName = ICON_QUALITY_MAP[quality];
        if (typeName && qualityName) {
          return { type: "cog", path: "icons/cogs/" + typeName + "_" + qualityName + ".png" };
        }
      }
    }

    // Anything else (new/unknown cog types) still renders as a real cog using a
    // generic placeholder so it participates in moves and numbering normally.
    return { type: "cog", path: UNKNOWN_COG_ICON };
  }

  // A "real" movable cog is one with an actual icon (not a blank/empty slot)
  // and not a blocked/fixed board tile. These are the items that can be moved
  // around and therefore need a stable identifier.
  static _isRealCog(cog) {
    if (!cog) return false;
    if (cog.blocked) return false;
    if (!cog.icon || cog.icon === "Blank" || cog.icon.type === "blank") return false;
    return true;
  }

  // Assign persistent numeric labels to every real cog, starting at 1.
  // Spare cogs (key >= 108) are numbered first, then board/build cogs, each in
  // ascending key order. The label travels with the cog as it moves, so the
  // final board shows exactly where each numbered cog ended up.
  _assignLabels() {
    const keys = Object.keys(this.cogs)
      .map((k) => Number.parseInt(k))
      .filter((k) => CogInventory._isRealCog(this.cogs[k]));

    keys.sort((a, b) => {
      const aSpare = a >= SPARE_START ? 0 : 1;
      const bSpare = b >= SPARE_START ? 0 : 1;
      if (aSpare !== bSpare) return aSpare - bSpare;
      return a - b;
    });

    // Build a stable map from each cog's original slot (initialKey) to its
    // display number. initialKey never changes as cogs move around, so the
    // number can always be looked up even after the solver rearranges cogs.
    const labelMap = {};
    let label = 1;
    for (const key of keys) {
      this.cogs[key].label = label;
      labelMap[key] = label; // key here is the cog's initial position
      label++;
    }
    if (typeof window !== "undefined" && window.g) {
      window.g.labelMap = labelMap;
    }
  }

  clone() {
    const c = {};
    for (let [k,v] of Object.entries(this.cogs)) {
      c[k] = new Cog(v);
    }
    const s = {};
    for (let [k,v] of Object.entries(this.slots)) {
      s[k] = new Cog(v);
    }
    const res = new CogInventory(c, s);
    res.flagPose = [...this.flagPose];
    res.flaggyShopUpgrades = this.flaggyShopUpgrades;
    res.availableSlotKeys = [...this.availableSlotKeys];
    return res;
  }
  
  get board() {
    return this._board;
  }

  // Scan the live board for complete Excogia formations: a 2x2 block of Yin
  // quadrants placed in their correct corners -- A00 top-left, A01 top-right,
  // A02 bottom-left, A03 bottom-right. Returns the total board-wide boost
  // (summed per quadrant, matching the game: 4 x 1.25% -> 5% build, etc.) that
  // should be applied to every board tile. Scattered Yin cogs contribute 0.
  _excogiaBoost() {
    // Index Yin cogs by their current board position for O(1) corner lookup.
    const byPos = {}; // "row,col" -> cog
    for (const key of this.availableSlotKeys) {
      const cog = this.get(key);
      if (cog && cog.isYin) {
        const p = cog.position();
        if (p.location === "board") byPos[p.y + "," + p.x] = cog;
      }
    }
    let build = 0, exp = 0, count = 0;
    for (const posKey of Object.keys(byPos)) {
      const tl = byPos[posKey];
      if (tl.yinQuadrant !== "A00") continue; // anchor on the top-left quadrant
      const [r, c] = posKey.split(",").map(Number);
      const tr = byPos[r + "," + (c + 1)];
      const bl = byPos[(r + 1) + "," + c];
      const br = byPos[(r + 1) + "," + (c + 1)];
      if (tr && tr.yinQuadrant === "A01" &&
          bl && bl.yinQuadrant === "A02" &&
          br && br.yinQuadrant === "A03") {
        // Complete, correctly-oriented 2x2 Excogia. Sum each quadrant's boost.
        for (const q of [tl, tr, bl, br]) {
          build += q.yinBuildBoost || 0;
          exp += q.yinExpBoost || 0;
          count++;
        }
      }
    }
    return { build, exp, formed: count > 0 };
  }

  get score() {
    if (this._score !== null) return this._score;

    const result = {
      buildRate: 0,
      expBonus: 0,
      flaggy: 0,
      expBoost: 0,
      flagBoost: 0
    };

    const board = this.board;
    const bonusGrid = Array(INV_ROWS).fill(0).map(() => { return Array(INV_COLUMNS).fill(0).map(() => { return { ...result } })});
    for (let key of this.availableSlotKeys) {
      const entry = this.get(key);
      if (!entry.boostRadius) continue;
      const boosted = [];
      const { x: j, y: i } = entry.position();
      switch (entry.boostRadius) {
        case "diagonal":
          boosted.push([i-1, j-1],[i-1, j+1],[i+1, j-1],[i+1, j+1]);
          break;
        case "adjacent":
          boosted.push([i-1, j],[i, j+1],[i+1, j],[i, j-1]);
          break;
        case "up":
          boosted.push([i-2, j-1],[i-2, j],[i-2, j+1],[i-1, j-1],[i-1, j],[i-1, j+1]);
          break;
        case "right":
          boosted.push([i-1, j+2],[i, j+2],[i+1, j+2],[i-1, j+1],[i, j+1],[i+1, j+1]);
          break;
        case "down":
          boosted.push([i+2, j-1],[i+2, j],[i+2, j+1],[i+1, j-1],[i+1, j],[i+1, j+1]);
          break;
        case "left":
          boosted.push([i-1, j-2],[i, j-2],[i+1, j-2],[i-1, j-1],[i, j-1],[i+1, j-1]);
          break;
        case "row":
          for (let k = 0; k < INV_COLUMNS; k++) {
            if(j == k) continue;
            boosted.push([i, k]);
          }
          break;
        case "column":
          for (let k = 0; k < INV_ROWS; k++) {
            if(i == k) continue;
            boosted.push([k, j]);
          }
          break;
        case "corner":
          boosted.push([i-2, j-2],[i-2, j+2],[i+2, j-2],[i+2, j+2]);
          break;
        case "around":
          boosted.push([i-2, j],[i-1, j-1],[i-1, j],[i-1, j+1],[i, j-2],[i, j-1],[i, j+1],[i, j+2],[i+1, j-1],[i+1, j],[i+1, j+1],[i+2, j]);
          break;
        case "everything":
          for (let k = 0; k < INV_ROWS; k++) {
            for (let l = 0; l < INV_COLUMNS; l++) {
              if(i === k && j === l) continue;
              boosted.push([k, l]);
            }
          }
          break;
        default:
          break;
      }
      for (const boostCord of boosted) {
        const bonus = CogInventory._saveGet(bonusGrid, ...boostCord);
        if (!bonus) continue;
        bonus.buildRate += entry.buildRadiusBoost  || 0;
        bonus.flaggy    += entry.flaggyRadiusBoost || 0;
        bonus.expBoost  += entry.expRadiusBoost    || 0;
        bonus.flagBoost += entry.flagBoost         || 0;
      }
    }

    // Excogia: a complete 2x2 Yin formation grants a board-wide build/exp boost.
    // Computed live from the current layout so the solver is rewarded for
    // keeping/forming it and penalized for breaking it. Applied to every tile.
    const excogia = this._excogiaBoost();
    if (excogia.formed) {
      for (let i = 0; i < INV_ROWS; i++) {
        for (let j = 0; j < INV_COLUMNS; j++) {
          bonusGrid[i][j].buildRate += excogia.build;
          bonusGrid[i][j].expBoost += excogia.exp;
        }
      }
    }
 
    // Bonus grid done, now we can sum everything up
    for (let key of this.availableSlotKeys) {
      const entry = this.get(key);
      result.buildRate += entry.buildRate || 0;
      result.expBonus += entry.expBonus || 0;
      result.flaggy += entry.flaggy || 0;
      const pos = entry.position();
      const bonus = bonusGrid[pos.y][pos.x];
      const b = (bonus.buildRate || 0) / 100;
      result.buildRate += Math.ceil((entry.buildRate || 0) * b);
      if (entry.isPlayer) {
        result.expBoost += bonus.expBoost || 0;
      }
      const f = (bonus.flaggy || 0) / 100;
      result.flaggy += Math.ceil((entry.flaggy || 0) * f);
    }
    for (let key of this.flagPose) {
      const entry = this.get(key);
      const pos = entry.position();
      const bonus = bonusGrid[pos.y][pos.x];
      result.flagBoost += bonus.flagBoost || 0;
    }
    result.flaggy = Math.floor(result.flaggy * (1 + this.flaggyShopUpgrades * 0.5));
    return this._score = result;
  }
  
  move(pos1, pos2) {
    this._score = null;
    if (Array.isArray(pos1)) {
      pos1 = pos1[0] * INV_COLUMNS + pos1[1];
      pos2 = pos2[0] * INV_COLUMNS + pos2[1];
    }
    if (pos1 instanceof Object) {
      pos1 = pos1.y * INV_COLUMNS + pos1.x;
      pos2 = pos2.y * INV_COLUMNS + pos2.x;
    }
    const temp = this.cogs[pos2];
    this.cogs[pos2] = this.cogs[pos1];
		if (!this.cogs[pos2]) {
			delete this.cogs[pos2];
		} else {
			this.cogs[pos2].key = pos2;
		}
    this.cogs[pos1] = temp;
		if (!this.cogs[pos1]) {
			delete this.cogs[pos1];
		} else {
			this.cogs[pos1].key = pos1;
		}
  }

  // ---- Excogia (2x2 Yin block) movement -------------------------------------
  // The 4 Yin quadrants only grant their board-wide bonus in a correct 2x2.
  // Random 1x1 swaps can never assemble that, so the solver instead keeps them
  // locked as a block and relocates the whole block. These helpers support
  // that: find the block, enumerate valid destinations, and move it atomically.

  // Board key of the Excogia's top-left (A00) cell when the 4 quadrants form a
  // correct 2x2; otherwise null. Only considers the board region (keys 0-95).
  excogiaAnchor() {
    const byPos = {};
    for (const key of Object.keys(this.cogs)) {
      const cog = this.cogs[key];
      if (!cog || !cog.isYin) continue;
      const p = cog.position();
      if (p.location === "board") byPos[p.y + "," + p.x] = cog;
    }
    for (const posKey of Object.keys(byPos)) {
      const tl = byPos[posKey];
      if (tl.yinQuadrant !== "A00") continue;
      const [r, c] = posKey.split(",").map(Number);
      const tr = byPos[r + "," + (c + 1)];
      const bl = byPos[(r + 1) + "," + c];
      const br = byPos[(r + 1) + "," + (c + 1)];
      if (tr && tr.yinQuadrant === "A01" && bl && bl.yinQuadrant === "A02" &&
          br && br.yinQuadrant === "A03") {
        return r * INV_COLUMNS + c;
      }
    }
    return null;
  }

  // Is the 2x2 whose top-left is board (r,c) fully on the board and all 4 cells
  // usable (unlocked, not blocked/fixed)? Used to pick valid block destinations.
  _is2x2Usable(r, c) {
    if (r < 0 || c < 0 || r + 1 >= INV_ROWS || c + 1 >= INV_COLUMNS) return false;
    for (const [rr, cc] of [[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]]) {
      const key = rr * INV_COLUMNS + cc;
      const slot = this.slots[key];
      // availableSlotKeys are the unlocked, non-fixed board/spare slots.
      if (!slot || slot.fixed || slot.blocked) return false;
      // The occupant must be a normal movable cog (not a flag/blocked/build).
      const occ = this.cogs[key];
      if (occ && (occ.fixed || occ.blocked)) return false;
    }
    return true;
  }

  // All valid 2x2 top-left board keys the Excogia could be placed at.
  validExcogiaAnchors() {
    const res = [];
    for (let r = 0; r + 1 < INV_ROWS; r++) {
      for (let c = 0; c + 1 < INV_COLUMNS; c++) {
        if (this._is2x2Usable(r, c)) res.push(r * INV_COLUMNS + c);
      }
    }
    return res;
  }

  // Move the Excogia block (currently anchored at srcTopLeftKey) to the 2x2
  // anchored at destTopLeftKey, swapping the 4 cogs there into the source 2x2.
  // Both anchors are board top-left keys. Keeps the quadrants' relative layout.
  moveExcogia(srcTopLeftKey, destTopLeftKey) {
    if (srcTopLeftKey === destTopLeftKey) return;
    this._score = null;
    const offs = [0, 1, INV_COLUMNS, INV_COLUMNS + 1]; // TL, TR, BL, BR
    // Snapshot the 4 source (Yin) and 4 dest cogs first.
    const srcCogs = offs.map(o => this.cogs[srcTopLeftKey + o]);
    const dstCogs = offs.map(o => this.cogs[destTopLeftKey + o]);
    for (let i = 0; i < 4; i++) {
      const srcKey = srcTopLeftKey + offs[i];
      const dstKey = destTopLeftKey + offs[i];
      // Yin quadrant -> dest cell
      if (srcCogs[i]) { this.cogs[dstKey] = srcCogs[i]; this.cogs[dstKey].key = dstKey; }
      else delete this.cogs[dstKey];
      // Displaced cog -> src cell
      if (dstCogs[i]) { this.cogs[srcKey] = dstCogs[i]; this.cogs[srcKey].key = srcKey; }
      else delete this.cogs[srcKey];
    }
  }
}