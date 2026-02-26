// ============================================================
// COACH NUDGES — Data-driven coach observations for loggers
// Analyzes exercise log history and generates personalized
// nudges in each coach's voice.
// ============================================================

import { getExerciseLog } from './exerciseLog';
import { buildMemorySummary } from './storage';

// ─── MUSCLE GROUP MAPPING ───────────────────────────────────────
// Maps common exercise names → muscle groups for imbalance detection
const EXERCISE_MUSCLES = {
  // Chest
  'bench press': 'chest', 'incline bench press': 'chest', 'incline bench': 'chest',
  'decline bench press': 'chest', 'dumbbell bench press': 'chest',
  'dumbbell fly': 'chest', 'cable fly': 'chest', 'chest fly': 'chest',
  'push up': 'chest', 'push ups': 'chest', 'pec deck': 'chest',
  'chest press': 'chest', 'dips': 'chest',
  // Back
  'barbell row': 'back', 'bent over row': 'back', 'pendlay row': 'back',
  'dumbbell row': 'back', 'cable row': 'back', 'seated row': 'back',
  'pull up': 'back', 'pull ups': 'back', 'chin up': 'back', 'chin ups': 'back',
  'lat pulldown': 'back', 'lat pull down': 'back', 't-bar row': 'back',
  'face pull': 'back', 'face pulls': 'back',
  // Legs
  'squat': 'legs', 'back squat': 'legs', 'front squat': 'legs',
  'leg press': 'legs', 'leg curl': 'legs', 'leg extension': 'legs',
  'lunge': 'legs', 'lunges': 'legs', 'walking lunge': 'legs',
  'bulgarian split squat': 'legs', 'hack squat': 'legs',
  'calf raise': 'legs', 'calf raises': 'legs',
  'romanian deadlift': 'legs', 'rdl': 'legs',
  // Shoulders
  'overhead press': 'shoulders', 'ohp': 'shoulders',
  'military press': 'shoulders', 'shoulder press': 'shoulders',
  'lateral raise': 'shoulders', 'lateral raises': 'shoulders',
  'front raise': 'shoulders', 'front raises': 'shoulders',
  'arnold press': 'shoulders', 'upright row': 'shoulders',
  'rear delt fly': 'shoulders',
  // Arms
  'bicep curl': 'arms', 'bicep curls': 'arms', 'curl': 'arms',
  'hammer curl': 'arms', 'hammer curls': 'arms',
  'preacher curl': 'arms', 'concentration curl': 'arms',
  'tricep pushdown': 'arms', 'tricep extension': 'arms',
  'skull crusher': 'arms', 'skull crushers': 'arms',
  'close grip bench': 'arms', 'overhead tricep extension': 'arms',
  // Deadlift (compound - back + legs)
  'deadlift': 'back', 'sumo deadlift': 'back', 'trap bar deadlift': 'back',
  // Core
  'plank': 'core', 'crunch': 'core', 'crunches': 'core',
  'sit up': 'core', 'sit ups': 'core', 'ab wheel': 'core',
  'leg raise': 'core', 'hanging leg raise': 'core',
  'russian twist': 'core', 'cable woodchop': 'core',
};

function getMuscleGroup(exerciseName) {
  const normalized = exerciseName.toLowerCase().trim();
  return EXERCISE_MUSCLES[normalized] || null;
}

// ─── ANALYZE LOG FOR NUDGES ─────────────────────────────────────

