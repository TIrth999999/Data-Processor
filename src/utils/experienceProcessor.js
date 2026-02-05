/**
 * Processes experience data and calculates marks
 * Experience format: "years_months_days" (e.g., "10_5_1")
 * 
 * Marks calculation:
 * - 0 marks if experience < 3_0_0
 * - 5 marks if experience is between 3_0_0 to 5_0_0 (both included)
 * - 10 marks if experience > 5_0_0 (even 1 day more)
 */

export const parseExperience = (experienceStr) => {
  if (!experienceStr || typeof experienceStr !== 'string') {
    return { years: 0, months: 0, days: 0, totalDays: 0 };
  }

  const parts = experienceStr.trim().split('_');
  if (parts.length !== 3) {
    return { years: 0, months: 0, days: 0, totalDays: 0 };
  }

  const years = parseInt(parts[0], 10) || 0;
  const months = parseInt(parts[1], 10) || 0;
  const days = parseInt(parts[2], 10) || 0;

  // Convert to total days for comparison (approximate: 365 days/year, 30 days/month)
  const totalDays = (years * 365) + (months * 30) + days;

  return { years, months, days, totalDays };
};

export const calculateMarks = (experienceStr) => {
  const { years, months, days } = parseExperience(experienceStr);

  // Compare directly: years_months_days format
  // 0 marks if experience < 3_0_0
  // 5 marks if experience is between 3_0_0 to 5_0_0 (both included)
  // 10 marks if experience > 5_0_0 (even 1 day more)

  // Convert to comparable value: years * 10000 + months * 100 + days
  // This allows proper comparison: 3_0_0 = 30000, 5_0_0 = 50000, 5_0_1 = 50001
  const experienceValue = (years * 10000) + (months * 100) + days;
  const threeYearsValue = 30000; // 3_0_0
  const fiveYearsValue = 50000; // 5_0_0

  if (experienceValue < threeYearsValue) {
    return 0;
  } else if (experienceValue >= threeYearsValue && experienceValue <= fiveYearsValue) {
    return 5;
  } else {
    // Even 1 day more than 5_0_0 gets 10 marks
    return 10;
  }
};

export const processExperienceData = (data) => {
  // Find the experience column (case-insensitive)
  const experienceKey = Object.keys(data[0] || {}).find(
    k => k.toLowerCase().includes('experience')
  );

  if (!experienceKey) {
    throw new Error('Experience column not found in CSV. Please ensure there is a column named "experience".');
  }

  return data.map((row, index) => {
    const experience = row[experienceKey] || '';
    const marks = calculateMarks(experience);

    return {
      ...row,
      Marks: marks,
      id: index,
      internalStatus: 'Approved',
      statusColor: 'bg-green-500/20 text-green-300 border-green-500/50',
      originalRow: { ...row, Marks: marks }
    };
  });
};
