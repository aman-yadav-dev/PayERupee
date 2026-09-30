// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DynamicKycForm } from '@/components/merchant/kyc/DynamicKycForm';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock Sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock ResizeObserver for Radix UI
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('DynamicKycForm Frontend Tests', () => {
  const mockPush = vi.fn();
  const mockRefresh = vi.fn();
  
  const mockFormConfig = {
    data: {
      id: "form-1",
      fields: [
        { id: "f1", key: "company_name", label: "Company Name", dataType: "STRING", inputType: "TEXT", isRequired: true, section: "Identity", applicableTypes: ["COMPANY", "LLP", "INDIVIDUAL"], orderIndex: 1 },
        { id: "f2", key: "company_address", label: "Company Address", dataType: "STRING", inputType: "TEXTAREA", isRequired: true, section: "Identity", orderIndex: 2 },
        { id: "f3", key: "company_type", label: "Company Type", dataType: "STRING", inputType: "SELECT", isRequired: true, section: "Identity", orderIndex: 3, selectOptions: ["COMPANY", "LLP"] },
        { id: "f4", key: "website", label: "Website", dataType: "STRING", inputType: "TEXT", isRequired: false, section: "Identity", orderIndex: 4 },
        { id: "f5", key: "pan_document", label: "PAN Document", dataType: "FILE", inputType: "FILE", isRequired: true, section: "Identity", orderIndex: 5 },
        { id: "f6", key: "pan_number", label: "PAN Number", dataType: "STRING", inputType: "TEXT", isRequired: true, section: "Identity", orderIndex: 6, validationRules: { pattern: "^[A-Z]{5}[0-9]{4}[A-Z]{1}$", message: "Invalid PAN format" } },
        { id: "f7", key: "aadhaar_number", label: "Aadhaar Number", dataType: "STRING", inputType: "TEXT", isRequired: true, section: "Identity", orderIndex: 7, validationRules: { pattern: "^\\d{12}$", message: "Aadhaar must be 12 digits" } },
      ]
    }
  };

  const mockApp = {
    data: {
      id: "app-1",
      status: "PENDING_SUBMISSION",
      answers: [
        { fieldDefinitionId: "f1", value: "Existing Company" },
        { fieldDefinitionId: "f2", value: "123 Street" },
        { fieldDefinitionId: "f3", value: "COMPANY" },
        { fieldDefinitionId: "f6", value: "ABCDE1234F" },
        { fieldDefinitionId: "f7", value: "123456789012" }
      ]
    }
  };

  const mockDocs = {
    documents: [
      { id: "doc-1", fieldDefinitionId: "f5", originalFilename: "pan.pdf", status: "UPLOADED" }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
    });
    
    global.fetch = vi.fn((url: string, options?: any) => {
      if (url === "/api/v1/merchant/kyc/form") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFormConfig) });
      }
      if (url === "/api/v1/merchant/kyc/application") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockApp) });
      }
      if (url === "/api/v1/merchant/kyc/documents") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockDocs) });
      }
      if (url === "/api/v1/merchant/kyc/answers") {
        return Promise.resolve({ ok: true });
      }
      if (url === "/api/v1/merchant/kyc/application/submit") {
        return Promise.resolve({ ok: true });
      }
      return Promise.reject(new Error("Unhandled fetch: " + url));
    }) as any;
  });

  it('renders dynamically from API definitions and prefills answers', async () => {
    render(<DynamicKycForm />);
    
    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByText('Merchant KYC Application')).toBeDefined();
    });

    // Check dynamic fields rendered
    expect(screen.getByLabelText(/Company Name/)).toBeDefined();
    expect(screen.getByLabelText(/Company Address/)).toBeDefined();
    expect(screen.getByLabelText(/Website/)).toBeDefined();
    
    // Check required indicators (using regex for asterisks in DOM)
    // Actually, label htmlFor is not set by default in shadcn without FormItem, so let's check values
    
    // Check prefill
    const companyInput = screen.getByDisplayValue('Existing Company');
    expect(companyInput).toBeDefined();

    // Check optional/required via the DOM (we know they are inputs)
    expect(screen.getByText('PAN Document')).toBeDefined();
    expect(screen.getByText('pan.pdf')).toBeDefined();
    expect(screen.getByText('Uploaded successfully')).toBeDefined();
  });

  it('allows saving partial draft', async () => {
    const user = userEvent.setup();
    render(<DynamicKycForm />);
    
    await waitFor(() => {
      expect(screen.getByText('Save Draft')).toBeDefined();
    });

    const saveBtn = screen.getByText('Save Draft');
    await user.click(saveBtn);

    expect(global.fetch).toHaveBeenCalledWith("/api/v1/merchant/kyc/answers", expect.objectContaining({
      method: "PUT",
    }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Draft saved successfully");
    });
  });

  it('handles submission validation failure and maps errors', async () => {
    const user = userEvent.setup();
    
    // Mock submit failure
    global.fetch = vi.fn((url: string, options?: any) => {
      if (url === "/api/v1/merchant/kyc/form") return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFormConfig) });
      if (url === "/api/v1/merchant/kyc/application") return Promise.resolve({ ok: true, json: () => Promise.resolve(mockApp) });
      if (url === "/api/v1/merchant/kyc/documents") return Promise.resolve({ ok: true, json: () => Promise.resolve(mockDocs) });
      if (url === "/api/v1/merchant/kyc/answers") return Promise.resolve({ ok: true });
      if (url === "/api/v1/merchant/kyc/application/submit") {
        return Promise.resolve({ 
          ok: false, 
          status: 422, 
          json: () => Promise.resolve({ 
            success: false, 
            errors: [{ fieldKey: "company_address", message: "Address is required" }] 
          }) 
        });
      }
      return Promise.reject(new Error("Unhandled"));
    }) as any;

    render(<DynamicKycForm />);
    await waitFor(() => {
      expect(screen.getByText('Submit Application')).toBeDefined();
    });

    const submitBtn = screen.getByText('Submit Application');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Please correct the highlighted errors in the form.");
      expect(screen.getByText("Address is required")).toBeDefined();
    });
  });

  it('handles successful submission and redirects', async () => {
    const user = userEvent.setup();
    render(<DynamicKycForm />);
    await waitFor(() => {
      expect(screen.getByText('Submit Application')).toBeDefined();
    });

    const submitBtn = screen.getByText('Submit Application');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/v1/merchant/kyc/application/submit", expect.any(Object));
      expect(toast.success).toHaveBeenCalledWith("Application submitted successfully");
      expect(mockPush).toHaveBeenCalledWith("/kyc/under-review");
    });
  });

  it('renders read-only state when UNDER_REVIEW', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url === "/api/v1/merchant/kyc/form") return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFormConfig) });
      if (url === "/api/v1/merchant/kyc/application") return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { ...mockApp.data, status: "UNDER_REVIEW" } }) });
      if (url === "/api/v1/merchant/kyc/documents") return Promise.resolve({ ok: true, json: () => Promise.resolve(mockDocs) });
      return Promise.reject(new Error("Unhandled"));
    }) as any;

    render(<DynamicKycForm />);
    await waitFor(() => {
      expect(screen.getByText('Application Under Review')).toBeDefined();
    });

    // Check that inputs are disabled
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach(input => expect((input as HTMLInputElement).disabled).toBe(true));

    // Buttons should not be present
    expect(screen.queryByText('Save Draft')).toBeNull();
    expect(screen.queryByText('Submit Application')).toBeNull();
  });
  
  it('navigates appropriately on Exit', async () => {
    const user = userEvent.setup();
    render(<DynamicKycForm />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Back to Overview/i })).toBeDefined();
    });

    const exitBtn = screen.getByRole('button', { name: /Back to Overview/i });
    await user.click(exitBtn);

    expect(mockPush).toHaveBeenCalledWith("/kyc/start");
  });

  it('enforces client-side pattern validation for PAN and Aadhaar', async () => {
    const user = userEvent.setup();
    render(<DynamicKycForm />);
    await waitFor(() => {
      expect(screen.getByText('Merchant KYC Application')).toBeDefined();
    });

    const panInput = screen.getByLabelText(/PAN Number/);
    const aadhaarInput = screen.getByLabelText(/Aadhaar Number/);

    // Type invalid PAN
    await user.type(panInput, 'invalid');
    await user.click(screen.getByText('Submit Application'));

    // Wait for the pattern validation error
    await waitFor(() => {
      expect(screen.getByText('Invalid PAN format')).toBeDefined();
    });

    // Clear and type valid PAN
    await user.clear(panInput);
    await user.type(panInput, 'ABCDE1234F');
    await user.click(screen.getByText('Submit Application'));

    // Wait for PAN error to clear
    await waitFor(() => {
      expect(screen.queryByText('Invalid PAN format')).toBeNull();
    });

    // Type invalid Aadhaar
    await user.type(aadhaarInput, '123');
    await user.click(screen.getByText('Submit Application'));

    await waitFor(() => {
      expect(screen.getByText('Aadhaar must be 12 digits')).toBeDefined();
    });

    // Type valid Aadhaar
    await user.clear(aadhaarInput);
    await user.type(aadhaarInput, '123456789012');
    await user.click(screen.getByText('Submit Application'));

    await waitFor(() => {
      expect(screen.queryByText('Aadhaar must be 12 digits')).toBeNull();
    });
  });

});
