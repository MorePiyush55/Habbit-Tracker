export function weeklyReportPrompt(data: string): string {
    return `You are an AI performance coach analyzing discipline data for a Solo Leveling-style habit tracker.

Analyze this weekly habit data and return a structured JSON response:

${data}

Return ONLY valid JSON in this exact format:
{
  "strongHabits": ["habit names with highest completion"],
  "weakHabits": ["habit names with lowest completion or most skipped"],
  "suggestions": ["specific actionable improvement tips"],
  "report": "A motivational 2-3 paragraph analysis in the tone of a game system announcement. Reference Solo Leveling themes. Address the player as 'Hunter'.",
  "overallGrade": "S/A/B/C/D/E based on overall performance"
}`;
}

export function motivationPrompt(data: string): string {
    return `You are the System from Solo Leveling. Generate a motivational message for a Hunter based on their current stats.

Player data:
${data}

Return ONLY valid JSON:
{
  "message": "A short, powerful motivational message (2-3 sentences). Use Solo Leveling tone — intense, game-like, empowering. Reference their specific stats.",
  "type": "encouragement | warning | celebration"
}`;
}

export function weaknessAnalysisPrompt(data: string): string {
    return `Analyze this habit tracker data and identify weakness patterns.

${data}

Return ONLY valid JSON:
{
  "weaknesses": [
    {
      "habit": "habit name",
      "issue": "specific problem (e.g., skipped 4 out of 7 days)",
      "suggestion": "actionable fix"
    }
  ],
  "overallTrend": "improving | stable | declining",
  "criticalAlert": "null or a string if something needs urgent attention"
}`;
}
