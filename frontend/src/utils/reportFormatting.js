import {
    formatCurrency,
    formatDate,
    formatNumber,
} from "./formatters";

const REPORT_FIELD_LABELS = {
    period: "Periode",
    status: "Status",

    po_number: "Nomor PO",
    so_number: "Nomor SO",
    invoice_number: "Nomor invoice",
    payment_number: "Nomor pembayaran",
    payment_status: "Status pembayaran",
    payment_scheme: "Skema pembayaran",

    supplier_code: "Kode supplier",
    supplier_name: "Supplier",
    category_code: "Kode kategori",
    category_name: "Kategori",
    sku: "SKU",
    product_sku: "SKU",
    product_name: "Produk",
    customer_code: "Kode pelanggan",
    customer_name: "Pelanggan",

    order_date: "Tanggal pesanan",
    expected_date: "Estimasi tiba",
    requested_delivery_date:
        "Rencana pengiriman",
    invoice_date: "Tanggal invoice",
    payment_date: "Tanggal pembayaran",
    due_date: "Jatuh tempo",
    estimated_due_date: "Estimasi jatuh tempo",

    total_po: "Total pesanan pembelian",
    total_purchase_orders:
        "Total pesanan pembelian",
    active_purchase_orders:
        "Pesanan pembelian aktif",
    total_purchase_value:
        "Nilai pembelian bersih",
    gross_purchase_value:
        "Nilai pembelian bruto",
    returned_purchase_value:
        "Nilai retur pembelian",
    gross_purchase_amount:
        "Nilai pembelian bruto",
    total_order_value: "Total nilai pesanan",
    ordered_quantity:
        "Jumlah barang dipesan",
    received_quantity:
        "Jumlah barang diterima",
    returned_quantity:
        "Jumlah barang diretur",
    net_received_quantity:
        "Jumlah diterima bersih",
    pending_receipt_quantity:
        "Jumlah barang belum diterima",
    total_received_value:
        "Total nilai barang diterima",
    outstanding_value:
        "Nilai belum diterima",

    total_products: "Total produk",
    available_products: "Produk tersedia",
    low_stock_products:
        "Produk dengan stok menipis",
    out_of_stock_products:
        "Produk dengan stok habis",
    total_stock: "Total stok",
    total_stock_quantity:
        "Total jumlah stok",
    total_stock_units: "Total stok fisik",
    available_stock_units:
        "Stok tersedia",
    quarantine_stock_units:
        "Stok karantina",
    damaged_stock_units:
        "Stok rusak",
    total_physical_stock:
        "Total stok fisik",
    quarantine_stock: "Stok karantina",
    damaged_stock: "Stok rusak",
    total_stock_value:
        "Total nilai persediaan",
    total_inventory_value:
        "Total nilai persediaan",
    available_inventory_value:
        "Nilai stok tersedia",
    quarantine_inventory_value:
        "Nilai stok karantina",
    damaged_inventory_value:
        "Nilai stok rusak",
    inbound_quantity:
        "Jumlah stok masuk",
    outbound_quantity:
        "Jumlah stok keluar",
    net_quantity:
        "Perubahan stok bersih",

    total_so: "Total pesanan penjualan",
    total_sales_orders:
        "Total pesanan penjualan",
    active_sales_orders:
        "Pesanan penjualan aktif",
    total_sales_value:
        "Nilai penjualan bersih",
    gross_sales_value:
        "Nilai penjualan bruto",
    gross_sales_amount:
        "Nilai penjualan bruto",
    delivered_quantity:
        "Jumlah barang terkirim",
    returned_amount: "Nilai retur",
    returned_value: "Nilai retur",
    net_delivered_quantity:
        "Jumlah terkirim bersih",
    pending_delivery_quantity:
        "Jumlah barang belum terkirim",
    delivered_value:
        "Nilai barang terkirim",
    undelivered_value:
        "Nilai barang belum terkirim",

    total_invoices: "Total invoice",
    active_invoices: "Invoice aktif",
    overdue_invoices:
        "Invoice jatuh tempo",
    total_invoice_value:
        "Total nilai invoice",
    total_invoice_amount:
        "Total nilai invoice",
    total_paid_amount:
        "Total nilai terbayar",
    total_tax_amount: "Total pajak invoice",
    total_return_credit:
        "Kredit retur customer",
    net_invoice_value:
        "Nilai invoice setelah retur",
    credit_amount:
        "Kredit retur",
    outstanding_amount:
        "Sisa tagihan",
    total_payments:
        "Total transaksi pembayaran",
    customer_payment_proofs:
        "Bukti pembayaran pelanggan",
    payments_received:
        "Total pembayaran diterima",
    total_customer_refunds:
        "Jumlah refund customer",
    customer_refunds:
        "Nilai refund customer",
    customer_replacement_value:
        "Nilai replacement customer",
    return_credit_settlements:
        "Penyelesaian kredit retur",
    net_payments_received:
        "Pembayaran bersih diterima",
    overdue_purchase_orders:
        "PO melewati jatuh tempo",
    supplier_payments_made:
        "Pembayaran kepada supplier",
    supplier_refunds: "Refund supplier",
    net_supplier_payments:
        "Pembayaran bersih supplier",
    supplier_return_credit:
        "Kredit retur supplier",
    return_credit_amount:
        "Kredit retur supplier",
    supplier_replacement_value:
        "Nilai replacement supplier",
    replacement_amount:
        "Nilai replacement",
    supplier_outstanding_amount:
        "Sisa utang supplier",
    overdue_supplier_amount:
        "Utang melewati jatuh tempo",
    supplier_payment_value:
        "Pembayaran supplier",
    payment_count: "Jumlah pembayaran",
    proof_count: "Jumlah bukti",

    total_orders: "Total pesanan",
    total_value: "Total nilai",
    order_value: "Nilai pesanan",
    received_value:
        "Nilai barang diterima",
    sales_value: "Nilai penjualan",
    invoice_value: "Nilai invoice",
    payment_value: "Nilai pembayaran",
    refund_value: "Nilai refund",
    supplier_refund_value:
        "Nilai refund supplier",

    item_count: "Jumlah jenis barang",
    total_items: "Jumlah jenis barang",
    total_quantity: "Jumlah barang",
    pending_quantity:
        "Jumlah barang tersisa",

    grand_total: "Total nilai",
    total_amount: "Total nilai",
    paid_amount: "Nilai terbayar",

    current_stock: "Stok saat ini",
    minimum_stock: "Stok minimum",
    stock_status: "Status stok",
    stock_value: "Nilai persediaan",
    quantity_in: "Jumlah masuk",
    quantity_out: "Jumlah keluar",

    payment_method:
        "Metode pembayaran",
    notes: "Catatan",
};

