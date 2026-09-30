"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { motion } from "framer-motion";
import { fieldFade } from "@/components/auth/AuthShell";
import { Loader2, ArrowLeft, LogOut, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { KycDocumentUpload } from "./KycDocumentUpload";
import { ChangeMerchantTypeDialog } from "./ChangeMerchantTypeDialog";

interface KycField {
  id: string;
  key: string;
  label: string;
  description?: string;
  dataType: string;
  inputType: string;
  isRequired: boolean;
  section: string;
  orderIndex: number;
  selectOptions?: string[];
  validationRules?: any;
}

function buildFieldRules(field: KycField) {
  const rules: any = { 
    required: field.isRequired ? "This field is required" : false 
  };
  
  if (field.validationRules && typeof field.validationRules === 'object' && field.validationRules.pattern) {
    try {
      rules.pattern = {
        value: new RegExp(field.validationRules.pattern),
        message: field.validationRules.message || "Invalid format"
      };
    } catch (e) {
      console.warn("Invalid regex pattern provided by API for field", field.key, field.validationRules.pattern);
    }
  }
  
  return rules;
}

const FIELD_PLACEHOLDERS: Record<string, string> = {
  company_name: "Enter your registered company or business name",
  owner_name: "Enter the owner's full name",
  company_address: "Enter your complete business address",
  website: "https://example.com",
  pan_number: "ABCDE1234F",
  aadhaar_number: "Enter 12-digit Aadhaar number",
  company_type: "Select company type"
};

export function DynamicKycForm() {
  const router = useRouter();
  const [formConfig, setFormConfig] = useState<any>(null);
  const [application, setApplication] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { control, handleSubmit, reset, setError, getValues, clearErrors } = useForm();

  useEffect(() => {
    async function loadData() {
      try {
        const [formRes, appRes, docsRes] = await Promise.all([
          fetch("/api/v1/merchant/kyc/form", { cache: "no-store" }),
          fetch("/api/v1/merchant/kyc/application", { cache: "no-store" }),
          fetch("/api/v1/merchant/kyc/documents", { cache: "no-store" })
        ]);

        if (!formRes.ok) throw new Error("Failed to load KYC form schema");
        if (!appRes.ok) throw new Error("Failed to load KYC application");
        if (!docsRes.ok) throw new Error("Failed to load KYC documents");

        const formJson = await formRes.json();
        const appJson = await appRes.json();
        const docsJson = await docsRes.json();

        setFormConfig(formJson.data);
        setApplication(appJson.data);
        setDocuments(docsJson.documents || []);

        // Pre-fill react-hook-form
        if (appJson.data?.answers) {
          const defaultValues: Record<string, any> = {};
          formJson.data.fields.forEach((field: KycField) => {
            const answer = appJson.data.answers.find((a: any) => a.fieldDefinitionId === field.id);
            if (answer && answer.value !== null) {
              defaultValues[field.key] = answer.value;
            }
          });
          reset(defaultValues);
        }
      } catch (err: any) {
        setFetchError(err.message || "Failed to load KYC data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [reset]);

  const isReadOnly = application?.status === "UNDER_REVIEW" || application?.status === "APPROVED";

  const handleSaveDraft = async (silent: boolean = false) => {
    setIsSaving(true);
    try {
      const currentValues = getValues();
      const answersToSave = formConfig.fields
        .filter((f: KycField) => f.dataType !== "FILE")
        .map((f: KycField) => ({
          fieldId: f.id,
          value: currentValues[f.key] || "",
        }))
        .filter((a: any) => a.value !== "");

      if (answersToSave.length === 0) {
        if (!silent) toast.success("Draft saved successfully");
        setIsSaving(false);
        return;
      }

      const res = await fetch("/api/v1/merchant/kyc/answers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answersToSave }),
      });

      if (!res.ok) {
        throw new Error("Failed to save draft");
      }
      if (!silent) toast.success("Draft saved successfully");
    } catch (err: any) {
      toast.error(err.message || "Error saving draft");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDocumentUploaded = (doc: any) => {
    setDocuments((prev) => [...prev, doc]);
  };

  const handleDocumentDeleted = (fieldId: string) => {
    setDocuments((prev) => prev.filter((d) => d.fieldDefinitionId !== fieldId));
  };

  const onSubmitClick = async () => {
    clearErrors();
    await handleSubmit(onSubmit, (errors) => {
      toast.error("Please correct the highlighted errors in the form.");
    })();
  };

  const onSubmit = async () => {
    // First save the latest text answers
    await handleSaveDraft(true);
    
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/merchant/kyc/application/submit", {
        method: "POST",
      });

      if (res.ok) {
        toast.success("Application submitted successfully");
        router.push("/kyc/under-review");
      } else if (res.status === 422) {
        const data = await res.json();
        toast.error("Please correct the highlighted errors in the form.");
        if (data.errors && Array.isArray(data.errors)) {
          data.errors.forEach((err: any) => {
            setError(err.fieldKey, { type: "server", message: err.message });
          });
        }
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to submit application");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error during submission");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExit = () => {
    router.push("/kyc/start");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-indigo-600 dark:text-indigo-400" />
        <p>Loading your application...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-destructive">
        <AlertCircle className="h-8 w-8 mb-4" />
        <p>{fetchError}</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (!formConfig || !formConfig.fields) {
    return <p className="text-center py-10">No form configuration found.</p>;
  }

  const sections = formConfig.fields.reduce((acc: Record<string, KycField[]>, field: KycField) => {
    const s = field.section || "General";
    if (!acc[s]) acc[s] = [];
    acc[s].push(field);
    return acc;
  }, {});

  return (
    <div className="w-full space-y-8">
      {/* Premium Header */}
      <motion.div variants={fieldFade} className="flex flex-col gap-5 items-start">
        <div className="space-y-3">
          <button 
            type="button"
            onClick={handleExit}
            className="inline-flex items-center text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to Overview
          </button>
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-foreground">
              {isReadOnly ? "Application Under Review" : "Merchant KYC Application"}
            </h1>
            <p className="mt-1.5 text-[14px] text-muted-foreground">
              {isReadOnly 
                ? "Your application has been submitted and is currently being reviewed."
                : "Please provide the requested information and documents below."}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-2.5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground">Type:</span>
            <span className="text-[13px] font-medium text-foreground">
              {application?.merchantType === 'COMPANY' ? 'Registered Company' : application?.merchantType === 'LLP' ? 'LLP' : 'Individual / Proprietorship'}
            </span>
            {!isReadOnly && (
              <button 
                type="button" 
                onClick={() => setShowChangeDialog(true)}
                className="ml-2 text-[13px] text-indigo-600 hover:underline focus:outline-none"
              >
                Change
              </button>
            )}
          </div>
          <div className="w-px h-4 bg-border mx-1"></div>
          <div className={`h-2 w-2 rounded-full ${isReadOnly ? 'bg-indigo-500' : 'bg-amber-500'}`} />
          <span className="text-[13px] font-medium text-muted-foreground">
            {isReadOnly ? "Under Review" : "Draft in Progress"}
          </span>
        </div>
      </motion.div>
      <ChangeMerchantTypeDialog 
        open={showChangeDialog} 
        onOpenChange={setShowChangeDialog} 
        currentType={application?.merchantType || "INDIVIDUAL"} 
        onSuccess={() => { setRefreshKey(prev => prev + 1); window.location.reload(); }}
      />

      <motion.div variants={fieldFade} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8">
          <form className="space-y-10" onSubmit={(e) => e.preventDefault()}>
            {Object.entries(sections).map(([sectionName, fields]) => (
              <div key={sectionName} className="space-y-6">
                <div className="border-b border-border/50 pb-3">
                  <h3 className="text-[14px] font-semibold text-foreground">
                    {sectionName}
                  </h3>
                </div>
                
                <div className="grid gap-6 sm:grid-cols-2">
                  {(fields as KycField[]).sort((a,b) => a.orderIndex - b.orderIndex).map((field) => (
                    <div key={field.id} className={`space-y-2 ${field.dataType === 'FILE' || field.inputType === 'TEXTAREA' ? 'sm:col-span-2' : ''}`}>
                      {field.dataType !== "FILE" && (
                        <div className="flex items-center space-x-1">
                          <label htmlFor={field.key} className="text-[13px] font-medium text-muted-foreground">
                            {field.label}
                          </label>
                          {field.isRequired ? (
                            <span className="text-destructive">*</span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/70 font-normal ml-1">(Optional)</span>
                          )}
                        </div>
                      )}
                      
                      {field.dataType === "STRING" && field.inputType === "TEXT" && (
                        <Controller
                          name={field.key}
                          control={control}
                          rules={buildFieldRules(field)}
                          render={({ field: fProps, fieldState }) => (
                            <>
                                <Input 
                                  {...fProps}
                                  id={field.key}
                                  value={fProps.value || ""} 
                                  disabled={isReadOnly}
                                  placeholder={FIELD_PLACEHOLDERS[field.key] || field.label}
                                  className={`h-11 w-full rounded-xl border bg-muted/50 px-4 text-[13.5px] text-foreground outline-none ring-0 transition-all duration-200 placeholder:text-muted-foreground/70 ${
                                    fieldState.error 
                                      ? "border-destructive/40 bg-destructive/5 focus-visible:border-destructive focus-visible:ring-2 focus-visible:ring-destructive/20" 
                                      : "border-border focus-visible:border-indigo-500/50 focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-indigo-500/20 hover:border-border"
                                  }`}
                                />
                              {fieldState.error && (<p className="text-[12.5px] font-medium text-destructive mt-1.5 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />{fieldState.error.message}</p>)}
                            </>
                          )}
                        />
                      )}

                      {field.dataType === "STRING" && field.inputType === "TEXTAREA" && (
                        <Controller
                          name={field.key}
                          control={control}
                          rules={buildFieldRules(field)}
                          render={({ field: fProps, fieldState }) => (
                            <>
                                <Textarea 
                                  {...fProps} 
                                  id={field.key}
                                  value={fProps.value || ""} 
                                  disabled={isReadOnly}
                                  placeholder={FIELD_PLACEHOLDERS[field.key] || field.label}
                                  className={`min-h-[100px] w-full rounded-xl border bg-muted/50 px-4 py-3 text-[13.5px] text-foreground outline-none ring-0 transition-all duration-200 placeholder:text-muted-foreground/70 resize-y ${
                                    fieldState.error 
                                      ? "border-destructive/40 bg-destructive/5 focus-visible:border-destructive focus-visible:ring-2 focus-visible:ring-destructive/20" 
                                      : "border-border focus-visible:border-indigo-500/50 focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-indigo-500/20 hover:border-border"
                                  }`}
                                />
                              {fieldState.error && (<p className="text-[12.5px] font-medium text-destructive mt-1.5 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />{fieldState.error.message}</p>)}
                            </>
                          )}
                        />
                      )}

                      {field.dataType === "STRING" && field.inputType === "SELECT" && (
                        <Controller
                          name={field.key}
                          control={control}
                          rules={buildFieldRules(field)}
                          render={({ field: fProps, fieldState }) => (
                            <>
                              <Select 
                                disabled={isReadOnly} 
                                value={fProps.value || ""} 
                                onValueChange={fProps.onChange}
                              >
                                <SelectTrigger id={field.key} className={`h-11 w-full rounded-xl border bg-muted/50 px-4 text-[13.5px] text-foreground outline-none ring-0 transition-all duration-200 ${
                                  fieldState.error 
                                    ? "border-destructive/40 bg-destructive/5 focus-visible:border-destructive focus-visible:ring-2 focus-visible:ring-destructive/20" 
                                    : "border-border focus-visible:border-indigo-500/50 focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-indigo-500/20 hover:border-border"
                                }`}>
                                  <SelectValue placeholder={FIELD_PLACEHOLDERS[field.key] || "Select an option"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {field.selectOptions?.map(opt => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {fieldState.error && (<p className="text-[12.5px] font-medium text-destructive mt-1.5 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />{fieldState.error.message}</p>)}
                            </>
                          )}
                        />
                      )}

                      {field.dataType === "FILE" && (
                        <Controller
                          name={field.key}
                          control={control}
                          render={({ fieldState }) => (
                            <KycDocumentUpload
                              fieldId={field.id}
                              label={field.label}
                              description={field.description}
                              isRequired={field.isRequired}
                              disabled={isReadOnly}
                              existingDocument={documents.find(d => d.fieldDefinitionId === field.id && (d.status === "UPLOADED" || d.status === "PENDING"))}
                              onUploadComplete={handleDocumentUploaded}
                              onDeleteComplete={handleDocumentDeleted}
                              error={fieldState.error?.message}
                            />
                          )}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </form>
        </div>

        {!isReadOnly && (
          <div className="bg-muted/50 px-6 py-5 sm:px-8 border-t border-border/50 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-4 gap-3 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => handleSaveDraft()} 
              disabled={isSaving || isSubmitting}
              className="w-full sm:w-auto h-11 rounded-xl text-[13.5px] font-medium border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Draft
            </Button>
            <Button 
              onClick={onSubmitClick} 
              disabled={isSaving || isSubmitting}
              className="w-full sm:w-auto h-11 rounded-xl bg-indigo-600 text-[13.5px] font-semibold text-white shadow-[0_4px_14px_rgba(79,70,229,.22)] transition-all hover:bg-indigo-700 hover:-translate-y-[1px] hover:shadow-[0_6px_20px_rgba(79,70,229,.28)] active:translate-y-[0px] active:shadow-none"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit Application
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
