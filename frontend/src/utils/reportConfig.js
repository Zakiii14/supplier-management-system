const REPORT_CONFIG = {
    purchasing: {
        type: "purchasing",
        label: "Pembelian",
        title: "Laporan Pembelian",
        description:
            "Pantau pesanan, penerimaan, retur, dan nilai pembelian bersih.",
        roles: [
            "ADMIN",
            "PURCHASING",
            "WAREHOUSE",
            "FINANCE",
            "MANAGER",
        ],
        statusParam: "status",
        statusLabel: "Status PO",
        statusOptions: [
            { value: "DRAFT", label: "Draft" },
            {
                value: "SUBMITTED",
                label: "Diajukan",
            },
            {
                value: "PARTIALLY_RECEIVED",
                label: "Diterima sebagian",
            },
            {
                value: "RECEIVED",
                label: "Diterima",
            },
            {
                value: "CANCELLED",
                label: "Dibatalkan",
            },
        ],
        entityParam: "supplier_id",
        entityLabel: "Supplier",
        entityType: "supplier",
    },

    inventory: {
        type: "inventory",
        label: "Persediaan",
        title: "Laporan Persediaan",
        description:
            "Pantau stok tersedia, karantina, rusak, dan seluruh pergerakannya.",
        roles: [
            "ADMIN",
            "PURCHASING",
            "WAREHOUSE",
            "FINANCE",
            "MANAGER",
        ],
        statusParam: "stock_status",
        statusLabel: "Status stok",
        statusOptions: [
            {
                value: "AVAILABLE",
                label: "Tersedia",
            },
            {
                value: "LOW",
                label: "Stok menipis",
            },
            {
                value: "OUT",
                label: "Stok habis",
            },
            {
                value: "QUARANTINE",
                label: "Memiliki stok karantina",
            },
            {
                value: "DAMAGED",
                label: "Memiliki stok rusak",
            },
        ],
        entityParam: "category_id",
        entityLabel: "Kategori",
        entityType: "category",
    },

    sales: {
        type: "sales",
        label: "Penjualan",
        title: "Laporan Penjualan",
        description:
            "Analisis pesanan, pengiriman, retur, dan nilai penjualan bersih.",
        roles: [
            "ADMIN",
            "SALES",
            "WAREHOUSE",
            "FINANCE",
            "MANAGER",
        ],
        statusParam: "status",
        statusLabel: "Status SO",
        statusOptions: [
            { value: "DRAFT", label: "Draft" },
            {
                value: "CONFIRMED",
                label: "Dikonfirmasi",
            },
            {
                value: "PARTIALLY_DELIVERED",
                label: "Dikirim sebagian",
            },
            {
                value: "DELIVERED",
                label: "Terkirim",
            },
            {
                value: "CANCELLED",
                label: "Dibatalkan",
            },
        ],
        entityParam: "customer_id",
        entityLabel: "Pelanggan",
        entityType: "customer",
    },

    finance: {
        type: "finance",
        label: "Piutang Pelanggan",
        title: "Laporan Keuangan Penjualan",
        description:
            "Pantau pajak, kredit retur, refund, pembayaran, dan sisa piutang.",
        roles: ["ADMIN", "FINANCE", "MANAGER"],
        statusParam: "status",
        statusLabel: "Status invoice",
        statusOptions: [
            {
                value: "UNPAID",
                label: "Belum dibayar",
            },
            {
                value: "PARTIAL",
                label: "Dibayar sebagian",
            },
            {
                value: "PAID",
                label: "Lunas",
            },
            {
                value: "OVERDUE",
                label: "Jatuh tempo",
            },
            {
                value: "CANCELLED",
                label: "Dibatalkan",
            },
        ],
        entityParam: "customer_id",
        entityLabel: "Pelanggan",
        entityType: "customer",
    },

    supplierFinance: {
        type: "supplierFinance",
        label: "Utang Supplier",
        title: "Laporan Keuangan Pembelian",
        description:
            "Pantau kredit retur, refund, pembayaran bersih, dan utang supplier.",
        roles: ["ADMIN", "FINANCE", "MANAGER"],
        statusParam: "payment_status",
        statusLabel: "Status pembayaran",
        statusOptions: [
            { value: "UNPAID", label: "Belum dibayar" },
            { value: "PARTIAL", label: "Dibayar sebagian" },
            { value: "PAID", label: "Lunas" },
            { value: "OVERDUE", label: "Jatuh tempo" },
            { value: "CANCELLED", label: "Dibatalkan" },
        ],
        entityParam: "supplier_id",
        entityLabel: "Supplier",
        entityType: "supplier",
    },
};

const getAvailableReports = (role) =>
    Object.values(REPORT_CONFIG).filter(
        (report) => report.roles.includes(role),
    );

export {
    getAvailableReports,
    REPORT_CONFIG,
};
