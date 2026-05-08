export function getPlaidErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;

  const response = "response" in error ? error.response : undefined;
  if (response && typeof response === "object" && "data" in response) {
    const data = response.data;
    if (data && typeof data === "object" && "error_code" in data) {
      return String(data.error_code);
    }
  }

  if ("error_code" in error) {
    return String(error.error_code);
  }

  return undefined;
}

export function getPlaidRequestId(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const response = "response" in error ? error.response : undefined;
  if (response && typeof response === "object" && "data" in response) {
    const data = response.data;
    if (data && typeof data === "object" && "request_id" in data) {
      return String(data.request_id);
    }
  }
  return undefined;
}

export function isTransactionsMutationDuringPagination(error: unknown) {
  return getPlaidErrorCode(error) === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION";
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}
