BEGIN;

UPDATE app.invoices
SET
    status = CASE
        WHEN due_date < CURRENT_DATE THEN 'OVERDUE'::app.invoice_status
        ELSE 'UNPAID'::app.invoice_status
    END,
    updated_at = NOW()
WHERE status = 'PARTIAL'::app.invoice_status
  AND paid_amount = 0
  AND paid_amount + credit_amount < grand_total;

CREATE OR REPLACE VIEW app.v_outstanding_invoices AS
 SELECT i.id,i.invoice_number,i.customer_id,c.customer_name,i.invoice_date,i.due_date,
        i.grand_total,i.paid_amount,
        (i.grand_total-i.paid_amount-i.credit_amount) AS outstanding_amount,
        CASE
          WHEN i.paid_amount+i.credit_amount>=i.grand_total THEN 'PAID'::text
          WHEN CURRENT_DATE>i.due_date THEN 'OVERDUE'::text
          WHEN i.paid_amount>0 THEN 'PARTIAL'::text
          ELSE 'UNPAID'::text
        END AS calculated_status
 FROM app.invoices i JOIN app.customers c ON c.id=i.customer_id
 WHERE i.status<>'CANCELLED'::app.invoice_status
   AND i.paid_amount+i.credit_amount<i.grand_total;

COMMIT;
