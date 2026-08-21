import {
  ArrowLeft,
  Construction,
} from "lucide-react";
import {
  Link,
  Navigate,
  useLocation,
} from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { navigationGroups } from "../utils/navigation";

const ModulePlaceholderPage = () => {
  const location = useLocation();
  const { user } = useAuth();

  const currentModule = navigationGroups
    .flatMap((group) => group.items)
    .find((item) => item.path === location.pathname);

  if (
    !currentModule ||
    !currentModule.roles.includes(user.role)
  ) {
    return <Navigate to="/" replace />;
  }

  const Icon = currentModule.icon;

  return (
    <section className="module-placeholder">
      <span className="module-placeholder-icon">
        <Icon aria-hidden="true" />
      </span>

      <div>
        <p className="module-placeholder-eyebrow">
          <Construction aria-hidden="true" />
          Tahap pengembangan berikutnya
        </p>

        <h2>{currentModule.label}</h2>

        <p>
          Struktur navigasi dan hak akses untuk modul ini
          sudah tersedia. Halaman pengelolaan datanya akan
          dibangun secara bertahap setelah fondasi
          autentikasi selesai.
        </p>

        <Link to="/" className="module-back-link">
          <ArrowLeft aria-hidden="true" />
          Kembali ke dashboard
        </Link>
      </div>
    </section>
  );
};

export default ModulePlaceholderPage;