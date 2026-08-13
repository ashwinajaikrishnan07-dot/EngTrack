const mongoose = require('mongoose');
const crypto = require('crypto');

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
    },
    leadUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // GitHub repo in "owner/repo" format, e.g. "ashwinajaikrishnan07-dot/em-jeans"
    githubRepo: {
      type: String,
      default: '',
      trim: true,
    },
    webhookSecret: {
      type: String,
      default: '',
    },
    // Each team gets its own unique invite code
    inviteCode: {
      type: String,
      unique: true,
      default: () => crypto.randomBytes(3).toString('hex').toUpperCase(),
    },
  },
  { timestamps: true }
);

// Regenerate invite code
teamSchema.methods.regenerateInviteCode = function () {
  this.inviteCode = crypto.randomBytes(3).toString('hex').toUpperCase();
  return this.save();
};

// Parse owner/repo from githubRepo string
teamSchema.methods.getGithubOwnerRepo = function () {
  if (!this.githubRepo) return { owner: null, repo: null };
  const parts = this.githubRepo.split('/');
  if (parts.length >= 2) {
    return { owner: parts[0].trim(), repo: parts[1].trim() };
  }
  return { owner: null, repo: null };
};

module.exports = mongoose.model('Team', teamSchema);