export async function generateCoachNudges(coachId) {
  const nudges = [];

  try {
    const log = await getExerciseLog();
    if (!log || log.length === 0) return nudges;

    const memory = await buildMemorySummary();
    const now = new Date();

    // ─── 1. STREAK RECOGNITION ────────────────────────────────
    const streak = memory?.streak || 0;
    if (streak >= 3) {
      nudges.push({
        type: 'streak',
        priority: streak >= 7 ? 3 : 2,
        data: { streak },
        messages: {
          drill: streak >= 7
            ? `${streak} days straight. That's not luck — that's DISCIPLINE.`
            : `${streak}-day streak. Don't break the chain.`,
          hype: streak >= 7
            ? `${streak} DAYS IN A ROW?! You're literally unstoppable!! 🔥🔥`
            : `${streak}-day streak!! Keep that fire going! 🔥`,
          zen: streak >= 7
            ? `${streak} days of consistent practice. Your dedication is its own reward.`
            : `${streak} days flowing. The river doesn't stop.`,
        },
      });
    }

    // ─── 2. PLATEAU DETECTION ─────────────────────────────────
    // Check if any exercise has had the same weight for 3+ sessions
    const exerciseHistory = {};
    for (const session of log) {
      for (const ex of session.exercises) {
        const name = ex.name.toLowerCase().trim();
        if (!exerciseHistory[name]) exerciseHistory[name] = [];
        const maxWeight = Math.max(...ex.sets.map(s => s.weight || 0));
        if (maxWeight > 0) {
          exerciseHistory[name].push({
            weight: maxWeight,
            date: session.date,
            displayName: ex.name,
          });
        }
      }
    }

    for (const [name, history] of Object.entries(exerciseHistory)) {
      if (history.length < 3) continue;
      const recent = history.slice(-4);
      const weights = recent.map(h => h.weight);
      const allSame = weights.every(w => w === weights[0]);

      if (allSame && recent.length >= 3) {
        nudges.push({
          type: 'plateau',
          priority: 2,
          data: { exercise: recent[0].displayName, weight: weights[0], sessions: recent.length },
          messages: {
            drill: `${recent[0].displayName} at ${weights[0]} for ${recent.length} sessions. Time to move up or you're going backwards.`,
            hype: `You've been crushing ${recent[0].displayName} at ${weights[0]} for a while — maybe it's time to level up? 💪`,
            zen: `${recent[0].displayName} has been steady at ${weights[0]} for ${recent.length} sessions. Consider whether growth awaits at the next level.`,
          },
        });
      }
    }

    // ─── 3. MUSCLE IMBALANCE ──────────────────────────────────
    // Check last 14 days of sessions for muscle group coverage
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const recentMuscles = {};
    const muscleLastDate = {};

    for (const session of log) {
      const sessionDate = new Date(session.date);
      if (sessionDate < twoWeeksAgo) continue;

      for (const ex of session.exercises) {
        const muscle = getMuscleGroup(ex.name);
        if (muscle) {
          recentMuscles[muscle] = (recentMuscles[muscle] || 0) + 1;
          if (!muscleLastDate[muscle] || sessionDate > new Date(muscleLastDate[muscle])) {
            muscleLastDate[muscle] = session.date;
          }
        }
      }
    }

    // Find neglected muscle groups (trained at least once ever, but not in 10+ days)
    const allTimeMuscles = {};
    for (const session of log) {
      for (const ex of session.exercises) {
        const muscle = getMuscleGroup(ex.name);
        if (muscle) allTimeMuscles[muscle] = true;
      }
    }

    for (const muscle of Object.keys(allTimeMuscles)) {
      const lastDate = muscleLastDate[muscle];
      if (!lastDate) {
        // Haven't hit it in the last 2 weeks at all
        nudges.push({
          type: 'imbalance',
          priority: 2,
          data: { muscle, daysSince: 14 },
          messages: {
            drill: `No ${muscle} work in 2 weeks. Fix that today.`,
            hype: `Your ${muscle} are feeling left out! Maybe show them some love today? 🥺`,
            zen: `Your ${muscle} haven't been part of the practice recently. The body seeks balance.`,
          },
        });
      } else {
        const daysSince = Math.floor((now - new Date(lastDate)) / (1000 * 60 * 60 * 24));
        if (daysSince >= 10) {
          nudges.push({
            type: 'imbalance',
            priority: 1,
            data: { muscle, daysSince },
            messages: {
              drill: `${daysSince} days since you hit ${muscle}. Don't create a weak link.`,
              hype: `It's been ${daysSince} days since ${muscle} day — they miss you! 💔`,
              zen: `${muscle} — ${daysSince} days of rest. Perhaps it's time to return.`,
            },
          });
        }
      }
    }

    // Push/pull imbalance
    const pushCount = (recentMuscles.chest || 0) + (recentMuscles.shoulders || 0);
    const pullCount = (recentMuscles.back || 0);
    if (pushCount > 0 && pullCount === 0 && pushCount >= 3) {
      nudges.push({
        type: 'imbalance',
        priority: 3,
        data: { push: pushCount, pull: pullCount },
        messages: {
          drill: `${pushCount} push sessions, zero pull. You're building a body that'll fold in half. Row something.`,
          hype: `Lots of push work lately but no pulling! Your back deserves some attention too! 💪`,
          zen: `The body seeks equilibrium. You've pushed ${pushCount} times without pulling. Consider balance.`,
        },
      });
    } else if (pullCount > 0 && pushCount === 0 && pullCount >= 3) {
      nudges.push({
        type: 'imbalance',
        priority: 3,
        data: { push: pushCount, pull: pullCount },
        messages: {
          drill: `All pull, no push. Press something. Now.`,
          hype: `You've been pulling a lot but no pushing! Mix it up! ✨`,
          zen: `Many pulling movements, few pushing. Seek the middle path.`,
        },
      });
    }

    // ─── 4. WEEKLY VOLUME CHECK ───────────────────────────────
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekSessions = log.filter(s => new Date(s.date) >= oneWeekAgo).length;

    if (weekSessions >= 5) {
      nudges.push({
        type: 'volume',
        priority: 1,
        data: { sessions: weekSessions },
        messages: {
          drill: `${weekSessions} sessions this week. Solid output. Make sure you're recovering.`,
          hype: `${weekSessions} sessions this week already?! You're on FIRE! 🔥`,
          zen: `${weekSessions} sessions this week. Remember — rest is also training.`,
        },
      });
    }

    // ─── 5. CONSISTENCY MILESTONE ─────────────────────────────
    const totalSessions = log.length;
    const milestones = [10, 25, 50, 100, 150, 200, 250, 500];
    for (const m of milestones) {
      if (totalSessions >= m && totalSessions < m + 3) {
        nudges.push({
          type: 'milestone',
          priority: 3,
          data: { total: totalSessions, milestone: m },
          messages: {
            drill: `${totalSessions} sessions logged. That's ${m}+. Most people quit at 5. You didn't.`,
            hype: `OMG you've logged ${totalSessions} sessions!! That's a ${m}+ club!! 🎉🏆`,
            zen: `${totalSessions} sessions. ${m} practices. Each one a step. Look how far you've come.`,
          },
        });
        break; // only show one milestone
      }
    }

  } catch (e) {
    // Silently fail — nudges are non-critical
    if (__DEV__) console.log('[CoachNudges] Nudge generation error:', e);
  }

  // Sort by priority (highest first) and return top 2
  nudges.sort((a, b) => b.priority - a.priority);
  return nudges.slice(0, 2);
}

