"use client";

import { useState, useEffect } from "react";

interface CustomizeAgentDrawerProps {
  agentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CustomizeAgentDrawer({ agentId, isOpen, onClose }: CustomizeAgentDrawerProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agentSlug, setAgentSlug] = useState<string | null>(null);
  const [personality, setPersonality] = useState("");
  const [rules, setRules] = useState("");
  const [skills, setSkills] = useState("");
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Fetch agent slug first
    const fetchAgent = async () => {
      try {
        const res = await fetch(`/api/agents`);
        const data = await res.json();
        const agent = (data.agents as any[]).find(a => a.id === agentId || a.slug === agentId);
        if (agent) {
          setAgentSlug(agent.slug);
          
          // Now fetch preferences
          const prefRes = await fetch(`/api/user/agent-preferences?agentSlug=${agent.slug}`);
          const prefData = await prefRes.json();
          if (prefData) {
            setPersonality(prefData.personality || "");
            setRules(prefData.rules || "");
            setSkills(prefData.skills || "");
          }
        }
      } catch (err) {
        console.error("Error fetching agent preferences:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAgent();
  }, [isOpen, agentId]);

  const handleSave = async () => {
    if (!agentSlug) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/user/agent-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentSlug,
          personality,
          rules,
          skills,
        }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Preferences saved successfully!' });
        setTimeout(() => onClose(), 1500);
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save preferences. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="absolute inset-y-0 right-0 max-w-full flex">
        <div className="w-screen max-w-md flex flex-col bg-card border-l border-border shadow-2xl animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-xl font-bold uppercase tracking-wider text-primary">Customize Agent</h2>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-muted-foreground uppercase tracking-wider">Personality</label>
                  <p className="text-xs text-muted-foreground mb-2">How should Randi talk? (e.g. funny, sarcastic, strictly professional)</p>
                  <textarea
                    value={personality}
                    onChange={(e) => setPersonality(e.target.value)}
                    className="w-full h-32 bg-background border border-border rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-all resize-none"
                    placeholder="Describe the agent's personality..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-muted-foreground uppercase tracking-wider">Custom Rules</label>
                  <p className="text-xs text-muted-foreground mb-2">Specific behaviors or constraints Randi must follow.</p>
                  <textarea
                    value={rules}
                    onChange={(e) => setRules(e.target.value)}
                    className="w-full h-32 bg-background border border-border rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-all resize-none"
                    placeholder="List rules (one per line)..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-muted-foreground uppercase tracking-wider">Additional Skills</label>
                  <p className="text-xs text-muted-foreground mb-2">Any special knowledge or instructions Randi should have.</p>
                  <textarea
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    className="w-full h-32 bg-background border border-border rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-all resize-none"
                    placeholder="Define additional skills or knowledge..."
                  />
                </div>
              </>
            )}
          </div>

          <div className="p-4 border-t border-border bg-muted/30">
            {message && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                {message.text}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-bold disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
