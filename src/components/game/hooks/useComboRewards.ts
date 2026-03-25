import { useCallback, useEffect, useRef, useState } from "react";
import { getComboBonus, SYSTEM_RULES } from "@/config/systemRules";

export type ComboToast = { text: string; xp: number } | null;

type UseComboRewardsOptions = {
    onAwardXP: (bonusXP: number, comboCount: number, timestamp: Date) => void;
};

export function useComboRewards({ onAwardXP }: UseComboRewardsOptions) {
    const [combo, setCombo] = useState(0);
    const [comboToast, setComboToast] = useState<ComboToast>(null);
    const lastTaskTimeRef = useRef<Date | null>(null);
    const clearToastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (clearToastRef.current) {
                clearTimeout(clearToastRef.current);
            }
        };
    }, []);

    const registerCompletion = useCallback((totalQuestCount: number) => {
        const taskNow = new Date();
        const lastTaskTime = lastTaskTimeRef.current;
        const gapMinutes = lastTaskTime
            ? (taskNow.getTime() - lastTaskTime.getTime()) / 60000
            : Number.POSITIVE_INFINITY;

        const newCombo = gapMinutes <= SYSTEM_RULES.COMBO_WINDOW_MINUTES ? combo + 1 : 1;
        setCombo(newCombo);
        lastTaskTimeRef.current = taskNow;

        const { xp, text } = getComboBonus(newCombo, totalQuestCount);
        if (xp > 0) {
            setComboToast({ text, xp });
            onAwardXP(xp, newCombo, taskNow);

            if (clearToastRef.current) {
                clearTimeout(clearToastRef.current);
            }
            clearToastRef.current = setTimeout(() => setComboToast(null), 2500);
        }
    }, [combo, onAwardXP]);

    return { combo, comboToast, registerCompletion };
}