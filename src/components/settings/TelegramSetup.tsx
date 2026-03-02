"use client";

import { useState } from "react";
import { RandiLogo } from "@/components/branding/RandiLogo";

export function TelegramSetup() {
    const [step, setStep] = useState(1);
    const [token, setToken] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSaveToken = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/telegram/setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to set up bot");
            setSuccess(true);
            setStep(4);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-card border border-border shadow-xl rounded-2xl overflow-hidden max-w-2xl mx-auto">
            <div className="bg-primary/5 p-6 border-b border-border flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-primary" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                    </svg>
                </div>
                <div>
                    <h2 className="text-xl font-bold">Telegram Control Center</h2>
                    <p className="text-sm text-muted-foreground font-medium">Control Randi directly from your phone</p>
                </div>
            </div>

            <div className="p-8">
                {step === 1 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold">Step 1: Talk to BotFather</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                Open Telegram and search for <a href="https://t.me/botfather" target="_blank" className="text-primary hover:underline font-bold">@BotFather</a>.
                                Type <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-bold text-foreground">/newbot</code> and follow instructions to give it a name and username.
                            </p>
                        </div>
                        <button
                            onClick={() => setStep(2)}
                            className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20"
                        >
                            I've got my bot! Next →
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold">Step 2: Get your API Token</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                BotFather will send you a message with an <strong>API Token</strong> (it looks like <code className="bg-muted px-1.5 py-0.5 rounded text-xs opacity-60">123456:ABC-DEF...</code>).
                                Copy that token and keep it safe!
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setStep(1)}
                                className="flex-1 py-4 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-bold transition-all"
                            >
                                Back
                            </button>
                            <button
                                onClick={() => setStep(3)}
                                className="flex-2 px-8 py-4 bg-primary text-primary-foreground rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20"
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold">Step 3: Connect to Randi</h3>
                            <p className="text-muted-foreground">Paste your token below to link your bot.</p>
                        </div>
                        <div className="space-y-4">
                            <input
                                type="text"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder="123456789:ABCDE..."
                                className="w-full p-4 bg-muted/30 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-sm"
                            />
                            {error && <p className="text-destructive text-sm font-bold bg-destructive/10 p-3 rounded-lg border border-destructive/20">{error}</p>}

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setStep(2)}
                                    disabled={loading}
                                    className="flex-1 py-4 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-bold transition-all"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleSaveToken}
                                    disabled={loading || !token}
                                    className="flex-2 px-8 py-4 bg-primary text-primary-foreground rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:scale-100"
                                >
                                    {loading ? "Connecting..." : "Power Up Randi 🚀"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div className="space-y-8 text-center py-4 animate-in zoom-in-95 duration-500">
                        <div className="flex justify-center">
                            <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center border-4 border-success/30">
                                <svg className="w-10 h-10 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black">All Systems Go!</h3>
                            <p className="text-muted-foreground">Your Telegram bot is now connected. Send it a message to start controlling Randi from anywhere.</p>
                        </div>
                        <button
                            onClick={() => setStep(1)}
                            className="w-full py-4 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-bold transition-all"
                        >
                            Done
                        </button>
                    </div>
                )}
            </div>

            {step !== 4 && (
                <div className="bg-muted/30 p-4 flex justify-center gap-1.5 border-t border-border">
                    {[1, 2, 3].map((s) => (
                        <div
                            key={s}
                            className={`h-1.5 rounded-full transition-all ${step === s ? "w-8 bg-primary" : "w-1.5 bg-border"}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