// ─── COACH PR REACTIONS ─────────────────────────────────────────
// Returns personalized PR celebration text per coach

export function getCoachPRReaction(coachId, exerciseName, oldWeight, newWeight, units = 'lbs') {
  const jump = newWeight - (oldWeight || 0);
  const isHuge = jump >= 20 || (!oldWeight && newWeight >= 135);
  const isBench = exerciseName.toLowerCase().includes('bench');
  const isSquat = exerciseName.toLowerCase().includes('squat');
  const isDeadlift = exerciseName.toLowerCase().includes('deadlift');

  // Milestone weights
  const milestoneWeights = [135, 185, 225, 275, 315, 365, 405, 495];
  const hitMilestone = milestoneWeights.includes(newWeight);

  const reactions = {
    drill: {
      normal: [
        `${newWeight} ${units} on ${exerciseName}. ${oldWeight ? `Up from ${oldWeight}.` : ''} That's progress. Don't stop.`,
        `New PR: ${exerciseName} at ${newWeight} ${units}. That weight didn't move itself. YOU moved it.`,
        `${exerciseName} — ${newWeight} ${units}. Stronger than yesterday. That's all that matters.`,
      ],
      huge: [
        `${newWeight} ${units} on ${exerciseName}. THAT'S what I'm talking about. THAT is why you train.`,
        `${exerciseName}: ${newWeight} ${units}. That's a STATEMENT. The iron respects you.`,
      ],
      milestone: [
        `${newWeight} on ${exerciseName}. Welcome to the ${newWeight} club. You earned every pound.`,
        `${newWeight}. That number means something. You KNOW it does. ${exerciseName} PR. Locked.`,
      ],
    },
    hype: {
      normal: [
        `WAIT. ${newWeight} ${units} on ${exerciseName}?! NEW PR!! 🏆🔥 ${oldWeight ? `That's up from ${oldWeight}!!` : 'Let\'s GOOO!!'}`,
        `PR ALERT!! ${exerciseName} just hit ${newWeight} ${units}!! You are UNREAL! 🎉💪`,
        `Excuse me?? ${newWeight} on ${exerciseName}?? You're literally getting stronger every time!! ⚡`,
      ],
      huge: [
        `STOP EVERYTHING. ${newWeight} ${units} ON ${exerciseName.toUpperCase()}?! I'M SCREAMING!! 🔥🔥🔥`,
        `${newWeight} ${units}?! On ${exerciseName}?! That jump is INSANE!! You're a MACHINE!! 🏆⚡`,
      ],
      milestone: [
        `${newWeight} ON ${exerciseName}!! DO YOU KNOW WHAT THAT MEANS?! ${newWeight} CLUB!! 🎊🏆🔥`,
        `THE ${newWeight} CLUB!! ${exerciseName} at ${newWeight} ${units}!! I literally cannot!! 🎉🎉`,
      ],
    },
    zen: {
      normal: [
        `${exerciseName}: ${newWeight} ${units}. ${oldWeight ? `Growing from ${oldWeight}.` : 'A new beginning.'} Strength, made visible.`,
        `A new personal record — ${exerciseName} at ${newWeight} ${units}. The practice bears fruit.`,
        `${newWeight} ${units} on ${exerciseName}. Notice this moment. You are stronger than you were.`,
      ],
      huge: [
        `${exerciseName} — ${newWeight} ${units}. A significant leap. Your patience and persistence created this.`,
        `${newWeight} on ${exerciseName}. Sometimes growth arrives not in steps, but in strides.`,
      ],
      milestone: [
        `${newWeight} on ${exerciseName}. A meaningful threshold. Pause and honor this milestone.`,
        `${exerciseName}: ${newWeight} ${units}. Some numbers carry weight beyond the plates. This is one.`,
      ],
    },
  };

  const coachReactions = reactions[coachId] || reactions.hype;
  const pool = hitMilestone ? coachReactions.milestone
    : isHuge ? coachReactions.huge
    : coachReactions.normal;

  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── GET MULTIPLE PR REACTIONS ──────────────────────────────────
// For workouts with multiple PRs, generate a combined celebration

export function getCoachPRCelebration(coachId, newPRs, units = 'lbs') {
  if (!newPRs || newPRs.length === 0) return null;

  const weightPRs = newPRs.filter(p => p.type === 'weight');
  if (weightPRs.length === 0) return null;

  // Title line
  const titles = {
    drill: weightPRs.length === 1 ? 'NEW PR.' : `${weightPRs.length} NEW PRs.`,
    hype: weightPRs.length === 1 ? 'PR ALERT!! 🏆' : `${weightPRs.length} PRs IN ONE SESSION?! 🏆🔥`,
    zen: weightPRs.length === 1 ? 'A new record.' : `${weightPRs.length} new records. Remarkable.`,
  };

  // Individual reactions
  const prLines = weightPRs.map(pr =>
    getCoachPRReaction(coachId, pr.exercise, pr.old, pr.new, units)
  );

  return {
    title: titles[coachId] || titles.hype,
    reactions: prLines,
    prs: weightPRs,
  };
}