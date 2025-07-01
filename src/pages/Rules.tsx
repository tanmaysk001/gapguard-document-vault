import { useState, useEffect } from 'react';
import { useSupabase } from '@/hooks/useSupabase';
import { useAuth } from '@clerk/clerk-react';
import { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CreateRuleDialog } from '@/components/documents/CreateRuleDialog';

type Rule = Database['public']['Tables']['document_rules']['Row'];

export default function RulesPage() {
  const supabase = useSupabase();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [updatingRuleId, setUpdatingRuleId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  useEffect(() => {
    if (supabase) {
      fetchRules();
    }
  }, [supabase]);

  const fetchRules = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.from('document_rules').select('*');
    if (error) {
      toast({ title: "Error fetching rules", description: error.message, variant: "destructive" });
    } else {
      setRules(data || []);
    }
    setLoading(false);
  };

  const cleanupDuplicateRules = async () => {
    if (!supabase) return;
    setIsCleaningUp(true);
    
    try {
      // Get all suggested rules grouped by rule_name
      const { data: suggestedRules, error } = await supabase
        .from('document_rules')
        .select('*')
        .eq('status', 'suggested')
        .order('created_at', { ascending: true }); // Keep oldest, delete newest

      if (error) throw error;

      if (!suggestedRules || suggestedRules.length === 0) {
        toast({ title: "No duplicates found", description: "No duplicate suggested rules to clean up." });
        setIsCleaningUp(false);
        return;
      }

      // Group by rule_name (case-insensitive)
      const ruleGroups = new Map<string, Rule[]>();
      suggestedRules.forEach(rule => {
        const key = rule.rule_name
          .toLowerCase()
          .trim()
          .replace(/\s+/g, ' ');
        if (!ruleGroups.has(key)) {
          ruleGroups.set(key, []);
        }
        ruleGroups.get(key)!.push(rule);
      });

      // Find duplicates and mark for deletion
      const toDelete: string[] = [];
      ruleGroups.forEach(rules => {
        if (rules.length > 1) {
          // Keep the first one, delete the rest
          toDelete.push(...rules.slice(1).map(r => r.id));
        }
      });

      if (toDelete.length === 0) {
        toast({ title: "No duplicates found", description: "All suggested rules are unique." });
        setIsCleaningUp(false);
        return;
      }

      // Delete the duplicates
      const { error: deleteError } = await supabase
        .from('document_rules')
        .delete()
        .in('id', toDelete);

      if (deleteError) throw deleteError;

      toast({ 
        title: "Cleanup completed", 
        description: `Removed ${toDelete.length} duplicate suggested rules.` 
      });

      // Refresh the rules list
      await fetchRules();

    } catch (error: any) {
      toast({
        title: "Error cleaning up duplicates",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleSuggestRules = async () => {
    if (!supabase) return;
    setIsSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest_rules', {
        method: 'POST',
      });

      if (error) throw error;
      
      const newSuggestions = data.suggestions || [];
      if (newSuggestions.length > 0) {
        // Add new suggestions to the existing state without duplicates
        setRules(prevRules => {
          const existingIds = new Set(prevRules.map(r => r.id));
          const uniqueNewSuggestions = newSuggestions.filter((s: Rule) => !existingIds.has(s.id));
          return [...prevRules, ...uniqueNewSuggestions];
        });
      }

      toast({
        title: "Suggestions Generated",
        description: data.message || "AI-powered rule suggestions have been added for your review.",
      });

    } catch (error: any) {
      toast({
        title: "Error Generating Suggestions",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleRuleUpdate = async (ruleId: string, newStatus: 'active' | 'archived') => {
    if (!supabase) return;
    setUpdatingRuleId(ruleId);

    try {
      if (newStatus === 'active') {
        const { error } = await supabase
          .from('document_rules')
          .update({ status: 'active' })
          .eq('id', ruleId);
        
        if (error) throw error;

        setRules(prevRules => prevRules.map(r => r.id === ruleId ? {...r, status: 'active'} : r));
        toast({ title: "Rule Approved", description: "The rule is now active and will be used for gap analysis." });
      } else { // 'archived' is our decline/delete action
        const { error } = await supabase
          .from('document_rules')
          .delete()
          .eq('id', ruleId);

        if (error) throw error;
        
        setRules(prevRules => prevRules.filter(r => r.id !== ruleId));
        toast({ title: "Rule Declined", description: "The suggestion has been removed." });
      }
    } catch (error: any) {
      toast({ title: "Error updating rule", description: error.message, variant: "destructive" });
    } finally {
      setUpdatingRuleId(null);
    }
  };

  const activeRules = rules.filter(rule => rule.status === 'active');
  const suggestedRules = rules.filter(rule => rule.status === 'suggested');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Suggested Rules</CardTitle>
              <CardDescription>
                Our AI can suggest rules based on your documents. Approve them to start tracking for gaps.
              </CardDescription>
            </div>
            <div className="flex space-x-2">
              {suggestedRules.length > 5 && (
                <Button 
                  variant="outline" 
                  onClick={cleanupDuplicateRules} 
                  disabled={isCleaningUp}
                  size="sm"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isCleaningUp ? 'Cleaning...' : 'Clean Duplicates'}
                </Button>
              )}
            <Button onClick={handleSuggestRules} disabled={isSuggesting}>
              {isSuggesting ? 'Generating...' : 'Suggest Rules'}
            </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {suggestedRules.length > 0 ? (
              suggestedRules.map(rule => (
                <div key={rule.id} className="p-4 border rounded-lg flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{rule.rule_name}</h3>
                    <p className="text-sm text-gray-500">{rule.description}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="icon" onClick={() => handleRuleUpdate(rule.id, 'active')} disabled={updatingRuleId === rule.id}>
                      <ThumbsUp className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleRuleUpdate(rule.id, 'archived')} disabled={updatingRuleId === rule.id}>
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No new suggestions. Click "Suggest Rules" to get started.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Active Rules</CardTitle>
              <CardDescription>These are the rules currently being used for gap analysis.</CardDescription>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>Create Custom Rule</Button>
          </div>
        </CardHeader>
        <CardContent>
           <ul className="space-y-2">
            {activeRules.length > 0 ? (
              activeRules.map(rule => (
                <li key={rule.id} className="p-3 bg-gray-50 rounded-md flex items-center">
                  <Badge variant="secondary">{rule.rule_name}</Badge>
                </li>
              ))
            ) : (
              <p className="text-sm text-gray-500">You have no active rules. Approve a suggestion or create one.</p>
            )}
          </ul>
        </CardContent>
      </Card>
      <CreateRuleDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onRuleCreated={fetchRules}
      />
    </div>
  );
} 