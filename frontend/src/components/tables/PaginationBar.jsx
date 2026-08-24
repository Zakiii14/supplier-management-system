import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const PaginationBar = ({
  page = 1,
  totalPages = 1,
  isLoading = false,
  onPageChange,
}) => {
  const normalizedTotalPages = Math.max(
    Number(totalPages) || 1,
    1,
  );

  const normalizedPage = Math.min(
    Math.max(Number(page) || 1, 1),
    normalizedTotalPages,
  );

  const handlePageChange = (nextPage) => {
    if (
      isLoading ||
      typeof onPageChange !== "function"
    ) {
      return;
    }

    onPageChange(nextPage);
  };

  return (
    <div className="pagination-bar">
      <p>
        Halaman <strong>{normalizedPage}</strong>{" "}
        dari <strong>{normalizedTotalPages}</strong>
      </p>

      <div>
        <button
          type="button"
          disabled={
            normalizedPage <= 1 || isLoading
          }
          aria-label="Halaman sebelumnya"
          onClick={() =>
            handlePageChange(
              Math.max(normalizedPage - 1, 1),
            )
          }
        >
          <ChevronLeft aria-hidden="true" />
          Sebelumnya
        </button>

        <button
          type="button"
          disabled={
            normalizedPage >= normalizedTotalPages ||
            isLoading
          }
          aria-label="Halaman berikutnya"
          onClick={() =>
            handlePageChange(
              Math.min(
                normalizedPage + 1,
                normalizedTotalPages,
              ),
            )
          }
        >
          Berikutnya
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default PaginationBar;