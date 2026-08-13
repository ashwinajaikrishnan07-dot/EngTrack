const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema(
  {
    issueId: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assigneeGithubLogin: {
      type: String,
      default: null,
    },
    priority: {
      type: String,
      enum: ['urgent', 'high', 'normal', 'low'],
      default: 'normal',
    },
    status: {
      type: String,
      enum: ['open', 'in-progress', 'closed'],
      default: 'open',
    },
    labels: [{ type: String }],
    githubUrl: {
      type: String,
      default: '',
    },
    closedAt: {
      type: Date,
      default: null,
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    comments: [
      {
        body: String,
        author: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    syncedAt: {
      type: Date,
      default: Date.now,
    },

    // AI Triage fields
    aiTriage: {
      severity: { type: String, enum: ['Critical', 'High', 'Normal', 'Low'], default: null },
      likelyCause: { type: String, default: '' },
      suggestedAssignee: { type: String, default: '' },
      estimatedResolution: { type: String, default: '' },
      debuggingSteps: [{ type: String }],
      impactedModules: [{ type: String }],
      triageAt: { type: Date, default: null },
    },

    // Duplicate detection
    duplicateOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
      default: null,
    },
    similarIssues: [
      {
        issueId: Number,
        title: String,
        similarity: Number,
        _id: mongoose.Schema.Types.ObjectId,
      },
    ],

    // Escalation tracking
    escalated: { type: Boolean, default: false },
    escalatedAt: { type: Date, default: null },
    escalationReason: { type: String, default: '' },

    // Timing metrics
    firstResponseAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    resolutionTimeHours: { type: Number, default: null },

    // ── New fields ────────────────────────────────────────────────────────────

    // Team & classification (from Groq)
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    classifiedTeam: {
      type: String,
      enum: ['frontend', 'backend', 'devops', 'fullstack', ''],
      default: '',
    },
    severity: {
      type: String,
      enum: ['critical', 'moderate', 'low', ''],
      default: '',
    },
    severityReason: {
      type: String,
      default: '',
    },
    suggestedAction: {
      type: String,
      default: '',
    },
    aiExplanation: {
      type: String,
      default: '',
    },
    estimatedComplexity: {
      type: String,
      enum: ['quick-fix', 'medium', 'complex', ''],
      default: '',
    },

    // Extended status (superset of existing — existing 'open'/'in-progress'/'closed' still valid)
    workflowStatus: {
      type: String,
      enum: ['open', 'in_progress', 'resolved'],
      default: 'open',
    },

    // Resolution tracking
    resolvedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    openedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for fast queries
issueSchema.index({ issueId: 1, teamId: 1 }, { unique: true });
issueSchema.index({ status: 1 });
issueSchema.index({ priority: 1 });
issueSchema.index({ assignee: 1 });
issueSchema.index({ createdAt: -1 });
issueSchema.index({ teamId: 1 });
issueSchema.index({ classifiedTeam: 1 });
issueSchema.index({ severity: 1 });

module.exports = mongoose.model('Issue', issueSchema);
