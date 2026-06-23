// Standalone harness mirroring exerciseLog.js pure parser pieces, for verification.
const LBS_PER_KG = 2.20462;
function roundWeight(value, unit) {
  if (unit === 'kg') return Math.round(value * 2) / 2;
  return Math.round(value);
}
function convertWeight(value, fromUnit, toUnit) {
  const v = Number(value) || 0;
  if (!fromUnit || !toUnit || fromUnit === toUnit) return v;
  if (fromUnit === 'kg' && toUnit === 'lbs') return roundWeight(v * LBS_PER_KG, 'lbs');
  if (fromUnit === 'lbs' && toUnit === 'kg') return roundWeight(v / LBS_PER_KG, 'kg');
  return v;
}

// ===== NEW CODE (copied verbatim into exerciseLog.js) =====

const NUM_SMALL = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const NUM_TENS = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

// Consume a run of number-words at tokens[i]; returns [value, nextIndex] or null.
// Handles standalone ("eight"=8, "twelve"=12), tens ("forty five"=45), formal
// hundreds ("one hundred eighty five"=185) AND gym-colloquial hundreds where the
// word "hundred" is dropped ("one eighty five"=185, "two twenty five"=225,
// "two oh five"=205).
function consumeNumber(tokens, i) {
  const t = tokens[i];
  if (!(t in NUM_SMALL) && !(t in NUM_TENS)) return null;

  let value = 0;
  let j = i;
  let consumedAny = false;

  // Leading hundreds: a 1-9 word followed by "hundred", or (colloquial) directly
  // by a tens word / "oh" with no "hundred" spoken.
  if (tokens[j] in NUM_SMALL && NUM_SMALL[tokens[j]] >= 1 && NUM_SMALL[tokens[j]] <= 9) {
    const lead = NUM_SMALL[tokens[j]];
    const next = tokens[j + 1];
    if (next === 'hundred') {
      value += lead * 100; j += 2;
      if (tokens[j] === 'and') j++;
      consumedAny = true;
    } else if (next in NUM_TENS || (next in NUM_SMALL && NUM_SMALL[next] >= 10) || next === 'oh' || next === 'o') {
      // colloquial: "two twenty five"=225, "three fifteen"=315, "two oh five"=205
      value += lead * 100; j += 1; consumedAny = true;
    }
  }

  if (tokens[j] in NUM_TENS) {
    value += NUM_TENS[tokens[j]]; j++; consumedAny = true;
    if (tokens[j] in NUM_SMALL && NUM_SMALL[tokens[j]] <= 9) { value += NUM_SMALL[tokens[j]]; j++; }
  } else if ((tokens[j] === 'oh' || tokens[j] === 'o') && consumedAny) {
    j++;
    if (tokens[j] in NUM_SMALL && NUM_SMALL[tokens[j]] <= 9) { value += NUM_SMALL[tokens[j]]; j++; }
  } else if (tokens[j] in NUM_SMALL) {
    value += NUM_SMALL[tokens[j]]; j++; consumedAny = true;
  }

  if (!consumedAny) return null;
  return [value, j];
}

// Replace spoken number-words with digits before the structural regexes run.
function wordsToDigits(text) {
  const tokens = text.split(/[\s-]+/).filter(Boolean);
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    const res = consumeNumber(tokens, i);
    if (res) { out.push(String(res[0])); i = res[1]; }
    else { out.push(tokens[i]); i++; }
  }
  return out.join(' ');
}

function parseExerciseInput(text, defaultUnit = 'lbs') {
  const input = text.trim().toLowerCase();
  const exercises = [];
  const lines = input.split(/\n|,\s*then\s+|,\s*and\s+then\s+|\.\s+/).filter(Boolean);
  for (const line of lines) {
    const parsed = parseSingleExercise(line.trim(), defaultUnit);
    if (parsed) exercises.push(parsed);
  }
  return exercises;
}

