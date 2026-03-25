import { getComboBonus, SYSTEM_RULES } from "@/config/systemRules";

describe("systemRules", () => {
    it("defines sane core thresholds", () => {
        expect(SYSTEM_RULES.DAILY_MIN_TASKS).toBe(3);
        expect(SYSTEM_RULES.LATE_WINDOW_HOURS).toBe(8);
        expect(SYSTEM_RULES.RECOVERY_COOLDOWN_DAYS).toBe(3);
        expect(SYSTEM_RULES.DAILY_XP_SOFT_CAP).toBeGreaterThan(0);
        expect(SYSTEM_RULES.COMBO_WINDOW_MINUTES).toBe(120);
    });

    it("returns combo bonus for 3x and 5x", () => {
        expect(getComboBonus(3, 20)).toEqual({ xp: 20, text: "3x COMBO!" });
        expect(getComboBonus(5, 20)).toEqual({ xp: 50, text: "5x COMBO!" });
    });

    it("returns perfect combo when combo reaches total tasks", () => {
        expect(getComboBonus(7, 7)).toEqual({ xp: 100, text: "PERFECT COMBO!" });
    });

    it("returns no bonus otherwise", () => {
        expect(getComboBonus(2, 10)).toEqual({ xp: 0, text: "" });
    });
});
