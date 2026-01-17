const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const getSeasonIdForDate = (dateKey) => {
  if (!dateKey || !DATE_KEY_REGEX.test(dateKey)) return null;
  const [yearText, monthText] = dateKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}${startYear + 1}`;
};

const getTodayDateKey = () => new Date().toISOString().slice(0, 10);

module.exports = { getSeasonIdForDate, getTodayDateKey };