function parseSingleExercise(text, defaultUnit = 'lbs') {
  if (!text || text.length < 3) return null;

  let name = '';
  let sets = 1;
  let reps = 0;
  let weight = 0;
  let rpe = null;

  let clean = text
    .replace(/^(i did|i do|did|do)\s+/i, '')
    .replace(/^(then|and|also)\s+/i, '')
    .trim();

  // Spoken numbers -> digits, then normalize "by"/"times" separators to "x".
  clean = wordsToDigits(clean);
  clean = clean.replace(/(\d)\s*(?:x|times|by)\s*(\d)/gi, '$1 x $2');

  // RPE cue, captured before name extraction so it doesn't pollute the name.
  // (Freeform effort commentary like "last set was a grinder" is left for the
  // T2 LLM parse — trying to strip it offline pollutes the exercise name.)
  const rpeMatch = clean.match(/\b(?:rpe|at rpe)\s*(\d+(?:\.\d+)?)\b/i);
  if (rpeMatch) { rpe = parseFloat(rpeMatch[1]); clean = clean.replace(rpeMatch[0], ' ').trim(); }

  const setsRepsMatch = clean.match(/(\d+)\s*[xX×]\s*(\d+)/);
  if (setsRepsMatch) {
    sets = parseInt(setsRepsMatch[1]);
    reps = parseInt(setsRepsMatch[2]);
    clean = clean.replace(setsRepsMatch[0], ' ').trim();
  }

  const setsOfMatch = clean.match(/(\d+)\s*sets?\s*(?:of\s*)?(\d+)\s*(?:reps?)?/i);
  if (setsOfMatch && !setsRepsMatch) {
    sets = parseInt(setsOfMatch[1]);
    reps = parseInt(setsOfMatch[2]);
    clean = clean.replace(setsOfMatch[0], ' ').trim();
  }

  const forNMatch = clean.match(/\bfor\s+(\d+)\s*(?:reps?)?\b/i);
  if (forNMatch && !reps) {
    reps = parseInt(forNMatch[1]);
    clean = clean.replace(forNMatch[0], ' ').trim();
  }

  const repsMatch = clean.match(/(\d+)\s*reps?\b/i);
  if (repsMatch && !reps) {
    reps = parseInt(repsMatch[1]);
    clean = clean.replace(repsMatch[0], ' ').trim();
  }

  const repsWasExplicit = reps > 0;

  // Weight: an explicit cue ("at/@/with") or a unit means weight at ANY magnitude
  // (fixes light dumbbell loss, e.g. "3x8 at 15"). Otherwise fall back to the
  // big-number heuristic so a bare trailing number still resolves.
  const cuedWeight = clean.match(/(?:\bat|\bwith|@)\s*(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilos?)?\b/i);
  const unitWeight = clean.match(/(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilos?)\b/i);
  const wm = cuedWeight || unitWeight;
  if (wm) {
    const val = parseFloat(wm[1]);
    const unitToken = (wm[2] || '').toLowerCase();
    const spokenUnit = /kg|kilo/.test(unitToken) ? 'kg' : (/lb|pound/.test(unitToken) ? 'lbs' : null);
    weight = spokenUnit ? convertWeight(val, spokenUnit, defaultUnit) : val;
    clean = clean.replace(wm[0], ' ').trim();
  } else {
    const bare = clean.match(/\b(\d+(?:\.\d+)?)\b/);
    if (bare) {
      const val = parseFloat(bare[1]);
      if (val > 20) {
        weight = val;
        clean = clean.replace(bare[0], ' ').trim();
      } else if (!reps) {
        reps = val;
        clean = clean.replace(bare[0], ' ').trim();
      }
    }
  }

  const justSetsMatch = clean.match(/(\d+)\s*sets?\b/i);
  if (justSetsMatch && sets === 1) {
    sets = parseInt(justSetsMatch[1]);
    clean = clean.replace(justSetsMatch[0], ' ').trim();
  }

  name = clean
    .replace(/\d+/g, ' ')
    .replace(/\b(lbs?|pounds?|kg|kilos?|at|with|of|for|reps?|sets?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  name = name.replace(/\b\w/g, c => c.toUpperCase());

  if (!name) return null;
  if (!reps) reps = 10;

  // Confidence drives whether the staging UI should highlight a row for review.
  const confidence = !repsWasExplicit ? 'low' : 'high';

  const setsArray = [];
  for (let i = 0; i < sets; i++) setsArray.push({ reps, weight });

  return { name, sets: setsArray, rpe, confidence };
}

// ===== END NEW CODE =====

// ---- assertions ----
let pass = 0, fail = 0;
function check(input, expect, unit = 'lbs') {
  const out = parseExerciseInput(input, unit);
  const got = out[0];
  const ok = got && got.name === expect.name &&
    got.sets.length === expect.sets &&
    got.sets[0].reps === expect.reps &&
    got.sets[0].weight === expect.weight &&
    (expect.rpe === undefined || got.rpe === expect.rpe) &&
    (expect.effort === undefined || got.effort === expect.effort) &&
    (expect.confidence === undefined || got.confidence === expect.confidence);
  if (ok) { pass++; }
  else { fail++; console.log(`FAIL: "${input}"\n  expected ${JSON.stringify(expect)}\n  got      ${JSON.stringify(got)}`); }
}

// digit input still works (regression)
check('bench press 3x8 185', { name: 'Bench Press', sets: 3, reps: 8, weight: 185 });
check('squat 5x5 225', { name: 'Squat', sets: 5, reps: 5, weight: 225 });

// "by" separator (STT outputs "by", not "x")
check('bench press 3 by 8 at 185', { name: 'Bench Press', sets: 3, reps: 8, weight: 185 });

// verbal numbers
check('bench press three by eight at one eighty five', { name: 'Bench Press', sets: 3, reps: 8, weight: 185 });
check('squat five by five at two twenty five', { name: 'Squat', sets: 5, reps: 5, weight: 225 });
check('deadlift three by three at three fifteen', { name: 'Deadlift', sets: 3, reps: 3, weight: 315 });
check('overhead press for twelve at ninety five', { name: 'Overhead Press', sets: 1, reps: 12, weight: 95 });
check('curls three sets of fifteen at forty five', { name: 'Curls', sets: 3, reps: 15, weight: 45 });
check('bench two oh five for five', { name: 'Bench', sets: 1, reps: 5, weight: 205 });
check('incline press one hundred eighty five for eight', { name: 'Incline Press', sets: 1, reps: 8, weight: 185 });

// light dumbbell with cue (the "3x8 at 15" loss bug)
check('lateral raises 3x12 at 15', { name: 'Lateral Raises', sets: 3, reps: 12, weight: 15 });
check('lateral raises three by twelve at fifteen', { name: 'Lateral Raises', sets: 3, reps: 12, weight: 15 });

// kg conversion (profile in lbs)
check('squat 5x5 at 100 kg', { name: 'Squat', sets: 5, reps: 5, weight: 220 });
// kg profile keeps kg
check('squat five by five at one hundred kilos', { name: 'Squat', sets: 5, reps: 5, weight: 100 }, 'kg');

// RPE capture
check('bench 3x8 at 185 rpe 8', { name: 'Bench', sets: 3, reps: 8, weight: 185, rpe: 8 });

// confidence: reps defaulted -> low
check('bench press at 185', { name: 'Bench Press', sets: 1, reps: 10, weight: 185, confidence: 'low' });
check('bench press 3x8 185', { name: 'Bench Press', sets: 3, reps: 8, weight: 185, confidence: 'high' });

// bodyweight-ish, no weight
check('pull ups 3x10', { name: 'Pull Ups', sets: 3, reps: 10, weight: 0 });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
