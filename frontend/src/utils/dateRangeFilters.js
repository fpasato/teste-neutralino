
const TIMEZONE_OFFSET = "-03:00"; 

export function applyDateRangeFilter(query, startDate, endDate) {
  if (startDate) {
    query = query.gte("created_at", `${startDate}T00:00:00${TIMEZONE_OFFSET}`);
  }
  if (endDate) {
    query = query.lte("created_at", `${endDate}T23:59:59${TIMEZONE_OFFSET}`);
  }
  return query;
}