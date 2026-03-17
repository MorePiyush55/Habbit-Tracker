"use client";

import { useState } from "react";
import { Shield, Sword, Hexagon, Backpack, PackageOpen } from "lucide-react";

interface Item {
    _id: string;
    name: string;
    description: string;
    type: "weapon" | "armor" | "accessory" | "consumable";
    rarity: string;
    statBoosts: Record<string, number>;
}

interface InventoryPanelProps {
    jobClass: string;
    inventory: Item[];
    equipped: {
        weapon: Item | null;
        armor: Item | null;
        accessory: Item | null;
    };
    baseStats: Record<string, { value: number }>;
}

export default function InventoryPanel({ jobClass, inventory, equipped, baseStats }: InventoryPanelProps) {
    const [activeTab, setActiveTab] = useState<"equipment" | "inventory">("equipment");

    // Calculate effective stats for display
    const effectiveStats = { ...baseStats };
    const allEquipped = [equipped.weapon, equipped.armor, equipped.accessory].filter(Boolean) as Item[];
    
    // We compute this visually here (although backend is ultimate authority)
    allEquipped.forEach(item => {
        if (item.statBoosts) {
            Object.entries(item.statBoosts).forEach(([stat, boost]) => {
                if (effectiveStats[stat]) {
                    effectiveStats[stat] = { value: effectiveStats[stat].value + boost };
                }
            });
        }
    });

    return (
        <div className="glass-card" style={{ padding: "0", overflow: "hidden", display: "flex", flexDirection: "column", height: "100%" }}>
            
            {/* Header / Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.2)" }}>
                <button 
                    onClick={() => setActiveTab("equipment")}
                    style={{ flex: 1, padding: "15px", background: activeTab === "equipment" ? "var(--bg-tertiary)" : "transparent", color: activeTab === "equipment" ? "#00ff88" : "gray", fontWeight: "bold", borderBottom: activeTab === "equipment" ? "2px solid #00ff88" : "none", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}
                >
                    <Sword size={16} /> Equipment
                </button>
                <button 
                    onClick={() => setActiveTab("inventory")}
                    style={{ flex: 1, padding: "15px", background: activeTab === "inventory" ? "var(--bg-tertiary)" : "transparent", color: activeTab === "inventory" ? "#00ff88" : "gray", fontWeight: "bold", borderBottom: activeTab === "inventory" ? "2px solid #00ff88" : "none", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}
                >
                    <Backpack size={16} /> Inventory
                </button>
            </div>

            <div style={{ padding: "20px", flex: 1 }}>
                {/* Title & Job Class */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)" }}>Active Job Class</h3>
                    <span className="badge" style={{ background: "rgba(79, 124, 255, 0.2)", color: "#4cc9ff", border: "1px solid #4cc9ff", padding: "4px 12px", fontSize: "0.85rem" }}>
                        {jobClass}
                    </span>
                </div>

                {activeTab === "equipment" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px" }}>
                        {/* Weapon Slot */}
                        <div style={{ border: "1px dashed #444", borderRadius: "8px", padding: "12px", display: "flex", alignItems: "center", gap: "15px", background: "rgba(255,255,255,0.02)" }}>
                            <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #333", color: "#666" }}>
                                <Sword size={20} />
                            </div>
                            <div>
                                <div style={{ fontSize: "0.75rem", color: "gray", textTransform: "uppercase", letterSpacing: "1px" }}>Weapon</div>
                                {equipped.weapon ? (
                                    <div style={{ color: "var(--accent-gold)", fontWeight: "bold", fontSize: "0.9rem" }}>{equipped.weapon.name}</div>
                                ) : (
                                    <div style={{ color: "#555", fontSize: "0.9rem" }}>Empty Slot</div>
                                )}
                            </div>
                        </div>

                        {/* Armor Slot */}
                        <div style={{ border: "1px dashed #444", borderRadius: "8px", padding: "12px", display: "flex", alignItems: "center", gap: "15px", background: "rgba(255,255,255,0.02)" }}>
                            <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #333", color: "#666" }}>
                                <Shield size={20} />
                            </div>
                            <div>
                                <div style={{ fontSize: "0.75rem", color: "gray", textTransform: "uppercase", letterSpacing: "1px" }}>Armor</div>
                                {equipped.armor ? (
                                    <div style={{ color: "var(--accent-gold)", fontWeight: "bold", fontSize: "0.9rem" }}>{equipped.armor.name}</div>
                                ) : (
                                    <div style={{ color: "#555", fontSize: "0.9rem" }}>Empty Slot</div>
                                )}
                            </div>
                        </div>

                        {/* Accessory Slot */}
                        <div style={{ border: "1px dashed #444", borderRadius: "8px", padding: "12px", display: "flex", alignItems: "center", gap: "15px", background: "rgba(255,255,255,0.02)" }}>
                            <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #333", color: "#666" }}>
                                <Hexagon size={20} />
                            </div>
                            <div>
                                <div style={{ fontSize: "0.75rem", color: "gray", textTransform: "uppercase", letterSpacing: "1px" }}>Accessory</div>
                                {equipped.accessory ? (
                                    <div style={{ color: "var(--accent-gold)", fontWeight: "bold", fontSize: "0.9rem" }}>{equipped.accessory.name}</div>
                                ) : (
                                    <div style={{ color: "#555", fontSize: "0.9rem" }}>Empty Slot</div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", color: "gray", marginTop: "30px" }}>
                        <PackageOpen size={40} opacity={0.5} />
                        <p style={{ fontSize: "0.9rem" }}>
                            {inventory.length === 0 ? "Inventory is empty. Complete Dungeon Raids to earn equipment." : "Inventory items go here."}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
