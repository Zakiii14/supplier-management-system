import {
  ArrowRight,
  CircleCheck,
  Layers3,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { navigationGroups } from "../utils/navigation";

const DashboardPage = () => {
  const { user } = useAuth();

  const availableModules = navigationGroups
    .flatMap((group) => group.items)
    .filter(
      (item) =>
        item.path !== "/" &&
        item.roles.includes(user.role),
    );

  const currentDate = new Intl.DateTimeFormat(
    "id-ID",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  ).format(new Date());

  return (
    <div className="dashboard-page">
      <section className="dashboard-welcome">
        <div>
          <p className="dashboard-date">{currentDate}</p>

          <h2>
            Selamat datang,{" "}
            {user.full_name || user.username}.
          </h2>

          <p>
            Gunakan dashboard ini untuk mengakses
            aktivitas operasional sesuai kewenangan
            akunmu.
          </p>
        </div>

        <ShieldCheck aria-hidden="true" />
      </section>

      <section
        className="dashboard-summary"
        aria-label="Ringkasan akses"
      >
        <article className="summary-card">
          <span className="summary-card-icon">
            <ShieldCheck aria-hidden="true" />
          </span>

          <div>
            <p>Role akun</p>
            <strong>{user.role}</strong>
          </div>
        </article>

        <article className="summary-card">
          <span className="summary-card-icon">
            <Layers3 aria-hidden="true" />
          </span>

          <div>
            <p>Modul tersedia</p>
            <strong>
              {availableModules.length} modul
            </strong>
          </div>
        </article>

        <article className="summary-card">
          <span className="summary-card-icon">
            <CircleCheck aria-hidden="true" />
          </span>

          <div>
            <p>Status sesi</p>
            <strong>Terverifikasi</strong>
          </div>
        </article>
      </section>

      <section className="dashboard-modules">
        <div className="section-heading">
          <div>
            <p>Akses cepat</p>
            <h2>Modul yang tersedia</h2>
          </div>
        </div>

        <div className="module-grid">
          {availableModules.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                className="module-card"
                to={item.path}
                key={item.path}
              >
                <span className="module-card-icon">
                  <Icon aria-hidden="true" />
                </span>

                <div>
                  <h3>{item.label}</h3>
                  <p>
                    Buka dan kelola data{" "}
                    {item.label.toLowerCase()}.
                  </p>
                </div>

                <ArrowRight
                  className="module-card-arrow"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;