import {
  Boxes,
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  PackageOpen,
  ReceiptText,
  ShoppingCart,
  Tags,
  Truck,
  UserCog,
  UsersRound,
  WalletCards,
  Warehouse,
} from "lucide-react";

const ALL_ROLES = [
  "ADMIN",
  "PURCHASING",
  "WAREHOUSE",
  "SALES",
  "FINANCE",
  "MANAGER",
];

const navigationGroups = [
  {
    label: null,
    items: [
      {
        label: "Dashboard",
        path: "/",
        icon: LayoutDashboard,
        roles: ALL_ROLES,
      },
    ],
  },
  {
    label: "Master Data",
    items: [
      {
        label: "Suppliers",
        path: "/suppliers",
        icon: Building2,
        roles: [
          "ADMIN",
          "PURCHASING",
          "WAREHOUSE",
          "MANAGER",
        ],
      },
      {
        label: "Categories",
        path: "/categories",
        icon: Tags,
        roles: ALL_ROLES,
      },
      {
        label: "Products",
        path: "/products",
        icon: Boxes,
        roles: ALL_ROLES,
      },
    ],
  },
  {
    label: "Purchasing & Inventory",
    items: [
      {
        label: "Purchase Orders",
        path: "/purchase-orders",
        icon: ShoppingCart,
        roles: [
          "ADMIN",
          "PURCHASING",
          "WAREHOUSE",
          "FINANCE",
          "MANAGER",
        ],
      },
      {
        label: "Goods Receipts",
        path: "/goods-receipts",
        icon: PackageOpen,
        roles: [
          "ADMIN",
          "PURCHASING",
          "WAREHOUSE",
          "FINANCE",
          "MANAGER",
        ],
      },
      {
        label: "Inventory",
        path: "/inventory",
        icon: Warehouse,
        roles: [
          "ADMIN",
          "PURCHASING",
          "WAREHOUSE",
          "FINANCE",
          "MANAGER",
        ],
      },
    ],
  },
  {
    label: "Sales & Delivery",
    items: [
      {
        label: "Customers",
        path: "/customers",
        icon: UsersRound,
        roles: [
          "ADMIN",
          "SALES",
          "FINANCE",
          "MANAGER",
        ],
      },
      {
        label: "Sales Orders",
        path: "/sales-orders",
        icon: ClipboardCheck,
        roles: [
          "ADMIN",
          "SALES",
          "WAREHOUSE",
          "FINANCE",
          "MANAGER",
        ],
      },
      {
        label: "Deliveries",
        path: "/deliveries",
        icon: Truck,
        roles: [
          "ADMIN",
          "SALES",
          "WAREHOUSE",
          "MANAGER",
        ],
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        label: "Invoices",
        path: "/invoices",
        icon: ReceiptText,
        roles: [
          "ADMIN",
          "FINANCE",
          "SALES",
          "MANAGER",
        ],
      },
      {
        label: "Payments",
        path: "/payments",
        icon: WalletCards,
        roles: ["ADMIN", "FINANCE", "MANAGER"],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "User Management",
        path: "/users",
        icon: UserCog,
        roles: ["ADMIN"],
      },
    ],
  },
];

export { navigationGroups };