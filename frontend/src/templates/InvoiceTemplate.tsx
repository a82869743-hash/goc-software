import React from 'react';

export interface InvoiceTemplateProps {
  jobCard: {
    job_no: string;
    reg_no: string;
    car_name?: string;
    car_make?: string;
    car_model?: string;
    owner_name: string;
    mobile?: string;
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
    rate: number;
    amount: number;
    tax_pct?: number;
  }>;
  invoice?: {
    invoice_no: string;
    subtotal: number;
    gst_amount: number;
    total_amount: number;
    discount_amount?: number;
    apply_gst?: boolean;
    payment_mode?: string;
    created_at?: string;
    cgst_rate?: number;
    cgst_amount?: number;
    sgst_rate?: number;
    sgst_amount?: number;
    taxable_amount?: number;
    invoice_type?: string;
  };
  estimate?: {
    estimate_no: string;
    subtotal: number;
    total_amount: number;
    discount_amount?: number;
    payment_mode?: string;
  };
  concerns?: Array<{ concern_text: string }>;
  type: 'invoice' | 'estimate';
  source?: 'regular' | 'quick';
  studioName?: string;
  studioAddress?: string;
  studioPhone?: string;
  studioGstin?: string;
}

export function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const n = Math.floor(num);
  if (n === 0) return 'Zero';

  const helper = (val: number): string => {
    if (val < 20) return ones[val];
    if (val < 100) return tens[Math.floor(val / 10)] + (val % 10 ? ' ' + ones[val % 10] : '');
    if (val < 1000) return ones[Math.floor(val / 100)] + ' Hundred' + (val % 100 ? ' and ' + helper(val % 100) : '');
    if (val < 100000) return helper(Math.floor(val / 1000)) + ' Thousand' + (val % 1000 ? ' ' + helper(val % 1000) : '');
    if (val < 10000000) return helper(Math.floor(val / 100000)) + ' Lakh' + (val % 100000 ? ' ' + helper(val % 100000) : '');
    return helper(Math.floor(val / 10000000)) + ' Crore' + (val % 10000000 ? ' ' + helper(val % 10000000) : '');
  };

  return helper(n);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()}-${months[d.getMonth()]}-${String(d.getFullYear()).substring(2)}`;
  } catch {
    return dateStr;
  }
}

export function formatCurrency(n: number): string {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InvoiceTemplate({
  jobCard,
  customer,
  services,
  invoice,
  estimate,
  type,
  studioName = 'Packwolf Services Pvt Ltd',
  studioAddress = 'G-7, B.I.D.C Estate, Gorwa, Vadodara, Gujarat',
  studioPhone = '+91 9925566886',
  studioGstin = '24AANCP8548A1ZB'
}: InvoiceTemplateProps) {
  const isInvoice = type === 'invoice';
  const docNo = isInvoice ? (invoice?.invoice_no || '—') : (estimate?.estimate_no || '—');
  const docDate = isInvoice ? (invoice?.created_at || jobCard.created_at) : jobCard.created_at;
  const paymentMode = isInvoice ? (invoice?.payment_mode || 'UPI/CASH') : (estimate?.payment_mode || 'UPI/CASH');

  const subtotalVal = isInvoice ? (invoice?.subtotal || 0) : (estimate?.subtotal || 0);
  const gstVal = isInvoice ? (invoice?.gst_amount || 0) : 0;
  const totalVal = isInvoice ? (invoice?.total_amount || 0) : (estimate?.total_amount || 0);
  const discountVal = isInvoice ? (invoice?.discount_amount || 0) : (estimate?.discount_amount || 0);
  const applyGst = isInvoice ? (invoice?.apply_gst ?? false) : false;
  const cgstAmount = isInvoice ? (invoice?.cgst_amount ?? 0) : 0;
  const sgstAmount = isInvoice ? (invoice?.sgst_amount ?? 0) : 0;
  const taxableVal = isInvoice ? (invoice?.taxable_amount ?? (subtotalVal - discountVal)) : (subtotalVal - discountVal);
  const advanceVal = Number(jobCard.advance_amount || 0);
  const totalPaidVal = Number(jobCard.amount_paid || 0);
  const balanceDueVal = Math.max(0, totalVal - totalPaidVal);
  const finalPaymentVal = Math.max(0, totalPaidVal - advanceVal);

  const docTitle = isInvoice 
    ? (invoice?.invoice_type === 'tax_invoice' ? 'TAX INVOICE' : invoice?.invoice_type === 'proforma' ? 'PROFORMA INVOICE' : 'BILL OF SUPPLY')
    : 'BILL OF SUPPLY';

  return (
    <div className="tally-invoice-container" style={{ width: '100%', maxWidth: '850px', margin: '0 auto', padding: '10px', boxSizing: 'border-box', backgroundColor: '#ffffff', color: '#000000', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .tally-invoice-container {
            padding: 0 !important;
            max-width: 100% !important;
          }
        }
        @page {
          size: A4;
          margin: 10mm;
        }
      `}</style>
      
      <div style={{ width: '100%', border: '1px solid #000000', boxSizing: 'border-box' }}>
        {/* Document Header */}
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #000000', padding: '4px 8px', boxSizing: 'border-box' }}>
          <div style={{ width: '20%' }}></div>
          <div style={{ width: '60%', textAlign: 'center' }}>
            <strong style={{ fontSize: '12px', letterSpacing: '1px' }}>{docTitle}</strong>
            {(!isInvoice || invoice?.invoice_type !== 'tax_invoice') && (
              <span style={{ display: 'block', fontSize: '8px', fontStyle: 'italic', fontWeight: 'normal' }}>
                Composition taxableperson. Not eligible to collect tax on supplies
              </span>
            )}
          </div>
          <div style={{ width: '20%', textAlign: 'right' }}>
            <img src="/logo.png" style={{ height: '40px', verticalAlign: 'middle' }} alt="GOC Logo" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
        </div>
        
        {/* Row 1: Company details vs. Doc details */}
        <div style={{ display: 'flex', borderBottom: '1px solid #000000' }}>
          <div style={{ width: '50%', borderRight: '1px solid #000000', padding: '8px', boxSizing: 'border-box', fontSize: '10px', lineHeight: '1.4' }}>
            <strong style={{ fontSize: '11px' }}>{studioName.toUpperCase()}</strong><br />
            {studioAddress}<br />
            <strong>GSTIN/UIN:</strong> {studioGstin}<br />
            State Name: Gujarat, Code: 24<br />
            Contact: {studioPhone}<br />
            E-Mail: info@packwolfservices.com
          </div>
          
          <div style={{ width: '50%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #000000', flex: 1 }}>
              <div style={{ width: '50%', borderRight: '1px solid #000000', padding: '6px 8px', boxSizing: 'border-box' }}>
                <span style={{ fontSize: '8px', color: '#444444', textTransform: 'uppercase', fontWeight: 'bold' }}>Invoice No.</span><br />
                <strong>{docNo}</strong>
              </div>
              <div style={{ width: '50%', padding: '6px 8px', boxSizing: 'border-box' }}>
                <span style={{ fontSize: '8px', color: '#444444', textTransform: 'uppercase', fontWeight: 'bold' }}>Dated</span><br />
                <strong>{formatDate(docDate)}</strong>
              </div>
            </div>
            
            <div style={{ display: 'flex', borderBottom: '1px solid #000000', flex: 1 }}>
              <div style={{ width: '50%', borderRight: '1px solid #000000', padding: '6px 8px', boxSizing: 'border-box' }}>
                <span style={{ fontSize: '8px', color: '#444444', textTransform: 'uppercase', fontWeight: 'bold' }}>Delivery Note</span><br />
                <span>—</span>
              </div>
              <div style={{ width: '50%', padding: '6px 8px', boxSizing: 'border-box' }}>
                <span style={{ fontSize: '8px', color: '#444444', textTransform: 'uppercase', fontWeight: 'bold' }}>Mode/Terms of Payment</span><br />
                <strong>{paymentMode.toUpperCase()}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid #000000', flex: 1 }}>
              <div style={{ width: '50%', borderRight: '1px solid #000000', padding: '6px 8px', boxSizing: 'border-box' }}>
                <span style={{ fontSize: '8px', color: '#444444', textTransform: 'uppercase', fontWeight: 'bold' }}>Reference No. & Date</span><br />
                <span>—</span>
              </div>
              <div style={{ width: '50%', padding: '6px 8px', boxSizing: 'border-box' }}>
                <span style={{ fontSize: '8px', color: '#444444', textTransform: 'uppercase', fontWeight: 'bold' }}>Other References</span><br />
                <span>—</span>
              </div>
            </div>

            <div style={{ display: 'flex', flex: 1 }}>
              <div style={{ width: '50%', borderRight: '1px solid #000000', padding: '6px 8px', boxSizing: 'border-box' }}>
                <span style={{ fontSize: '8px', color: '#444444', textTransform: 'uppercase', fontWeight: 'bold' }}>Buyer\'s Order No.</span><br />
                <span>—</span>
              </div>
              <div style={{ width: '50%', padding: '6px 8px', boxSizing: 'border-box' }}>
                <span style={{ fontSize: '8px', color: '#444444', textTransform: 'uppercase', fontWeight: 'bold' }}>Dated</span><br />
                <span>—</span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Buyer details vs. Dispatch details */}
        <div style={{ display: 'flex', borderBottom: '1px solid #000000' }}>
          <div style={{ width: '50%', borderRight: '1px solid #000000', padding: '8px', boxSizing: 'border-box', fontSize: '10px', lineHeight: '1.4' }}>
            <span style={{ fontSize: '8px', color: '#444444', textTransform: 'uppercase', fontWeight: 'bold' }}>Buyer (Bill to)</span><br />
            <strong>{customer?.customer_name || jobCard.owner_name}</strong><br />
            BARODA<br />
            M: {customer?.mobile_no || jobCard.mobile || '—'}<br />
            State Name: Gujarat, Code: 24<br />
            Place of Supply: Gujarat<br />
            {customer?.gstin ? (
              <strong>GST NO: {customer.gstin}</strong>
            ) : (
              <strong>GST NO: —</strong>
            )}
          </div>

          <div style={{ width: '50%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #000000', flex: 1 }}>
              <div style={{ width: '50%', borderRight: '1px solid #000000', padding: '6px 8px', boxSizing: 'border-box' }}>
                <span style={{ fontSize: '8px', color: '#444444', textTransform: 'uppercase', fontWeight: 'bold' }}>Dispatch Doc No.</span><br />
                <span>—</span>
              </div>
              <div style={{ width: '50%', padding: '6px 8px', boxSizing: 'border-box' }}>
                <span style={{ fontSize: '8px', color: '#444444', textTransform: 'uppercase', fontWeight: 'bold' }}>Delivery Note Date</span><br />
                <span>—</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', borderBottom: '1px solid #000000', flex: 1 }}>
              <div style={{ width: '50%', borderRight: '1px solid #000000', padding: '6px 8px', boxSizing: 'border-box' }}>
                <span style={{ fontSize: '8px', color: '#444444', textTransform: 'uppercase', fontWeight: 'bold' }}>Dispatched through</span><br />
                <span>—</span>
              </div>
              <div style={{ width: '50%', padding: '6px 8px', boxSizing: 'border-box' }}>
                <span style={{ fontSize: '8px', color: '#444444', textTransform: 'uppercase', fontWeight: 'bold' }}>Destination</span><br />
                <span>—</span>
              </div>
            </div>

            <div style={{ padding: '6px 8px', boxSizing: 'border-box', flex: 1 }}>
              <span style={{ fontSize: '8px', color: '#444444', textTransform: 'uppercase', fontWeight: 'bold' }}>Terms of Delivery</span><br />
              <span>—</span>
            </div>
          </div>
        </div>

        {/* Services Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1px solid #000000' }}>
          <thead>
            <tr style={{ backgroundColor: '#CC0000', borderBottom: '1px solid #000000' }}>
              <th style={{ width: '5%', borderRight: '1px solid #ffffff', padding: '6px 8px', textAlign: 'center', fontSize: '10px', fontWeight: 'bold', color: '#ffffff' }}>SI No.</th>
              <th style={{ width: '45%', borderRight: '1px solid #ffffff', padding: '6px 8px', textAlign: 'left', fontSize: '10px', fontWeight: 'bold', color: '#ffffff' }}>Description of Services</th>
              <th style={{ width: '15%', borderRight: '1px solid #ffffff', padding: '6px 8px', textAlign: 'center', fontSize: '10px', fontWeight: 'bold', color: '#ffffff' }}>HSN/SAC</th>
              <th style={{ width: '10%', borderRight: '1px solid #ffffff', padding: '6px 8px', textAlign: 'center', fontSize: '10px', fontWeight: 'bold', color: '#ffffff' }}>Quantity</th>
              <th style={{ width: '10%', borderRight: '1px solid #ffffff', padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 'bold', color: '#ffffff' }}>Rate</th>
              <th style={{ width: '5%', borderRight: '1px solid #ffffff', padding: '6px 8px', textAlign: 'center', fontSize: '10px', fontWeight: 'bold', color: '#ffffff' }}>per</th>
              <th style={{ width: '10%', padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 'bold', color: '#ffffff' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {services.map((item, idx) => {
              const name = item.service_name.toLowerCase();
              const unit = (name.includes('ppf') || name.includes('film')) ? 'sqt' : 
                           ((name.includes('ceramic') || name.includes('coating') || name.includes('graphene')) ? 'ml' : 'job');
              return (
                <tr key={idx} style={{ verticalAlign: 'top' }}>
                  <td style={{ borderRight: '1px solid #000000', padding: '6px 8px', textAlign: 'center', fontSize: '10px' }}>{idx + 1}</td>
                  <td style={{ borderRight: '1px solid #000000', padding: '6px 8px', fontSize: '10px' }}>
                    <strong>{item.service_name}</strong>
                  </td>
                  <td style={{ borderRight: '1px solid #000000', padding: '6px 8px', textAlign: 'center', fontSize: '10px' }}>{item.hsn_sac || '998714'}</td>
                  <td style={{ borderRight: '1px solid #000000', padding: '6px 8px', textAlign: 'center', fontSize: '10px' }}>{item.qty}</td>
                  <td style={{ borderRight: '1px solid #000000', padding: '6px 8px', textAlign: 'right', fontSize: '10px' }}>{Number(item.rate).toFixed(2)}</td>
                  <td style={{ borderRight: '1px solid #000000', padding: '6px 8px', textAlign: 'center', fontSize: '10px' }}>{unit}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px' }}>
                    <strong>{Number(item.amount).toFixed(2)}</strong>
                  </td>
                </tr>
              );
            })}

            {/* Blank row for padding height */}
            <tr>
              <td style={{ borderRight: '1px solid #000000', height: '100px' }}></td>
              <td style={{ borderRight: '1px solid #000000' }}></td>
              <td style={{ borderRight: '1px solid #000000' }}></td>
              <td style={{ borderRight: '1px solid #000000' }}></td>
              <td style={{ borderRight: '1px solid #000000' }}></td>
              <td style={{ borderRight: '1px solid #000000' }}></td>
              <td></td>
            </tr>

            {/* Discount row if discount exists */}
            {discountVal > 0 && (
              <tr style={{ borderTop: '1px solid #000000' }}>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td style={{ borderRight: '1px solid #000000', padding: '6px 8px', textAlign: 'right' }}>
                  <strong>DISCOUNT</strong>
                </td>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: 'red' }}>
                  <strong>-{Number(discountVal).toFixed(2)}</strong>
                </td>
              </tr>
            )}

            {/* Total Row */}
            <tr style={{ borderTop: '1px double #000000', borderBottom: '1px double #000000', fontWeight: 'bold' }}>
              <td style={{ borderRight: '1px solid #000000' }}></td>
              <td style={{ borderRight: '1px solid #000000', padding: '6px 8px' }}>Total</td>
              <td style={{ borderRight: '1px solid #000000' }}></td>
              <td style={{ borderRight: '1px solid #000000' }}></td>
              <td style={{ borderRight: '1px solid #000000' }}></td>
              <td style={{ borderRight: '1px solid #000000' }}></td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '11px' }}>
                {formatCurrency(totalVal)}
              </td>
            </tr>

            {advanceVal > 0 && (
              <tr style={{ borderTop: '1px solid #000000', fontWeight: 'bold' }}>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td style={{ borderRight: '1px solid #000000', padding: '6px 8px', color: '#555555' }}>Advance Paid</td>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px', color: '#555555' }}>
                  -{formatCurrency(advanceVal)}
                </td>
              </tr>
            )}

            {finalPaymentVal > 0 && (
              <tr style={{ borderTop: '1px solid #000000', fontWeight: 'bold' }}>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td style={{ borderRight: '1px solid #000000', padding: '6px 8px', color: '#555555' }}>Amount Paid on Invoice ({paymentMode.toUpperCase()})</td>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px', color: '#555555' }}>
                  -{formatCurrency(finalPaymentVal)}
                </td>
              </tr>
            )}

            <tr style={{ borderTop: '1px solid #000000', borderBottom: '1px double #000000', fontWeight: 'bold' }}>
              <td style={{ borderRight: '1px solid #000000' }}></td>
              <td style={{ borderRight: '1px solid #000000', padding: '6px 8px', color: '#CC0000' }}>Balance Due / Payable</td>
              <td style={{ borderRight: '1px solid #000000' }}></td>
              <td style={{ borderRight: '1px solid #000000' }}></td>
              <td style={{ borderRight: '1px solid #000000' }}></td>
              <td style={{ borderRight: '1px solid #000000' }}></td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '11px', color: '#CC0000' }}>
                {formatCurrency(balanceDueVal)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Words Row */}
        <div style={{ borderBottom: '1px solid #000000', padding: '8px 10px', fontSize: '10px' }}>
          <div style={{ float: 'left', width: '80%' }}>
            Amount Chargeable (in words)<br />
            <strong>INR {numberToWords(balanceDueVal > 0 ? balanceDueVal : totalVal)} Only</strong>
          </div>
          <div style={{ float: 'right', width: '20%', textAlign: 'right' }}>
            E. & O.E.
          </div>
          <div style={{ clear: 'both' }}></div>
        </div>

        {/* GST breakdown & Bank Details */}
        <div style={{ display: 'flex', borderBottom: '1px solid #000000' }}>
          <div style={{ width: '55%', borderRight: '1px solid #000000', padding: '8px', boxSizing: 'border-box' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#CC0000', color: '#ffffff' }}>
                  <th style={{ border: '1px solid #000000', borderRight: '1px solid #ffffff', padding: '4px', fontSize: '8px', fontWeight: 'bold', color: '#ffffff' }}>HSN/SAC</th>
                  <th style={{ border: '1px solid #000000', borderRight: '1px solid #ffffff', padding: '4px', fontSize: '8px', fontWeight: 'bold', textAlign: 'right', color: '#ffffff' }}>Taxable Value</th>
                  {applyGst && (
                    <>
                      <th style={{ border: '1px solid #000000', borderRight: '1px solid #ffffff', padding: '4px', fontSize: '8px', fontWeight: 'bold', textAlign: 'right', color: '#ffffff' }}>Central Tax (9%)</th>
                      <th style={{ border: '1px solid #000000', borderRight: '1px solid #ffffff', padding: '4px', fontSize: '8px', fontWeight: 'bold', textAlign: 'right', color: '#ffffff' }}>State Tax (9%)</th>
                    </>
                  )}
                  <th style={{ border: '1px solid #000000', padding: '4px', fontSize: '8px', fontWeight: 'bold', textAlign: 'right', color: '#ffffff' }}>Total Tax Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #000000', padding: '4px', fontSize: '8px' }}>998714</td>
                  <td style={{ border: '1px solid #000000', padding: '4px', fontSize: '8px', textAlign: 'right' }}>{Number(taxableVal).toFixed(2)}</td>
                  {applyGst && (
                    <>
                      <td style={{ border: '1px solid #000000', padding: '4px', fontSize: '8px', textAlign: 'right' }}>{Number(cgstAmount).toFixed(2)}</td>
                      <td style={{ border: '1px solid #000000', padding: '4px', fontSize: '8px', textAlign: 'right' }}>{Number(sgstAmount).toFixed(2)}</td>
                    </>
                  )}
                  <td style={{ border: '1px solid #000000', padding: '4px', fontSize: '8px', textAlign: 'right' }}>{Number(gstVal).toFixed(2)}</td>
                </tr>
                <tr style={{ fontWeight: 'bold', backgroundColor: '#fafafa' }}>
                  <td style={{ border: '1px solid #000000', padding: '4px', fontSize: '8px' }}>Total</td>
                  <td style={{ border: '1px solid #000000', padding: '4px', fontSize: '8px', textAlign: 'right' }}>{Number(taxableVal).toFixed(2)}</td>
                  {applyGst && (
                    <>
                      <td style={{ border: '1px solid #000000', padding: '4px', fontSize: '8px', textAlign: 'right' }}>{Number(cgstAmount).toFixed(2)}</td>
                      <td style={{ border: '1px solid #000000', padding: '4px', fontSize: '8px', textAlign: 'right' }}>{Number(sgstAmount).toFixed(2)}</td>
                    </>
                  )}
                  <td style={{ border: '1px solid #000000', padding: '4px', fontSize: '8px', textAlign: 'right' }}>{Number(gstVal).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            
            <div style={{ marginTop: '6px', fontSize: '8px' }}>
              Tax Amount (in words): <strong>{gstVal > 0 ? 'INR ' + numberToWords(gstVal) + ' Only' : 'NIL'}</strong>
            </div>
          </div>

          <div style={{ width: '45%', padding: '8px', boxSizing: 'border-box', fontSize: '9px', lineHeight: '1.4' }}>
            <strong>Company\'s Bank Details</strong><br />
            Bank Name : <strong>HDFC BANK LTD</strong><br />
            A/c No.   : <strong>50200104786162</strong><br />
            Branch    : <strong>SUN PHARMA</strong><br />
            IFSC Code : <strong>HDFC0003688</strong>
          </div>
        </div>

        {/* Declaration & Signatory Row */}
        <div style={{ display: 'flex' }}>
          <div style={{ width: '50%', padding: '8px', boxSizing: 'border-box', fontSize: '8px', lineHeight: '1.4', borderRight: '1px solid #000000' }}>
            <strong>Declaration:</strong><br />
            We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
          </div>
          
          <div style={{ width: '50%', textAlign: 'center', height: '70px', position: 'relative', paddingTop: '24px', boxSizing: 'border-box' }}>
            <div style={{ margin: '0 auto', width: '60%', borderBottom: '1px solid #000000' }}></div>
            <div style={{ marginTop: '4px', fontSize: '9px', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase' }}>
              Authorized Signatory
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
