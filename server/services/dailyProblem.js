import DailyProblem from "../models/DailyProblem.js";

// Fallback problems for Codeforces when API is down
const CF_FALLBACK_PROBLEMS = [
  {
    contestId: 1,
    index: "A",
    name: "Theatre Square",
    rating: 1000,
    tags: ["math"],
  },
  {
    contestId: 4,
    index: "A",
    name: "Watermelon",
    rating: 800,
    tags: ["brute force"],
  },
  {
    contestId: 71,
    index: "A",
    name: "Way Too Long Words",
    rating: 800,
    tags: ["strings"],
  },
  {
    contestId: 158,
    index: "A",
    name: "Next Round",
    rating: 800,
    tags: ["implementation"],
  },
  {
    contestId: 118,
    index: "A",
    name: "String Task",
    rating: 1000,
    tags: ["strings"],
  },
  { contestId: 231, index: "A", name: "Team", rating: 800, tags: ["greedy"] },
  {
    contestId: 263,
    index: "A",
    name: "Beautiful Matrix",
    rating: 800,
    tags: ["implementation"],
  },
  {
    contestId: 282,
    index: "A",
    name: "Bit++",
    rating: 800,
    tags: ["implementation"],
  },
  {
    contestId: 339,
    index: "A",
    name: "Helpful Maths",
    rating: 800,
    tags: ["greedy", "strings"],
  },
  {
    contestId: 112,
    index: "A",
    name: "Petya and Strings",
    rating: 800,
    tags: ["strings"],
  },
  {
    contestId: 266,
    index: "A",
    name: "Stones on the Table",
    rating: 800,
    tags: ["implementation"],
  },
  {
    contestId: 546,
    index: "A",
    name: "Soldier and Bananas",
    rating: 800,
    tags: ["implementation"],
  },
  {
    contestId: 791,
    index: "A",
    name: "Bear and Big Brother",
    rating: 800,
    tags: ["implementation"],
  },
  {
    contestId: 236,
    index: "A",
    name: "Boy or Girl",
    rating: 800,
    tags: ["implementation"],
  },
  {
    contestId: 977,
    index: "A",
    name: "Wrong Subtraction",
    rating: 800,
    tags: ["implementation"],
  },
  { contestId: 617, index: "A", name: "Elephant", rating: 800, tags: ["math"] },
  {
    contestId: 59,
    index: "A",
    name: "Word",
    rating: 800,
    tags: ["implementation"],
  },
  {
    contestId: 281,
    index: "A",
    name: "Word Capitalization",
    rating: 800,
    tags: ["strings"],
  },
  {
    contestId: 110,
    index: "A",
    name: "Nearly Lucky Number",
    rating: 800,
    tags: ["implementation"],
  },
  {
    contestId: 266,
    index: "B",
    name: "Queue at the School",
    rating: 800,
    tags: ["implementation"],
  },
];

const LC_FALLBACK_PROBLEMS = [
  {
    title: "Two Sum",
    slug: "two-sum",
    difficulty: "Easy",
    tags: ["Array", "Hash Table"],
    url: "https://leetcode.com/problems/two-sum/",
    statement: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
  },
  {
    title: "Reverse Integer",
    slug: "reverse-integer",
    difficulty: "Medium",
    tags: ["Math"],
    url: "https://leetcode.com/problems/reverse-integer/",
    statement: "Given a signed 32-bit integer x, return x with its digits reversed. If reversing x causes the value to go outside the signed 32-bit integer range, then return 0.",
  },
  {
    title: "Palindrome Number",
    slug: "palindrome-number",
    difficulty: "Easy",
    tags: ["Math"],
    url: "https://leetcode.com/problems/palindrome-number/",
    statement: "Given an integer x, return true if x is a palindrome, and false otherwise.",
  },
  {
    title: "Longest Common Prefix",
    slug: "longest-common-prefix",
    difficulty: "Easy",
    tags: ["String"],
    url: "https://leetcode.com/problems/longest-common-prefix/",
    statement: "Write a function to find the longest common prefix string amongst an array of strings. If there is no common prefix, return an empty string.",
  },
  {
    title: "Valid Parentheses",
    slug: "valid-parentheses",
    difficulty: "Easy",
    tags: ["String", "Stack"],
    url: "https://leetcode.com/problems/valid-parentheses/",
    statement: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
  },
];

function dateHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