const HIDDEN_REPORT_FIELDS = new Set([
    "id",
    "stored_status",
    "supplier_id",
    "category_id",
    "product_id",
    "customer_id",
    "purchase_order_id",
    "sales_order_id",
    "invoice_id",
]);

const CURRENCY_FIELD_PATTERN =
    /(_amount$|_value$|_balance$|_revenue$|_cost$|_price$|_refunds?$|_credit$|^grand_total$|^paid_amount$|^outstanding_amount$|^payments_received$|^net_payments_received$|^supplier_payments_made$|^net_supplier_payments$|^total_return_credit$|^return_credit_settlements$)/i;

const DATE_FIELD_PATTERN =
    /(^date$|_date$|^due_date$)/i;

const REPORT_ENUM_LABELS = {
    DRAFT: "Draft",
    SUBMITTED: "Diajukan",
    PARTIALLY_RECEIVED: "Diterima sebagian",
    RECEIVED: "Diterima",

    CONFIRMED: "Dikonfirmasi",
    PARTIALLY_DELIVERED: "Dikirim sebagian",
    DELIVERED: "Terkirim",

    UNPAID: "Belum dibayar",
    PARTIAL: "Dibayar sebagian",
    PAID: "Lunas",
    OVERDUE: "Jatuh tempo",

    AVAILABLE: "Tersedia",
    LOW: "Stok menipis",
    OUT: "Stok habis",
    QUARANTINE: "Karantina",
    DAMAGED: "Rusak",

    CANCELLED: "Dibatalkan",

    DIRECT: "Pembayaran langsung",
    TERM: "Termin pembayaran",
    DOWN_PAYMENT: "DP dan pelunasan",
    COD: "Bayar saat barang diterima",
};

const formatEnumLabel = (value) => {
    const normalizedValue = String(
        value ?? "",
    ).toLocaleUpperCase("id-ID");

    if (REPORT_ENUM_LABELS[normalizedValue]) {
        return REPORT_ENUM_LABELS[
            normalizedValue
        ];
    }

    return String(value ?? "")
        .toLocaleLowerCase("id-ID")
        .split("_")
        .filter(Boolean)
        .map(
            (part) =>
                part.charAt(0).toLocaleUpperCase(
                    "id-ID",
                ) + part.slice(1),
        )
        .join(" ");
};

const getReportFieldLabel = (field) =>
    REPORT_FIELD_LABELS[field] ||
    formatEnumLabel(field);

const isNumericValue = (value) =>
    value !== "" &&
    value !== null &&
    value !== undefined &&
    Number.isFinite(Number(value));

const formatReportValue = (field, value) => {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "-";
    }

    if (CURRENCY_FIELD_PATTERN.test(field)) {
        return formatCurrency(value);
    }

    if (DATE_FIELD_PATTERN.test(field)) {
        return formatDate(value);
    }

    if (isNumericValue(value)) {
        return formatNumber(value);
    }

    if (
        field === "status" ||
        field.endsWith("_status") ||
        field === "payment_scheme"
    ) {
        return formatEnumLabel(value);
    }

    return String(value);
};

const getVisibleReportColumns = (rows = []) => {
    const firstRow = rows[0];

    if (!firstRow) {
        return [];
    }

    return Object.keys(firstRow).filter(
        (field) =>
            !HIDDEN_REPORT_FIELDS.has(field) &&
            !field.endsWith("_id"),
    );
};

const getTrendMetricFields = (trend = []) => {
    const firstRow = trend[0];

    if (!firstRow) {
        return [];
    }

    return Object.keys(firstRow).filter(
        (field) =>
            field !== "period" &&
            isNumericValue(firstRow[field]),
    );
};

export {
    formatEnumLabel,
    formatReportValue,
    getReportFieldLabel,
    getTrendMetricFields,
    getVisibleReportColumns,
};
