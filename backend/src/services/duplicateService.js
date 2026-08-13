const stringSimilarity = require('string-similarity');
const Issue = require('../models/Issue');

const SIMILARITY_THRESHOLD = 0.7;

/**
 * Clean and normalize text
 */
const normalizeText = (text = '') => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Check for duplicate/similar issues
 */
const checkDuplicates = async (
  title,
  description = '',
  excludeId = null
) => {
  try {
    // Validate input
    if (!title || title.trim() === '') {
      return [];
    }

    // Query open issues only
    const query = {
      status: { $ne: 'closed' },
    };

    // Exclude current issue when updating
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    // Fetch existing issues
    const existingIssues = await Issue.find(query)
      .select('_id issueId title description status')
      .lean();

    if (!existingIssues.length) {
      return [];
    }

    // Normalize incoming issue
    const normalizedTitle = normalizeText(title);
    const normalizedDescription = normalizeText(description);

    const newText = `${normalizedTitle} ${normalizedDescription}`;

    const similarIssues = [];

    // Compare with existing issues
    for (const issue of existingIssues) {
      const existingTitle = normalizeText(issue.title);
      const existingDescription = normalizeText(issue.description || '');

      const existingText = `${existingTitle} ${existingDescription}`;

      // Compare title
      const titleSimilarity = stringSimilarity.compareTwoStrings(
        normalizedTitle,
        existingTitle
      );

      // Compare full content
      const fullSimilarity = stringSimilarity.compareTwoStrings(
        newText,
        existingText
      );

      /**
       * Weighted scoring
       * Title matters more than description
       */
      const finalScore =
        titleSimilarity * 0.7 +
        fullSimilarity * 0.3;

      // Push only above threshold
      if (finalScore >= SIMILARITY_THRESHOLD) {
        similarIssues.push({
          _id: issue._id,
          issueId: issue.issueId,
          title: issue.title,
          description: issue.description,
          similarity: Math.round(finalScore * 100),
        });
      }
    }

    // Sort by highest similarity
    similarIssues.sort(
      (a, b) => b.similarity - a.similarity
    );

    // Return top 5
    return similarIssues.slice(0, 5);

  } catch (error) {
    console.error(
      'Duplicate issue detection error:',
      error.message
    );

    return [];
  }
};

module.exports = {
  checkDuplicates,
};