async function fetchLeetCodePOTD() {
  const today = new Date().toISOString().split("T")[0];
  const query = `
    query {
      activeDailyChallengeQuestion {
        date
        link
        question {
          title
          titleSlug
          difficulty
          topicTags { name }
          content
        }
      }
    }
  `;

  // Try Third-party API first (Alfa LeetCode API - popular community choice)
  try {
    const response = await fetch("https://alfa-leetcode-api.onrender.com/daily", {
      headers: { "User-Agent": "ForkSpace/1.0" }
    });

    if (response.ok) {
      const data = await response.json();
      
      // Alfa API usually flattens the response
      if (data.questionTitle) {
        return {
          platform: "leetcode",
          date: data.date || today,
          title: data.questionTitle,
          slug: data.questionTitleSlug,
          difficulty: data.difficulty,
          tags: data.topicTags?.map((t) => t.name) || [],
          url: data.link.startsWith("http") ? data.link : `https://leetcode.com${data.link}`,
          statement: (data.questionContent || "").replace(/<[^>]*>/g, "").slice(0, 800),
        };
      } 
      // Sometimes it might return the raw GraphQL structure
      else if (data.activeDailyChallengeQuestion) {
        const q = data.activeDailyChallengeQuestion;
        return {
          platform: "leetcode",
          date: q.date,
          title: q.question.title,
          slug: q.question.titleSlug,
          difficulty: q.question.difficulty,
          tags: q.question.topicTags.map((t) => t.name),
          url: `https://leetcode.com${q.link}`,
          statement: q.question.content.replace(/<[^>]*>/g, "").slice(0, 800),
        };
      }
    }
  } catch (err) {
    console.warn("Alfa LeetCode API failed, falling back to direct GraphQL:", err.message);
  }

  // Fallback to direct GraphQL with improved headers
  try {
    const response = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: "https://leetcode.com",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) throw new Error(`LC API error: ${response.status}`);

    const data = await response.json();
    if (!data.data?.activeDailyChallengeQuestion) throw new Error("LC Invalid response structure");

    const q = data.data.activeDailyChallengeQuestion;

    return {
      platform: "leetcode",
      date: q.date,
      title: q.question.title,
      slug: q.question.titleSlug,
      difficulty: q.question.difficulty,
      tags: q.question.topicTags.map((t) => t.name),
      url: `https://leetcode.com${q.link}`,
      statement: q.question.content.replace(/<[^>]*>/g, "").slice(0, 800),
    };
  } catch (err) {
    console.error("Direct LeetCode POTD fetch failed, using hardcoded fallback:", err.message);
    const index = dateHash(today) % LC_FALLBACK_PROBLEMS.length;
    const problem = LC_FALLBACK_PROBLEMS[index];
    return {
      ...problem,
      platform: "leetcode",
      date: today,
    };
  }
}

async function fetchCFDailyProblem() {
  const today = new Date().toISOString().split("T")[0];

  let problem;
  try {
    const response = await fetch(
      "https://codeforces.com/api/problemset.problems?tags=implementation",
    );
    const data = await response.json();

    if (data.status !== "OK") throw new Error("CF API error");

    const eligible = data.result.problems.filter(
      (p) => p.rating && p.rating >= 800 && p.rating <= 1500,
    );

    const index = dateHash(today) % eligible.length;
    problem = eligible[index];
  } catch (err) {
    console.error("CF Daily fetch failed, using fallback:", err.message);
    const index = dateHash(today) % CF_FALLBACK_PROBLEMS.length;
    problem = CF_FALLBACK_PROBLEMS[index];
  }

  return {
    platform: "codeforces",
    date: today,
    title: `${problem.contestId}${problem.index} - ${problem.name}`,
    rating: problem.rating,
    tags: problem.tags,
    url: `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`,
    statement: `CF Problem: ${problem.name} (Rating: ${problem.rating}, Tags: ${problem.tags.join(", ")})`,
  };
}

export async function getDailyProblem(platform) {
  const today = new Date().toISOString().split("T")[0];

  try {
    const cached = await DailyProblem.findOne({ platform, date: today });
    if (cached) return cached;

    const problemData =
      platform === "leetcode"
        ? await fetchLeetCodePOTD()
        : await fetchCFDailyProblem();

    const saved = await DailyProblem.create(problemData);
    return saved;
  } catch (err) {
    console.error(`Error in getDailyProblem(${platform}):`, err.message);
    throw err;
  }
}
