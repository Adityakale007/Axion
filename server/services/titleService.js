import User from "../models/User.js";

export const TITLES = [
  { id: "first_blood", label: "First Blood", condition: (user) => user.totalSessions === 1 },
  { id: "speed_demon", label: "Speed Demon", condition: (_user, session) => session.solvedInMinutes && session.solvedInMinutes < 10 },
  { id: "streak_lord", label: "Streak Lord", condition: (user) => user.currentStreak >= 7 },
  { id: "mentor", label: "Mentor", condition: (user) => (user.sessionsAsNavigator || 0) >= 10 },
  { id: "cf_crusher", label: "CF Crusher", condition: (_user, session) => session.cfProblemRating && session.cfProblemRating >= 1600 },
];

export async function checkAndAwardTitles(userId, sessionData = {}) {
  const user = await User.findById(userId);
  if (!user) return { newTitle: null, user: null };

  let newTitle = null;
  const existing = new Set((user.titles || []).map((title) => String(title)));

  for (const title of TITLES) {
    if (!existing.has(title.id) && title.condition(user, sessionData)) {
      user.titles.push(title.id);
      if (!newTitle) newTitle = title.label;
    }
  }

  await user.save();
  return { newTitle, user };
}
