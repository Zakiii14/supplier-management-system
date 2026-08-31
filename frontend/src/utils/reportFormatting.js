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

    total_po: "Total pesanan pembelian",
    total_purchase_orders:
        "Total pesanan pembelian",
    active_purchase_orders:
        "Pesanan pembelian aktif",
    total_purchase_value:
        "Total nilai pembelian",
    total_order_value: "Total nilai pesanan",
    ordered_quantity:
        "Jumlah barang dipesan",
    received_quantity:
        "Jumlah barang diterima",
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
    total_stock_value:
        "Total nilai persediaan",
    total_inventory_value:
        "Total nilai persediaan",
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
        "Total nilai penjualan",
    delivered_quantity:
        "Jumlah barang terkirim",
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
    outstanding_amount:
        "Sisa tagihan",
    total_payments:
        "Total transaksi pembayaran",
    payments_received:
        "Total pembayaran diterima",

    total_orders: "Total pesanan",
    total_value: "Total nilai",
    order_value: "Nilai pesanan",
    received_value:
        "Nilai barang diterima",
    sales_value: "Nilai penjualan",
    invoice_value: "Nilai invoice",
    payment_value: "Nilai pembayaran",

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
    "supplier_id",
    "category_id",
    "product_id",
    "customer_id",
    "purchase_order_id",
    "sales_order_id",
    "invoice_id",
]);

const CURRENCY_FIELD_PATTERN =
    /(_amount$|_value$|_balance$|_revenue$|_cost$|_price$|^grand_total$|^paid_amount$|^outstanding_amount$|^payments_received$)/i;

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

    CANCELLED: "Dibatalkan",
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
        field.endsWith("_status")
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