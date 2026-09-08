import { CheckCircle2, Clock3, Send, XCircle } from "lucide-react";
import { formatDateTime } from "../../utils/formatters";

const ACTIONS = {
  SUBMITTED: { label: "Diajukan", Icon: Send },
  RESUBMITTED: { label: "Diajukan kembali", Icon: Send },
  APPROVED: { label: "Disetujui", Icon: CheckCircle2 },
  REJECTED: { label: "Ditolak", Icon: XCircle },
};

const ApprovalHistory = ({ approvalStatus, rejectionReason, history = [] }) => (
  <section className="approval-history" aria-label="Riwayat persetujuan">
    <div className="approval-history-heading">
      <div>
        <p>Persetujuan transaksi</p>
        <span>Jejak pengajuan dan keputusan yang tercatat.</span>
      </div>
      <span className={`approval-state is-${String(approvalStatus || "DRAFT").toLowerCase()}`}>
        {{ DRAFT: "Belum diajukan", PENDING: "Menunggu persetujuan", APPROVED: "Disetujui", REJECTED: "Ditolak", CANCELLED: "Dibatalkan" }[approvalStatus] || approvalStatus}
      </span>
    </div>

    {rejectionReason && (
      <div className="approval-rejection-note">
        <strong>Alasan penolakan</strong>
        <span>{rejectionReason}</span>
      </div>
    )}

    {history.length > 0 ? (
      <ol className="approval-timeline">
        {history.map((item) => {
          const presentation = ACTIONS[item.action] || ACTIONS.SUBMITTED;
          const { Icon } = presentation;
          return (
            <li key={item.id}>
              <span className={`approval-timeline-icon is-${item.action.toLowerCase()}`}>
                <Icon aria-hidden="true" />
              </span>
              <div>
                <strong>{presentation.label}</strong>
                <span>{item.acted_by_name || "Pengguna tidak tersedia"} · {formatDateTime(item.acted_at)}</span>
                {item.reason && <p>{item.reason}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    ) : (
      <div className="approval-history-empty">
        <Clock3 aria-hidden="true" /> Belum ada aktivitas persetujuan.
      </div>
    )}
  </section>
);

export default ApprovalHistory;
