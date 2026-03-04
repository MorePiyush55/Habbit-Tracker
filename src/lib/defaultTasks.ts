export interface DefaultTask {
    title: string;
    category: string;
    difficulty: "small" | "medium" | "hard";
    xpReward: number;
    order: number;
    subtasks: string[];
}

export const DEFAULT_TASKS: DefaultTask[] = [
    {
        title: "CompTIA Security+ Study",
        category: "Cybersecurity",
        difficulty: "hard",
        xpReward: 50,
        order: 1,
        subtasks: ["Watch lecture", "Take notes", "Solve practice questions"],
    },
    {
        title: "TryHackMe Practice",
        category: "Cybersecurity",
        difficulty: "hard",
        xpReward: 50,
        order: 2,
        subtasks: ["Solve one room", "Write notes", "Practice commands"],
    },
    {
        title: "Job Applications",
        category: "Career",
        difficulty: "medium",
        xpReward: 25,
        order: 3,
        subtasks: ["Find 3 job listings", "Customize resume", "Submit applications"],
    },
    {
        title: "Client Outreach – Website Selling",
        category: "Business",
        difficulty: "medium",
        xpReward: 25,
        order: 4,
        subtasks: ["Identify prospects", "Send outreach messages", "Follow up on leads"],
    },
    {
        title: "Client Outreach – n8n Automation",
        category: "Business",
        difficulty: "medium",
        xpReward: 25,
        order: 5,
        subtasks: ["Research potential clients", "Create pitch message", "Send proposals"],
    },
    {
        title: "Read Books",
        category: "Personal Growth",
        difficulty: "small",
        xpReward: 10,
        order: 6,
        subtasks: ["Read for 30 minutes", "Take notes on key ideas"],
    },
    {
        title: "Watch Informative Content",
        category: "Learning",
        difficulty: "small",
        xpReward: 10,
        order: 7,
        subtasks: ["Watch educational video", "Note key takeaways"],
    },
    {
        title: "Learn Money-Making Skills",
        category: "Business",
        difficulty: "medium",
        xpReward: 25,
        order: 8,
        subtasks: ["Study one new skill", "Practice for 30 minutes", "Document learnings"],
    },
    {
        title: "Improve Technical Resources",
        category: "Technical",
        difficulty: "small",
        xpReward: 10,
        order: 9,
        subtasks: ["Update portfolio/GitHub", "Improve documentation", "Clean up projects"],
    },
];
