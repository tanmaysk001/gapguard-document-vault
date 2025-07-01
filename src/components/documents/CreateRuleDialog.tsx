import { useState } from 'react';
import { useSupabase } from '@/hooks/useSupabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CreateRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRuleCreated: () => void;
}

export function CreateRuleDialog({ open, onOpenChange, onRuleCreated }: CreateRuleDialogProps) {
  const supabase = useSupabase();
  const { toast } = useToast();
  const [ruleName, setRuleName] = useState('');
  const [requiredDocs, setRequiredDocs] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!supabase || !ruleName.trim() || !requiredDocs.trim()) {
      return toast({
        title: "Missing Information",
        description: "Please provide a rule name and at least one required document.",
        variant: "destructive"
      });
    }
    setIsSaving(true);
    
    // Split the textarea by new lines, trim whitespace, and filter out empty lines
    const required_doc_types = requiredDocs.split('\n').map(doc => doc.trim()).filter(Boolean);

    try {
      const { error } = await supabase.from('document_rules').insert({
        rule_name: ruleName.trim(),
        required_doc_types,
        status: 'active'
      });

      if (error) throw error;

      toast({
        title: "Rule Created",
        description: `The rule "${ruleName.trim()}" has been created successfully.`
      });
      onRuleCreated(); // Refresh the list on the parent page
      onOpenChange(false); // Close the dialog
      // Reset form for next time
      setRuleName('');
      setRequiredDocs('');

    } catch (error: any) {
      toast({
        title: "Error Creating Rule",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Custom Rule</DialogTitle>
          <DialogDescription>
            Define a custom rule and the documents required for it. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="rule-name" className="text-right">
              Rule Name
            </Label>
            <Input
              id="rule-name"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., New Employee Onboarding"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="required-docs" className="text-right">
              Required Documents
            </Label>
            <Textarea
              id="required-docs"
              value={requiredDocs}
              onChange={(e) => setRequiredDocs(e.target.value)}
              className="col-span-3"
              placeholder="Enter each document on a new line, e.g.,&#10;Signed Offer Letter&#10;I-9 Form&#10;W-4 Form"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 