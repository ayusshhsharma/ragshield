import mongoose from 'mongoose';

const attackResultSchema = new mongoose.Schema(
  {
    runId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestRun',
      required: true,
      index: true,
    },
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
    caseId: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    isBenign: {
      type: Boolean,
      required: true,
      default: false,
    },
    repeatIndex: {
      type: Number,
      required: true,
      default: 1,
    },
    outcome: {
      type: String,
      required: true,
      enum: [
        'attack_succeeded',
        'blocked_by_defense',
        'model_refused_or_safe',
        'benign_answered',
        'error',
      ],
      index: true,
    },
    response: {
      type: String,
      default: '',
    },
    retrievedChunks: {
      type: Array,
      default: [],
    },
    defensesTriggered: {
      type: Array,
      default: [],
    },
    blocked: {
      type: Boolean,
      default: false,
    },
    blockedBy: {
      type: String,
      default: null,
    },
    successConditionMatchedRaw: {
      type: Boolean,
      default: null,
    },
    benignAcceptable: {
      type: Boolean,
      default: null,
    },
    ambiguous: {
      type: Boolean,
      default: false,
    },
    providerBlocked: {
      type: Boolean,
      default: false,
    },
    latencyMs: {
      type: Number,
      default: 0,
    },
    defenseLatencyMs: {
      type: Number,
      default: 0,
    },
    error: {
      type: String,
      default: null,
    },
    timestamp: {
      type: String,
      required: true,
    },
    caseSnapshot: {
      name: { type: String, default: '' },
      technique: { type: String, default: '' },
      severity: { type: String, default: '' },
      expectedBehavior: { type: String, default: '' },
      userQuery: { type: String, default: '' },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.runId = ret.runId.toString();
        ret.projectId = ret.projectId.toString();
        ret.ownerId = ret.ownerId.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.runId = ret.runId.toString();
        ret.projectId = ret.projectId.toString();
        ret.ownerId = ret.ownerId.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

attackResultSchema.index({ runId: 1, outcome: 1 });
attackResultSchema.index({ runId: 1, category: 1 });
attackResultSchema.index({ runId: 1, caseId: 1, repeatIndex: 1 }, { unique: true });

export const AttackResult = mongoose.model('AttackResult', attackResultSchema);
