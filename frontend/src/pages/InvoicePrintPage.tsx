import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import InvoiceTemplate from '../templates/InvoiceTemplate';

interface InvoiceData {
  jobCard: {
    job_no?: string;
    job_code?: string;
    reg_no: string;
    reg_number?: string;
    car_name?: string;
    car_make?: string;
    car_model?: string;
    owner_name: string;
    customer_name?: string;
    mobile?: string;
    customer_phone?: string;
    insurance_company?: string;
    insurance_expiry?: string;
    km_reading?: number;
    created_at: string;
    advance_amount?: number;
    amount_paid?: number;
  };
  customer?: {
    customer_name?: string;
    mobile_no?: string;
    email?: string;
    gstin?: string;
    company_name?: string;
  };
  services: Array<{
    service_name: string;
    hsn_sac?: string;
    qty: number;
    quantity?: number;
    rate: number;
    unit_price?: number;
    amount: number;
    line_total?: number;
    tax_pct?: number;
  }>;
  invoice?: {
    invoice_no: string;
    invoice_code?: string;
    subtotal: number;
    gst_amount: number;
    total_amount: number;
    discount_amount?: number;
    apply_gst?: number | boolean;
    payment_mode?: string;
    created_at?: string;
    cgst_rate?: number;
    cgst_amount?: number;
    sgst_rate?: number;
    sgst_amount?: number;
    taxable_amount?: number;
  };
  estimate?: {
    estimate_no: string;
    estimate_code?: string;
    subtotal: number;
    total_amount: number;
    discount_amount?: number;
    payment_mode?: string;
  };
  concerns?: Array<{ concern_text: string }>;
}

export default function InvoicePrintPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const endpoint = type === 'quick' 
          ? `/quick-job-cards/${id}/invoice-data`
          : `/jobs/${id}/invoice-data`;

        const response = await apiClient.get(endpoint);
        if (response.data && response.data.success) {
          setData(response.data.data);
        } else {
          setError('Failed to fetch invoice data.');
        }
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.error?.message || 'Server error occurred while fetching invoice data.');
      } finally {
        setLoading(false);
      }
    }

    if (id && type) {
      fetchData();
    }
  }, [id, type]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#0c0c0e', color: '#ffffff', fontFamily: 'sans-serif' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid rgba(255, 43, 43, 0.1)', borderTopColor: '#ff2b2b', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '20px', fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase', color: '#a0aec0' }}>
          Loading printable docket...
        </p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#0c0c0e', color: '#ffffff', fontFamily: 'sans-serif', padding: '20px', textAlign: 'center' }}>
        <span style={{ fontSize: '48px', color: '#ff2b2b', marginBottom: '15px' }} className="material-symbols-outlined">
          warning
        </span>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 10px 0' }}>Error Loading Docket</h1>
        <p style={{ fontSize: '14px', color: '#a0aec0', maxWidth: '400px', margin: '0 0 20px 0', lineHeight: '1.5' }}>
          {error || 'No docket data available.'}
        </p>
        <button
          onClick={() => navigate(-1)}
          style={{ backgroundColor: '#ff2b2b', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
        >
          Go Back
        </button>
      </div>
    );
  }

  // Map regular fields to template fields to support both models
  const jc = data.jobCard;
  const mappedJobCard = {
    job_no: jc.job_code || jc.job_no || '—',
    reg_no: jc.reg_number || jc.reg_no || '—',
    car_name: jc.car_name,
    car_make: jc.car_make,
    car_model: jc.car_model,
    owner_name: jc.customer_name || jc.owner_name || '—',
    mobile: jc.customer_phone || jc.mobile || '—',
    insurance_company: jc.insurance_company,
    insurance_expiry: jc.insurance_expiry,
    km_reading: jc.km_reading,
    created_at: jc.created_at,
    advance_amount: (jc as any).advance_amount,
    amount_paid: jc.amount_paid
  };

  const mappedServices = data.services.map((s) => ({
    service_name: s.service_name,
    hsn_sac: s.hsn_sac,
    qty: s.quantity !== undefined ? Number(s.quantity) : Number(s.qty || 1),
    rate: s.unit_price !== undefined ? Number(s.unit_price) : Number(s.rate || 0),
    amount: s.line_total !== undefined ? Number(s.line_total) : Number(s.amount || 0),
    tax_pct: s.tax_pct
  }));

  const mappedInvoice = data.invoice ? {
    invoice_no: data.invoice.invoice_code || data.invoice.invoice_no || '—',
    subtotal: Number(data.invoice.subtotal || 0),
    gst_amount: Number(data.invoice.gst_amount || 0),
    total_amount: Number(data.invoice.total_amount || 0),
    discount_amount: data.invoice.discount_amount !== undefined ? Number(data.invoice.discount_amount) : 0,
    apply_gst: data.invoice.apply_gst !== undefined ? Boolean(data.invoice.apply_gst) : false,
    payment_mode: data.invoice.payment_mode,
    created_at: data.invoice.created_at,
    cgst_rate: data.invoice.cgst_rate !== undefined ? Number(data.invoice.cgst_rate) : undefined,
    cgst_amount: data.invoice.cgst_amount !== undefined ? Number(data.invoice.cgst_amount) : undefined,
    sgst_rate: data.invoice.sgst_rate !== undefined ? Number(data.invoice.sgst_rate) : undefined,
    sgst_amount: data.invoice.sgst_amount !== undefined ? Number(data.invoice.sgst_amount) : undefined,
    taxable_amount: data.invoice.taxable_amount !== undefined ? Number(data.invoice.taxable_amount) : undefined,
  } : undefined;

  const mappedEstimate = data.estimate ? {
    estimate_no: data.estimate.estimate_code || data.estimate.estimate_no || '—',
    subtotal: Number(data.estimate.subtotal || 0),
    total_amount: Number(data.estimate.total_amount || 0),
    discount_amount: data.estimate.discount_amount !== undefined ? Number(data.estimate.discount_amount) : 0,
    payment_mode: data.estimate.payment_mode
  } : undefined;

  // If there's an invoice, show invoice, otherwise show estimate
  const printType = mappedInvoice ? 'invoice' : 'estimate';

  return (
    <div style={{ backgroundColor: '#f3f4f6', minHeight: '100vh', padding: '20px 0' }}>
      {/* NO-PRINT CONTROLS */}
      <div
        className="no-print mx-4 md:mx-auto"
        style={{
          maxWidth: '850px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0c0c0e',
          color: '#ffffff',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#ff2b2b' }} className="material-symbols-outlined">print</span>
          <span style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'sans-serif' }}>Print Preview Mode</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => window.print()}
            style={{
              backgroundColor: '#ff2b2b',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            Print / Download
          </button>
          <button
            onClick={() => navigate(-1)}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
 
      {/* RENDER INVOICE */}
      <div className="overflow-x-auto print:overflow-visible px-4 print:px-0">
        <div className="min-w-[850px] print:min-w-0 mx-auto">
          <InvoiceTemplate
            jobCard={mappedJobCard}
            customer={data.customer}
            services={mappedServices}
            invoice={mappedInvoice}
            estimate={mappedEstimate}
            concerns={data.concerns}
            type={printType}
            source={type === 'quick' ? 'quick' : 'regular'}
            studioName="Pack Wolf Pvt Ltd"
            studioPhone="+91 9925566886"
          />
        </div>
      </div>
    </div>
  );
}
