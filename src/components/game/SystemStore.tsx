"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Coins, Plus, CheckCircle2, FlaskConical, Package } from "lucide-react";

interface Reward {
    _id: string;
    title: string;
    description: string;
    cost: number;
    type: "system_item" | "custom_reward";
    effect: string;
}

interface SystemStoreProps {
    gold: number;
    hp: number;
    maxHp: number;
    onPurchaseSuccess: () => void;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SystemStore({ gold, hp, maxHp, onPurchaseSuccess }: SystemStoreProps) {
    const { data, error, isLoading } = useSWR("/api/rewards", fetcher);
    
    const [isAdding, setIsAdding] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [newCost, setNewCost] = useState("");
    const [buyingId, setBuyingId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState("");

    const handleCreateReward = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");
        
        if (!newTitle || !newCost) {
            setErrorMsg("Title and Cost are required.");
            return;
        }

        try {
            const res = await fetch("/api/rewards", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: newTitle,
                    description: newDesc,
                    cost: parseInt(newCost)
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to create reward");
            }

            // Reset form and refresh SWR
            setIsAdding(false);
            setNewTitle("");
            setNewDesc("");
            setNewCost("");
            mutate("/api/rewards");
        } catch (err: any) {
            setErrorMsg(err.message);
        }
    };

    const handlePurchase = async (rewardId: string, type: string) => {
        setErrorMsg("");
        setBuyingId(rewardId);

        try {
            const res = await fetch("/api/rewards/purchase", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rewardId, type })
            });

            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || "Failed to purchase items");
            }

            // Tell parent to refetch user stats (to update global Gold & HP immediately)
            onPurchaseSuccess();
            
            // If it's a one-time custom reward, we might want to delete it or just let the user buy it repeatedly.
            // Currently custom rewards are repeatable.
            
        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setBuyingId(null);
        }
    };

    if (error) return <div className="p-4 bg-red-900/20 text-red-400 rounded-lg">Failed to load the store.</div>;
    if (isLoading) return <div className="p-4 text-gray-400 animate-pulse">Accessing Black Market...</div>;

    const systemItems: Reward[] = data?.systemItems || [];
    const customRewards: Reward[] = data?.customRewards || [];

    return (
        <div className="bg-[#111] border border-gray-800 rounded-xl p-5 w-full text-white shadow-lg">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold tracking-wider text-[#00ff88]">SYSTEM STORE</h2>
                    <p className="text-sm text-gray-400 mt-1">Exchange your Gold for rewards or survival items.</p>
                </div>
                <div className="bg-[#1a1a1a] px-4 py-2 rounded-lg border border-yellow-900/50 flex flex-col items-end">
                    <span className="text-xs text-gray-500 uppercase tracking-widest mb-1">Treasury</span>
                    <div className="flex items-center text-yellow-500 font-mono font-bold text-lg">
                        <Coins size={16} className="mr-2" />
                        {gold.toLocaleString()} G
                    </div>
                </div>
            </div>

            {errorMsg && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded text-red-400 text-sm">
                    {errorMsg}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* System Items (Potions, etc) */}
                <div>
                    <h3 className="text-sm uppercase tracking-widest text-gray-500 mb-3 flex items-center">
                        <FlaskConical size={14} className="mr-2" />
                        Consumables
                    </h3>
                    <div className="space-y-3">
                        {systemItems.map(item => (
                            <div key={item._id} className="bg-[#1a1a1a] border border-gray-800 rounded p-3 flex justify-between items-center group hover:border-[#00ff88]/30 transition-colors">
                                <div>
                                    <div className="font-semibold text-gray-200">{item.title}</div>
                                    <div className="text-xs text-gray-500">{item.description}</div>
                                </div>
                                <button 
                                    onClick={() => handlePurchase(item._id, item.type)}
                                    disabled={buyingId === item._id || gold < item.cost}
                                    className="ml-3 flex items-center px-3 py-1.5 bg-[#222] hover:bg-[#333] border border-yellow-700/50 text-yellow-500 text-sm rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {buyingId === item._id ? "..." : (
                                        <>
                                            <Coins size={12} className="mr-1.5" />
                                            {item.cost}
                                        </>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Custom Rewards */}
                <div>
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm uppercase tracking-widest text-gray-500 flex items-center">
                            <Package size={14} className="mr-2" />
                            My Rewards
                        </h3>
                        {!isAdding && (
                            <button 
                                onClick={() => setIsAdding(true)}
                                className="text-xs text-[#00ff88] hover:text-white flex items-center transition"
                            >
                                <Plus size={12} className="mr-1" /> Add Reward
                            </button>
                        )}
                    </div>

                    {isAdding && (
                        <form onSubmit={handleCreateReward} className="bg-[#1a1a1a] border border-[#00ff88]/30 rounded p-3 mb-3 animate-in fade-in slide-in-from-top-2">
                            <input
                                autoFocus
                                type="text"
                                placeholder="Reward Title (e.g. Watch Anime)"
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                                className="w-full bg-black border border-gray-700 rounded px-3 py-1.5 text-sm text-white mb-2 outline-none focus:border-[#00ff88]"
                            />
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    placeholder="Optional Description"
                                    value={newDesc}
                                    onChange={e => setNewDesc(e.target.value)}
                                    className="flex-1 bg-black border border-gray-700 rounded px-3 py-1.5 text-sm text-white outline-none focus:border-[#00ff88]"
                                />
                                <div className="relative w-24">
                                    <div className="absolute left-2 top-1.5 text-yellow-600"><Coins size={14}/></div>
                                    <input
                                        type="number"
                                        placeholder="Cost"
                                        min="1"
                                        value={newCost}
                                        onChange={e => setNewCost(e.target.value)}
                                        className="w-full bg-black border border-gray-700 rounded pl-7 pr-2 py-1.5 text-sm text-yellow-500 outline-none focus:border-yellow-500"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setIsAdding(false)} className="text-xs text-gray-500 hover:text-white transition">Cancel</button>
                                <button type="submit" className="text-xs bg-[#00ff88]/20 text-[#00ff88] hover:bg-[#00ff88]/30 px-3 py-1 rounded transition">Save Reward</button>
                            </div>
                        </form>
                    )}

                    <div className="space-y-3">
                        {customRewards.length === 0 && !isAdding && (
                            <div className="text-center p-4 border border-dashed border-gray-800 rounded text-gray-600 text-sm">
                                No custom rewards set.<br/>Add real-life privileges you can buy with Gold.
                            </div>
                        )}
                        
                        {customRewards.map(reward => (
                            <div key={reward._id} className="bg-[#1a1a1a] border border-gray-800 rounded p-3 flex justify-between items-center group hover:border-[#00ff88]/30 transition-colors">
                                <div>
                                    <div className="font-semibold text-gray-200">{reward.title}</div>
                                    {reward.description && <div className="text-xs text-gray-500">{reward.description}</div>}
                                </div>
                                <button 
                                    onClick={() => handlePurchase(reward._id, reward.type)}
                                    disabled={buyingId === reward._id || gold < reward.cost}
                                    className="ml-3 flex shrink-0 items-center px-3 py-1.5 bg-[#222] hover:bg-[#333] border border-yellow-700/50 text-yellow-500 text-sm rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {buyingId === reward._id ? "..." : (
                                        <>
                                            <Coins size={12} className="mr-1.5" />
                                            {reward.cost}
                                        </>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
