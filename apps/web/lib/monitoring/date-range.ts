export function parseAndValidateDateRange(
  fromParam?: string,
  toParam?: string
): { from: Date; to: Date; errorResponse?: { code: string; message: string; statusCode: number } } {
  const now = new Date();
  let toDate = now;
  if (toParam) {
    toDate = new Date(toParam);
    if (isNaN(toDate.getTime())) {
      return {
        from: now,
        to: now,
        errorResponse: {
          code: 'INVALID_DATE_RANGE',
          message: "Query parameter 'to' must be a valid ISO 8601 date string.",
          statusCode: 400,
        },
      };
    }
  }

  let fromDate = new Date(toDate.getTime() - 24 * 60 * 60 * 1000);
  if (fromParam) {
    fromDate = new Date(fromParam);
    if (isNaN(fromDate.getTime())) {
      return {
        from: now,
        to: now,
        errorResponse: {
          code: 'INVALID_DATE_RANGE',
          message: "Query parameter 'from' must be a valid ISO 8601 date string.",
          statusCode: 400,
        },
      };
    }
  }

  if (fromDate.getTime() > toDate.getTime()) {
    return {
      from: fromDate,
      to: toDate,
      errorResponse: {
        code: 'INVALID_DATE_RANGE',
        message: "'from' timestamp must be before or equal to 'to' timestamp.",
        statusCode: 400,
      },
    };
  }

  const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;
  if (toDate.getTime() - fromDate.getTime() > MAX_RANGE_MS) {
    return {
      from: fromDate,
      to: toDate,
      errorResponse: {
        code: 'DATE_RANGE_EXCEEDED',
        message: 'Requested date range exceeds maximum allowed limit of 31 days.',
        statusCode: 400,
      },
    };
  }

  return { from: fromDate, to: toDate };
}
