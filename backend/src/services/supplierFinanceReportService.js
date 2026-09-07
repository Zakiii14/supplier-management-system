const {
  normalizeEnum,
  normalizeText,
  parseReportQuery,
  validateEnum,
  validateUuid,
} = require("../utils/reportUtils");

const SUPPLIER_PAYMENT_STATUSES = [
  "UNPAID",
  "PARTIAL",
  "PAID",
  "OVERDUE",
  "CANCELLED",
];

const SUPPLIER_FINANCE_CTE = `
  WITH supplier_finance_base AS (
    SELECT
      po.id,
      po.po_number,
      po.order_date,
      po.expected_date,
      po.status::TEXT AS purchase_order_status,
      po.payment_scheme,
      po.payment_terms_days,
      po.down_payment_percent,
      po.notes,
      s.id AS supplier_id,
      s.supplier_code,
      s.supplier_name,
      CASE WHEN invoice_summary.invoice_count > 0
        THEN invoice_summary.invoiced_amount
        ELSE COALESCE(item_summary.total_amount, 0)
      END AS total_amount,
      COALESCE(invoice_summary.invoice_count, 0) AS invoice_count,
      COALESCE(payment_summary.paid_amount, 0) AS paid_amount,
      COALESCE(payment_summary.payment_count, 0) AS payment_count,
      COALESCE(proof_summary.proof_count, 0) AS proof_count,
      CASE WHEN invoice_summary.invoice_count > 0
        THEN invoice_summary.due_date
        ELSE CASE
        WHEN po.payment_scheme = 'TERM'
          THEN po.order_date + po.payment_terms_days
        WHEN po.payment_scheme = 'COD'
          THEN COALESCE(po.expected_date, po.order_date)
        ELSE po.order_date
        END
      END AS estimated_due_date
    FROM app.purchase_orders po
    JOIN app.suppliers s
      ON s.id = po.supplier_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(poi.quantity * poi.unit_price), 0) AS total_amount
      FROM app.purchase_order_items poi
      WHERE poi.purchase_order_id = po.id
    ) item_summary ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(si.id)::INTEGER AS invoice_count,
        COALESCE(SUM(si.total_amount),0) AS invoiced_amount,
        MIN(si.due_date) FILTER (WHERE si.total_amount > COALESCE((SELECT SUM(spi.amount) FROM app.supplier_payments spi WHERE spi.supplier_invoice_id=si.id),0)) AS due_date
      FROM app.supplier_invoices si
      WHERE si.purchase_order_id=po.id
    ) invoice_summary ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(sp.amount), 0) AS paid_amount,
        COUNT(sp.id)::INTEGER AS payment_count
      FROM app.supplier_payments sp
      WHERE sp.purchase_order_id = po.id
    ) payment_summary ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(pp.id)::INTEGER AS proof_count
      FROM app.supplier_payments sp
      JOIN app.payment_proofs pp
        ON pp.supplier_payment_id = sp.id
      WHERE sp.purchase_order_id = po.id
    ) proof_summary ON TRUE
    WHERE po.status <> 'DRAFT'
  ),
  supplier_finance_rows AS (
    SELECT
      sfb.*,
      GREATEST(sfb.total_amount - sfb.paid_amount, 0) AS outstanding_amount,
      CASE
        WHEN sfb.purchase_order_status = 'CANCELLED' THEN 'CANCELLED'
        WHEN sfb.total_amount > 0 AND sfb.paid_amount >= sfb.total_amount
          THEN 'PAID'
        WHEN sfb.estimated_due_date < CURRENT_DATE
          AND sfb.total_amount > sfb.paid_amount
          THEN 'OVERDUE'
        WHEN sfb.paid_amount > 0 THEN 'PARTIAL'
        ELSE 'UNPAID'
      END AS payment_status
    FROM supplier_finance_base sfb
  )
`;

const parseSupplierFinanceQuery = (query) => {
  const parsed = parseReportQuery(query);
  if (parsed.error) return parsed;

  const paymentStatus = normalizeEnum(query.payment_status);
  const supplierId = normalizeText(query.supplier_id);
  const validationError =
    validateEnum(
      paymentStatus,
      SUPPLIER_PAYMENT_STATUSES,
      "Invalid supplier payment status",
    ) || validateUuid(supplierId, "supplier ID");

  if (validationError) return { error: validationError };

  return {
    ...parsed,
    paymentStatus,
    supplierId,
  };
};

const buildSupplierFinanceFilter = (parsed) => {
  const conditions = [];
  const values = [];

  if (parsed.search) {
    values.push(`%${parsed.search}%`);
    conditions.push(`(
      sfr.po_number ILIKE $${values.length}
      OR sfr.supplier_code ILIKE $${values.length}
      OR sfr.supplier_name ILIKE $${values.length}
    )`);
  }
  if (parsed.paymentStatus) {
    values.push(parsed.paymentStatus);
    conditions.push(`sfr.payment_status = $${values.length}`);
  }
  if (parsed.supplierId) {
    values.push(parsed.supplierId);
    conditions.push(`sfr.supplier_id = $${values.length}`);
  }
  if (parsed.dateFrom) {
    values.push(parsed.dateFrom);
    conditions.push(`sfr.order_date >= $${values.length}::DATE`);
  }
  if (parsed.dateTo) {
    values.push(parsed.dateTo);
    conditions.push(`sfr.order_date <= $${values.length}::DATE`);
  }

  return {
    values,
    whereClause: conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "",
  };
};

module.exports = {
  SUPPLIER_FINANCE_CTE,
  SUPPLIER_PAYMENT_STATUSES,
  buildSupplierFinanceFilter,
  parseSupplierFinanceQuery,
};
