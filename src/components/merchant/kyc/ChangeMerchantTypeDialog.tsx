"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Briefcase, UserCircle, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentType: string;
  onSuccess?: () => void;
}

export function ChangeMerchantTypeDialog({ open, onOpenChange, currentType, onSuccess }: Props) {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState(currentType);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (selectedType === currentType) {
      onOpenChange(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/merchant/kyc/application", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantType: selectedType })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update business type");
      }

      toast.success("Business type updated successfully");
      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Change Business Type</DialogTitle>
          <DialogDescription>
            Select your new business type. 
            <span className="block mt-2 font-medium text-destructive">
              Fields and documents that do not apply to the selected type will be hidden but securely preserved in your draft. If you switch back before submitting, your previous information will return. Final submission permanently removes any information that does not apply to the finalized business type.
            </span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <button
            type="button"
            onClick={() => setSelectedType("INDIVIDUAL")}
            disabled={isSubmitting}
            className={`flex items-center gap-3 rounded-xl border p-4 transition-all text-left w-full outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
              selectedType === "INDIVIDUAL"
                ? "border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100"
                : "border-border bg-card hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <UserCircle className="h-5 w-5 opacity-70 flex-shrink-0" />
            <div className="grid gap-0.5 flex-1">
              <p className="text-[14px] font-semibold">Individual</p>
              <p className="text-[12.5px] font-normal opacity-70">Proprietorship</p>
            </div>
            {selectedType === "INDIVIDUAL" && <CheckCircle2 className="h-5 w-5 text-indigo-600" />}
          </button>
          
          <button
            type="button"
            onClick={() => setSelectedType("COMPANY")}
            disabled={isSubmitting}
            className={`flex items-center gap-3 rounded-xl border p-4 transition-all text-left w-full outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
              selectedType === "COMPANY"
                ? "border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100"
                : "border-border bg-card hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <Briefcase className="h-5 w-5 opacity-70 flex-shrink-0" />
            <div className="grid gap-0.5 flex-1">
              <p className="text-[14px] font-semibold">Registered Company</p>
              <p className="text-[12.5px] font-normal opacity-70">Private Limited, LLP, etc.</p>
            </div>
            {selectedType === "COMPANY" && <CheckCircle2 className="h-5 w-5 text-indigo-600" />}
          </button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || selectedType === currentType} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirm Change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
