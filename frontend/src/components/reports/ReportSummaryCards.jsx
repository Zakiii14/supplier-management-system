import {
  Boxes,
  CircleDollarSign,
  ClipboardList,
  PackageSearch,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  formatReportValue,
  getReportFieldLabel,
} from "../../utils/reportFormatting";

const summaryIcons = [
  ClipboardList,
  CircleDollarSign,
  Boxes,
  TrendingUp,
  WalletCards,
  PackageSearch,
];

const ReportSummaryCards = ({
  summary = {},
}) => {
  const entries = Object.entries(summary).filter(
    ([, value]) => value !== undefined,
  );

  if (entries.length === 0) {
    return null;
  }

  return (
    <section
      className="report-summary-grid"
      aria-label="Ringkasan laporan"
    >
      {entries.map(([field, value], index) => {
        const Icon =
          summaryIcons[index % summaryIcons.length];

        return (
          <article
            key={field}
            className="report-summary-card"
          >
            <div className="report-summary-icon">
              <Icon aria-hidden="true" />
            </div>

            <div>
              <span>
                {getReportFieldLabel(field)}
              </span>

              <strong>
                {formatReportValue(field, value)}
              </strong>
            </div>
          </article>
        );
      })}
    </section>
  );
};

export default ReportSummaryCards;