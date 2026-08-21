# SupplyFlow Frontend

Frontend untuk Supplier Management System yang mengintegrasikan proses master data, pembelian, persediaan, penjualan, pengiriman, keuangan, dan manajemen pengguna.

## Teknologi

- React 19
- Vite 8
- React Router
- Axios
- Lucide React
- Oxlint

## Fitur yang tersedia

- Login menggunakan username atau email
- JWT authentication
- Pemulihan sesi melalui `/api/auth/me`
- Protected route
- Logout frontend
- Navigasi berbasis role
- Dashboard responsif
- Dukungan role:
  - `ADMIN`
  - `PURCHASING`
  - `WAREHOUSE`
  - `SALES`
  - `FINANCE`
  - `MANAGER`

## Menjalankan aplikasi

Pastikan backend berjalan pada port `3000`.

```powershell
cd backend
npm run dev