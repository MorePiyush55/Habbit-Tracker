import React from "react";
import QuestPanel from "../game/QuestPanel";
import type { Quest } from "../game/QuestPanel";
import type { ProgressBoardData } from "../../hooks/useProgressBoard";

interface TaskBoardSectionProps {
    tasks: ProgressBoardData["tasks"];
    completionRate: number;
    date: string;
    todayDate: string;
    onToggleSubtask?: (habitId: string, subtaskId: string, completed: boolean) => void;
    onDeleteQuest?: (habitId: string) => void;
    onEditQuest?: (quest: Quest) => void;
    onToggleMainTask?: (habitId: string, completed: boolean) => void;
    onChangeRank?: (habitId: string, newRank: string) => void;
    loading?: boolean;
}

export default function TaskBoardSection({
    tasks,
    completionRate,
    date = "",
    todayDate = "",
    onToggleSubtask,
    onDeleteQuest,
    onEditQuest,
    onToggleMainTask,
    onChangeRank,
    loading = false,
}: TaskBoardSectionProps) {
    return (
        <div className="section quest-board-section">
            <div className="section-header">
                <div className="header-title">
                    <h2>Daily Quests</h2>
                    <div className="completion-badge">{completionRate}% Complete</div>
                </div>
            </div>
            <QuestPanel
                quests={tasks as Quest[]}
                date={date || todayDate}
                onToggleSubtask={onToggleSubtask || (() => {})}
                onDeleteQuest={onDeleteQuest}
                onEditQuest={onEditQuest}
                onToggleMainTask={onToggleMainTask}
                onChangeRank={onChangeRank}
                loading={loading}
            />
        </div>
    );
}
