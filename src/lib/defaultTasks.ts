interface DefaultTask {
    title: string;
    category: string;
    rank: "E" | "D" | "C" | "B" | "A" | "S";
    primaryStat: "STR" | "VIT" | "INT" | "AGI" | "PER" | "CHA";
    xpReward: number;
    order: number;
    subtasks: string[];
}

export const DEFAULT_TASKS: DefaultTask[] = [
    {
        title: "CompTIA Security+ Study",
        category: "Cybersecurity",
        rank: "B",
        primaryStat: "INT",
        xpReward: 50,
        order: 1,
        subtasks: ["Watch lecture", "Take notes", "Solve practice questions"],
    },
    {
        title: "TryHackMe Practice",
        category: "Cybersecurity",
        rank: "C",
        primaryStat: "INT",
        xpReward: 35,
        order: 2,
        subtasks: ["Solve one room", "Write notes", "Practice commands"],
    },
    {
        title: "Job Applications",
        category: "Career",
        rank: "D",
        primaryStat: "CHA",
        xpReward: 20,
        order: 3,
        subtasks: ["Find 3 job listings", "Customize resume", "Submit applications"],
    },
    {
        title: "Client Outreach – Website Selling",
        category: "Business",
        rank: "D",
        primaryStat: "CHA",
        xpReward: 20,
        order: 4,
        subtasks: ["Identify prospects", "Send outreach messages", "Follow up on leads"],
    },
    {
        title: "Client Outreach – n8n Automation",
        category: "Business",
        rank: "D",
        primaryStat: "PER",
        xpReward: 20,
        order: 5,
        subtasks: ["Research potential clients", "Create pitch message", "Send proposals"],
    },
    {
        title: "Read Books",
        category: "Personal Growth",
        rank: "E",
        primaryStat: "INT",
        xpReward: 10,
        order: 6,
        subtasks: ["Read for 30 minutes", "Take notes on key ideas"],
    },
    {
        title: "Watch Informative Content",
        category: "Learning",
        rank: "E",
        primaryStat: "PER",
        xpReward: 10,
        order: 7,
        subtasks: ["Watch educational video", "Note key takeaways"],
    },
    {
        title: "Learn Money-Making Skills",
        category: "Business",
        rank: "C",
        primaryStat: "AGI",
        xpReward: 35,
        order: 8,
        subtasks: ["Study one new skill", "Practice for 30 minutes", "Document learnings"],
    },
    {
        title: "Improve Technical Resources",
        category: "Technical",
        rank: "E",
        primaryStat: "INT",
        xpReward: 10,
        order: 9,
        subtasks: ["Update portfolio/GitHub", "Improve documentation", "Clean up projects"],
    },
];
