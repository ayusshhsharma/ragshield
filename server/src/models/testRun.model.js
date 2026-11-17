import mongoose from 'mongoose';

const testRunSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    experimentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Experiment',
      default: null,
      index: true,
    },
    mode: {
      type: String,
      enum: ['baseline', 'protected'],
      required: true,
    },
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed', 'cancelled'],
      default: 'queued',
      index: true,
    },
    cancelRequested: {
      type: Boolean,
      default: false,
    },
    failureReason: {
      type: String,
      default: null,
    },
    caseIds: {
      type: [String],
      required: true,
    },
    repeats: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      default: 3,
    },
    includeBenign: {
      type: Boolean,
      default: true,
    },
    ragConfigSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    defenseConfigSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    llm: {
      provider: { type: String, default: 'mock' },
      model: { type: String, default: 'mock' },
      temperature: { type: Number, default: 0.2 },
    },
    progress: {
      total: { type: Number, default: 0 },
      completed: { type: Number, default: 0 },
      errors: { type: Number, default: 0 },
    },
    metrics: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    finishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.projectId = ret.projectId.toString();
        ret.ownerId = ret.ownerId.toString();
        if (ret.experimentId) {
          ret.experimentId = ret.experimentId.toString();
        }
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.projectId = ret.projectId.toString();
        ret.ownerId = ret.ownerId.toString();
        if (ret.experimentId) {
          ret.experimentId = ret.experimentId.toString();
        }
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

testRunSchema.index({ projectId: 1, createdAt: -1 });
testRunSchema.index({ ownerId: 1, createdAt: -1 });

export const TestRun = mongoose.model('TestRun', testRunSchema);
